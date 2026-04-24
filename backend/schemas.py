from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class TaskRequest(BaseModel):
    task: str

class AgentAction(BaseModel):
    tool: str
    params: Dict[str, Any]

class Observation(BaseModel):
    result: str
