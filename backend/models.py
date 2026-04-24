from sqlalchemy import Column, Integer, String, Text, DateTime
from database import Base
import datetime

class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    task_request = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String)
    
class LogEntry(Base):
    __tablename__ = "log_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    step_number = Column(Integer)
    role = Column(String) # Thought, Action, Observation
    content = Column(Text)
    status = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class SelectorCache(Base):
    __tablename__ = "selector_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, index=True)
    element_intent = Column(String)
    successful_selector = Column(String)
    last_used = Column(DateTime, default=datetime.datetime.utcnow)
