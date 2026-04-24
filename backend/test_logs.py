from database import engine, SessionLocal, Base
from models import ExecutionLog, LogEntry
import uuid

# Re-init db schema
Base.metadata.create_all(bind=engine)
db = SessionLocal()

def run_checks():
    new_uuid = str(uuid.uuid4())
    print(f"Creating mock task for execution session {new_uuid}...")
    
    # Create execution log
    db.add(ExecutionLog(session_id=new_uuid, task_request="Find best coffee shops", status="RUNNING"))
    db.commit()
    
    # Add steps
    db.add(LogEntry(session_id=new_uuid, step_number=1, role="Thought", content="Starting search", status="SUCCESS"))
    db.add(LogEntry(session_id=new_uuid, step_number=2, role="Action", content="read_dom('.coffee')", status="SUCCESS"))
    db.commit()

    # Query
    entry = db.query(ExecutionLog).filter(ExecutionLog.session_id == new_uuid).first()
    assert entry.task_request == "Find best coffee shops", "Execution record mismatch"
    
    logs = db.query(LogEntry).filter(LogEntry.session_id == new_uuid).order_by(LogEntry.step_number).all()
    assert len(logs) == 2, "Log count mismatch"
    assert logs[0].role == "Thought", "Role mismatch"
    
    print("Integration checks passed!")

if __name__ == "__main__":
    run_checks()
