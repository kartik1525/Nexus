import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from google import genai
from google.genai import types

from tools import BROWSER_TOOLS

load_dotenv()

DEFAULT_MODEL = "gemini-2.5-flash"
CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "llm.json"


class GeminiError(RuntimeError):
    pass


def load_model_config() -> str:
    if os.environ.get("GEMINI_MODEL"):
        return os.environ["GEMINI_MODEL"]
    if CONFIG_PATH.exists():
        try:
            with CONFIG_PATH.open("r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("model") or DEFAULT_MODEL
        except Exception:
            pass
    return DEFAULT_MODEL


def get_model_name() -> str:
    return load_model_config()


def get_model_label() -> str:
    model = get_model_name()
    return f"Gemini ({model})"


def get_gemini_client(api_key: Optional[str] = None) -> genai.Client:
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key or key.strip() == "" or "your_gemini_api_key" in key:
        raise GeminiError(
            "GEMINI_API_KEY is not configured. Please add your Gemini API Key to backend/.env (Get a free key at https://aistudio.google.com/)."
        )
    return genai.Client(api_key=key.strip())


SYSTEM_INSTRUCTION = """You are Nexus Agent, an autonomous browser automation co-pilot operating directly inside Google Chrome.

Your primary mission is to help the user perform web actions quickly and accurately:
1. DOM Reading: Scan active page structure, read text, headings, links, and specific element content (extract_page, read_dom).
2. Element Interaction: Click buttons, links, toggles, or navigation items by CSS selector or visible text (click_element).
3. Form Filling: Type search terms, login credentials, form inputs, and optionally submit with Enter (fill_form_field).
4. Navigation Control: Navigate to any target URL or open new tabs (navigate, open_new_tab).
5. Page Scrolling: Scroll down or up to explore dynamic or infinite-scroll pages (scroll_page).

Guidelines:
- Review the current page context provided in the conversation.
- Call the most suitable browser tool to make progress towards the goal.
- If a CSS selector might be dynamic, use clear selectors or supply the button/link text.
- If form input requires submitting a search, set submit=True in fill_form_field.
- When the goal is completed, provide a concise, helpful summary to the user without calling another tool.
"""


def create_agent_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        tools=BROWSER_TOOLS,
        temperature=0.2,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )


def extract_response_details(response: Any) -> Tuple[Optional[str], List[Dict[str, Any]], Any]:
    """Extracts text thought/content, function calls, and candidate content object from Gemini response."""
    thought = ""
    tool_calls = []
    content_obj = None

    if not response.candidates:
        return None, [], None

    candidate = response.candidates[0]
    content_obj = candidate.content

    if content_obj and content_obj.parts:
        for part in content_obj.parts:
            # Check for text or thought
            if getattr(part, "text", None):
                thought += part.text + "\n"
            # Check for function call
            if getattr(part, "function_call", None):
                fc = part.function_call
                args = fc.args if isinstance(fc.args, dict) else dict(fc.args or {})
                tool_calls.append({
                    "name": fc.name,
                    "arguments": args,
                })

    thought = thought.strip() if thought else None
    return thought, tool_calls, content_obj
