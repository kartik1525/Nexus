import os
import json
import asyncio
import uuid
from dotenv import load_dotenv

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import google.generativeai as genai

from database import engine, Base, get_db
from models import ExecutionLog, LogEntry, SelectorCache
from tools import GEMINI_TOOLS, AVAILABLE_TOOLS_MAP
import datetime

# Load Environment Variables & Gemini API
load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Initialize DB tables
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

MAX_HISTORY_STEPS = 20

@app.get("/")
def root():
    return {"status": "ok", "agent": "nexus-v1-beta-gemini"}

@app.websocket("/v1/ws/agent")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...), db: Session = Depends(get_db)):
    if token != STATIC_AUTH_TOKEN:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    session_id = str(uuid.uuid4())
    step_num = 1
    
    model = genai.GenerativeModel(model_name="gemini-2.5-flash", tools=GEMINI_TOOLS)
    
    try:
        data = await websocket.receive_text()
        message = json.loads(data)
        
        if message.get("type") == "TASK_REQUEST":
            task_content = message.get("payload", {}).get("task", "")
            
            # Persist Task
            new_exec = ExecutionLog(session_id=session_id, task_request=task_content, status="RUNNING")
            db.add(new_exec)
            db.commit()

            # Init chat
            chat = model.start_chat()
            
            # Prime the loop with the initial task
            prompt = f"Goal: {task_content}. Decompose the task and use your browser tools effectively."
            
            while True:
                # Prevent runaway context bloat
                if len(chat.history) > MAX_HISTORY_STEPS * 2:
                    chat.history = chat.history[(-1 * MAX_HISTORY_STEPS * 2):]
                
                try:
                    response = await chat.send_message_async(prompt)
                except Exception as e:
                    await websocket.send_text(json.dumps({"type": "LOG_ENTRY", "payload": {"thought": f"API Error: {str(e)}", "status": "FAILED"}}))
                    break

                # Stream the general text thought
                func_call = None
                if response.parts:
                    for part in response.parts:
                        if part.text:
                            # Log Thought
                            log_th = LogEntry(session_id=session_id, step_number=step_num, role="Thought", content=part.text, status="SUCCESS")
                            db.add(log_th)
                            db.commit()
                            step_num += 1
                            await websocket.send_text(json.dumps({"type": "LOG_ENTRY", "payload": {"thought": part.text, "status": "SUCCESS"}}))
                        
                        # Note: We must check type of the part or just safely check for function_call
                        if getattr(part, 'function_call', None):
                            func_call = part.function_call

                # Handle Function Calling
                if func_call:
                    func_name = func_call.name
                    func_args = {key: val for key, val in func_call.args.items()}
                    
                    # Log Attempting Action
                    log_ac = LogEntry(session_id=session_id, step_number=step_num, role="Action", content=f"{func_name}({func_args})", status="RUNNING")
                    db.add(log_ac)
                    db.commit()
                    step_num += 1
                    
                    if func_name in AVAILABLE_TOOLS_MAP:
                        # Map params via our tools wrapper to generate WSS UI action json
                        tool_internal_payload = AVAILABLE_TOOLS_MAP[func_name](**func_args)
                        
                        # Forward action payload to Browser Node
                        await websocket.send_text(json.dumps({
                            "type": "LOG_ENTRY", 
                            "payload": {"action": log_ac.content, "status": "RUNNING", "bridge_trigger": tool_internal_payload}
                        }))
                        
                        # Wait for Extension to execute DOM commands and send back observation
                        obs_data = await websocket.receive_text()
                        obs_message = json.loads(obs_data)
                        
                        observation_text = obs_message.get("payload", {}).get("observation", "No observation returned")
                        success_str = obs_message.get("payload", {}).get("status", "SUCCESS")
                        
                        # Pass back result as the next prompt
                        prompt = {"function_response": {"name": func_name, "response": {"result": observation_text, "status": success_str}}}
                        
                        # Log Observation
                        log_ob = LogEntry(session_id=session_id, step_number=step_num, role="Observation", content=observation_text, status=success_str)
                        db.add(log_ob)
                        db.commit()
                        step_num += 1
                    else:
                        prompt = {"function_response": {"name": func_name, "response": {"error": "Tool not found in registry"}}}
                
                else: 
                    # If LLM finishes reasoning and doesn't call a function, it means it considers the goal achieved or requires human input.
                    exec_log = db.query(ExecutionLog).filter(ExecutionLog.session_id == session_id).first()
                    exec_log.status = "SUCCESS"
                    db.commit()
                    await websocket.send_text(json.dumps({"type": "LOG_ENTRY", "payload": {"thought": "Task completion logic reached by Agent.", "status": "FINISH"}}))
                    break
        else:
             await websocket.close()
             
    except Exception as general_err:
        print(f"Exception during task stream: {general_err}")
    finally:
        # Mark as done / disconnected
        exec_log = db.query(ExecutionLog).filter(ExecutionLog.session_id == session_id).first()
        if exec_log and exec_log.status == "RUNNING":
            exec_log.status = "DISCONNECTED"
            db.commit()
