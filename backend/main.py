import json
import uuid
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from google.genai import types
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import ExecutionLog, LogEntry
from services.gemini import (
    GeminiError,
    MODEL_FAILOVER_POOL,
    create_agent_config,
    extract_response_details,
    get_gemini_client,
    get_model_label,
    get_model_name,
)
from tools import AVAILABLE_TOOLS_MAP

load_dotenv()

# Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Nexus Agent Backend - Gemini Powered")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_AGENT_STEPS = 15


@app.get("/")
def root():
    return {
        "status": "ok",
        "agent": "nexus-gemini-v2",
        "model": get_model_label(),
        "capabilities": [
            "Browser Automation",
            "DOM Reading",
            "Element Interaction",
            "Form Filling",
            "Navigation Control",
        ],
    }


def safe_save_log(
    db: Session,
    session_id: str,
    step_number: int,
    role: str,
    content: str,
    status: str,
) -> None:
    try:
        db.add(
            LogEntry(
                session_id=session_id,
                step_number=step_number,
                role=role,
                content=str(content),
                status=status,
            )
        )
        db.commit()
    except Exception as e:
        print(f"Log save warning: {e}")


async def send_log(websocket: WebSocket, payload: Dict[str, Any]):
    await websocket.send_text(json.dumps({"type": "LOG_ENTRY", "payload": payload}))


@app.websocket("/v1/ws/agent")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    await websocket.accept()
    session_id = str(uuid.uuid4())
    step_num = 1
    run_status = "RUNNING"

    try:
        raw_msg = await websocket.receive_text()
        message = json.loads(raw_msg)

        if message.get("type") != "TASK_REQUEST":
            await websocket.close()
            return

        payload = message.get("payload", {})
        task_content = payload.get("task", "")
        page_context = payload.get("page")

        # Record start in execution logs
        try:
            db.add(ExecutionLog(session_id=session_id, task_request=task_content, status="RUNNING"))
            db.commit()
        except Exception:
            pass

        model_label = get_model_label()
        await send_log(websocket, {
            "thought": f"Initializing Nexus Agent powered by {model_label}...",
            "model": model_label,
            "status": "RUNNING",
        })

        # Initialize Gemini Client
        try:
            client = get_gemini_client()
        except GeminiError as ge:
            err_msg = str(ge)
            safe_save_log(db, session_id, step_num, "Error", err_msg, "FAILED")
            await send_log(websocket, {
                "thought": f"⚠️ {err_msg}",
                "final_answer": err_msg,
                "status": "FAILED",
            })
            return

        # Prepare initial page context summary for Gemini
        page_summary = "No page data available."
        if page_context and isinstance(page_context, dict):
            page_summary = (
                f"Page Title: {page_context.get('title', 'Unknown')}\n"
                f"Page URL: {page_context.get('url', 'Unknown')}\n"
                f"Headings: {json.dumps(page_context.get('headings', []), ensure_ascii=False)[:500]}\n"
                f"Interactive Inputs/Buttons: {json.dumps(page_context.get('inputs', []), ensure_ascii=False)[:1500]}\n"
                f"Key Links: {json.dumps(page_context.get('links', [])[:20], ensure_ascii=False)[:1000]}\n"
                f"Body Text Preview:\n{str(page_context.get('text', ''))[:4000]}"
            )

        user_prompt = (
            f"User Goal: {task_content}\n\n"
            f"=== CURRENT BROWSER PAGE CONTEXT ===\n"
            f"{page_summary}\n"
            f"====================================\n\n"
            f"Please inspect the current page context and execute the necessary browser tools to accomplish the goal."
        )

        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_prompt)],
            )
        ]

        agent_config = create_agent_config()
        model_name = get_model_name()

        candidate_models = [model_name]
        for fallback in MODEL_FAILOVER_POOL:
            if fallback not in candidate_models:
                candidate_models.append(fallback)

        for _ in range(MAX_AGENT_STEPS):
            response = None
            last_err = None

            for m in candidate_models:
                try:
                    response = client.models.generate_content(
                        model=m,
                        contents=contents,
                        config=agent_config,
                    )
                    model_name = m
                    model_label = f"Gemini ({m})"
                    break
                except Exception as exc:
                    last_err = exc
                    err_str = str(exc).lower()
                    print(f"[Nexus Failover] Model {m} failed ({err_str[:60]}), switching to next model in pool...")
                    # If high demand (503), rate limit (429), not found (404), or network glitch, try next model
                    if any(k in err_str for k in ["503", "unavailable", "demand", "429", "exhausted", "not_found", "aborted", "reset"]):
                        continue
                    break

            if not response:
                err_msg = f"Gemini API Error: {last_err}"
                safe_save_log(db, session_id, step_num, "Error", err_msg, "FAILED")
                await send_log(websocket, {"thought": err_msg, "status": "FAILED"})
                run_status = "FAILED"
                break

            thought, tool_calls, content_obj = extract_response_details(response)

            if thought:
                safe_save_log(db, session_id, step_num, "Thought", thought, "SUCCESS")
                step_num += 1
                await send_log(websocket, {
                    "thought": thought,
                    "model": model_label,
                    "status": "RUNNING",
                })

            # Check if Gemini completed without more tool calls
            if not tool_calls:
                final_answer = thought or "Goal successfully completed."
                safe_save_log(db, session_id, step_num, "Done", final_answer, "SUCCESS")
                await send_log(websocket, {
                    "thought": final_answer,
                    "final_answer": final_answer,
                    "model": model_label,
                    "status": "FINISH",
                })
                run_status = "SUCCESS"
                break

            # Process the tool call
            tool_call = tool_calls[0]
            func_name = tool_call.get("name")
            func_args = tool_call.get("arguments", {})

            # Append the model's turn to conversation history
            if content_obj:
                contents.append(content_obj)

            if func_name not in AVAILABLE_TOOLS_MAP:
                obs_err = f"Tool '{func_name}' is not supported in the browser bridge."
                contents.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=func_name,
                                response={"error": obs_err},
                            )
                        ],
                    )
                )
                continue

            # Generate internal bridge payload to send to Chrome extension
            tool_payload = AVAILABLE_TOOLS_MAP[func_name](**func_args)
            action_desc = f"{func_name}({func_args})"

            safe_save_log(db, session_id, step_num, "Action", action_desc, "RUNNING")
            step_num += 1

            await send_log(websocket, {
                "action": action_desc,
                "bridge_trigger": tool_payload,
                "model": model_label,
                "status": "RUNNING",
            })

            # Wait for execution observation from extension
            obs_raw = await websocket.receive_text()
            obs_data = json.loads(obs_raw)
            obs_payload = obs_data.get("payload", {})
            obs_result = obs_payload.get("observation", "Action executed in browser.")
            obs_status = obs_payload.get("status", "SUCCESS")

            safe_save_log(db, session_id, step_num, "Observation", str(obs_result), obs_status)
            step_num += 1

            # Feed observation back to Gemini
            contents.append(
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_function_response(
                            name=func_name,
                            response={"result": str(obs_result), "status": obs_status},
                        )
                    ],
                )
            )

        else:
            await send_log(websocket, {
                "thought": f"Reached maximum allowed steps ({MAX_AGENT_STEPS}).",
                "final_answer": "Execution stopped after maximum steps.",
                "status": "FINISH",
            })

    except Exception as e:
        print(f"WebSocket session error: {e}")
        try:
            await send_log(websocket, {"thought": f"Session error: {e}", "status": "FAILED"})
        except Exception:
            pass
    finally:
        try:
            exec_log = db.query(ExecutionLog).filter(ExecutionLog.session_id == session_id).first()
            if exec_log and exec_log.status == "RUNNING":
                exec_log.status = run_status
                db.commit()
        except Exception:
            pass
