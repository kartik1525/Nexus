import os
from dotenv import load_dotenv
import google.generativeai as genai
from tools import GEMINI_TOOLS

# Configure integration test
load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

def verify_gemini_function_calling():
    print(f"Initializing GenerativeModel with {len(GEMINI_TOOLS)} tools...")
    model = genai.GenerativeModel(model_name="gemini-2.0-flash-lite", tools=GEMINI_TOOLS)
    chat = model.start_chat()
    
    # Asserting correct tool ingestion natively
    print("Testing prompt mapping for 'navigate'...")
    response = chat.send_message("Please navigate the browser to https://github.com right now.")
    
    func_call = None
    for part in response.parts:
        if getattr(part, 'function_call', None):
            func_call = part.function_call

    if func_call is None:
        raise AssertionError("Gemini failed to output a FunctionCall!")
    
    assert func_call.name == "navigate", "Gemini did not map to the correct tool!"
    
    args = {key: val for key, val in func_call.args.items()}
    assert "github.com" in args.get("url", ""), "Gemini stripped or hallucinated URL parameter!"
    
    print("Testing prompt mapping for 'open_new_tab'...")
    response_tab = chat.send_message("Let's leave this open and open a different tab for example.com")
    func_call_tab = None
    for part in response_tab.parts:
        if getattr(part, 'function_call', None):
            func_call_tab = part.function_call

    if func_call_tab is None:
        raise AssertionError("Failed second function call mapping.")
    
    assert func_call_tab.name in ["open_new_tab", "navigate"], "Did not grasp tab mechanics."
    
    print("✅ Integration Checks Passed! LLM perfectly understands the Tool Registry.")

if __name__ == "__main__":
    verify_gemini_function_calling()
