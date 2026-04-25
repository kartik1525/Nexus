import json
import uuid
from json import JSONDecodeError

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import ExecutionLog, LogEntry
from services.llm import OpenRouterError, chat_completion, get_model_label
from tools import AVAILABLE_TOOLS_MAP, OPENROUTER_TOOLS

load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Nexus Agent Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_AUTH_TOKEN = "nexus-dev-token-xyz"
MAX_AGENT_STEPS = 20


@app.get("/")
def root():
    return {
        "status": "ok",
        "agent": "nexus-v1-openrouter",
        "model": get_model_label(),
    }


def save_log(db: Session, session_id: str, step_number: int, role: str, content: str, status: str) -> None:
    db.add(LogEntry(
        session_id=session_id,
        step_number=step_number,
        role=role,
        content=content,
        status=status,
    ))
    db.commit()


async def send_log(websocket: WebSocket, payload: dict):
    await websocket.send_text(json.dumps({"type": "LOG_ENTRY", "payload": payload}))


def decode_tool_args(raw_args: str | dict | None) -> dict:
    if raw_args is None:
        return {}
    if isinstance(raw_args, dict):
        return raw_args
    try:
        return json.loads(raw_args)
    except JSONDecodeError as exc:
        raise ValueError(f"Tool arguments were not valid JSON: {raw_args}") from exc


@app.websocket("/v1/ws/agent")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...), db: Session = Depends(get_db)):
    if token != STATIC_AUTH_TOKEN:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    session_id = str(uuid.uuid4())
    step_num = 1
    run_status = "RUNNING"

    try:
        data = await websocket.receive_text()
        message = json.loads(data)

        if message.get("type") != "TASK_REQUEST":
            await websocket.close()
            return

        payload = message.get("payload", {})
        task_content = payload.get("task", "")
        page_context = payload.get("page")

        db.add(ExecutionLog(session_id=session_id, task_request=task_content, status="RUNNING"))
        db.commit()

        await send_log(websocket, {
            "thought": f"Model: {get_model_label()}",
            "model": get_model_label(),
            "status": "RUNNING",
        })

        messages = [
            {
                "role": "system",
                "content": (
                    "You are Nexus Agent, a browser task execution agent. "
                    "Plan briefly, then call browser tools when action is required. "
                    "Use the provided page context first. "
                    "When the task is complete, answer the user directly without calling another tool."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Goal: {task_content}\n\n"
                    f"Current page context JSON:\n{json.dumps(page_context, ensure_ascii=False)[:16000]}"
                ),
            },
        ]

        for _ in range(MAX_AGENT_STEPS):
            try:
                llm_result = await chat_completion(messages, tools=OPENROUTER_TOOLS)
            except OpenRouterError as exc:
                run_status = "FAILED"
                error_text = str(exc)
                save_log(db, session_id, step_num, "Error", error_text, "FAILED")
                await send_log(websocket, {"thought": error_text, "status": "FAILED"})
                break

            model_label = llm_result["model_label"]
            thought = llm_result["content"]
            tool_calls = llm_result["tool_calls"]

            if thought:
                save_log(db, session_id, step_num, "Thought", thought, "SUCCESS")
                step_num += 1
                await send_log(websocket, {
                    "thought": thought,
                    "model": model_label,
                    "status": "SUCCESS",
                })

            if not tool_calls:
                run_status = "SUCCESS"
                exec_log = db.query(ExecutionLog).filter(ExecutionLog.session_id == session_id).first()
                if exec_log:
                    exec_log.status = "SUCCESS"
                    db.commit()

                final_answer = thought or "Task completed."
                await send_log(websocket, {
                    "thought": final_answer,
                    "final_answer": final_answer,
                    "model": model_label,
                    "status": "FINISH",
                })
                break

            tool_call = tool_calls[0]
            function_call = tool_call.get("function", {})
            func_name = function_call.get("name")

            try:
                func_args = decode_tool_args(function_call.get("arguments"))
            except ValueError as exc:
                run_status = "FAILED"
                await send_log(websocket, {"thought": str(exc), "status": "FAILED"})
                break

            messages.append({
                "role": "assistant",
                "content": thought or "",
                "tool_calls": [tool_call],
            })

            if func_name not in AVAILABLE_TOOLS_MAP:
                observation_text = f"Tool not found in registry: {func_name}"
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.get("id"),
                    "name": func_name,
                    "content": observation_text,
                })
                continue

            tool_internal_payload = AVAILABLE_TOOLS_MAP[func_name](**func_args)
            action_text = f"{func_name}({func_args})"
            save_log(db, session_id, step_num, "Action", action_text, "RUNNING")
            step_num += 1

            await send_log(websocket, {
                "action": action_text,
                "bridge_trigger": tool_internal_payload,
                "model": model_label,
                "status": "RUNNING",
            })

            obs_data = await websocket.receive_text()
            obs_message = json.loads(obs_data)
            observation_text = obs_message.get("payload", {}).get("observation", "No observation returned")
            success_str = obs_message.get("payload", {}).get("status", "SUCCESS")

            save_log(db, session_id, step_num, "Observation", observation_text, success_str)
            step_num += 1

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.get("id"),
                "name": func_name,
                "content": json.dumps({
                    "result": observation_text,
                    "status": success_str,
                }),
            })
        else:
            run_status = "FAILED"
            await send_log(websocket, {
                "thought": f"Stopped after {MAX_AGENT_STEPS} model/tool iterations.",
                "status": "FAILED",
            })

    except Exception as general_err:
        run_status = "FAILED"
        print(f"Exception during task stream: {general_err}")
        try:
            await send_log(websocket, {"thought": f"Backend error: {general_err}", "status": "FAILED"})
        except Exception:
            pass
    finally:
        exec_log = db.query(ExecutionLog).filter(ExecutionLog.session_id == session_id).first()
        if exec_log and exec_log.status == "RUNNING":
            exec_log.status = "DISCONNECTED" if run_status == "RUNNING" else run_status
            db.commit()
