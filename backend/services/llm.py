import json
import os
import asyncio
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "mistralai/mistral-7b-instruct-v0.3"
CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "llm.json"


class OpenRouterError(RuntimeError):
    pass


def load_llm_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {"model": DEFAULT_MODEL}

    with CONFIG_PATH.open("r", encoding="utf-8") as config_file:
        config = json.load(config_file)

    return {"model": config.get("model") or DEFAULT_MODEL}


def get_llm_model() -> str:
    return os.environ.get("OPENROUTER_MODEL") or load_llm_config()["model"]


def get_model_label(model: str | None = None) -> str:
    selected_model = model or get_llm_model()
    model_name = selected_model.split("/")[-1].replace("-", " ").title()
    return f"{model_name} (via OpenRouter)"


def _headers() -> dict[str, str]:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise OpenRouterError("OPENROUTER_API_KEY is not configured.")

    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.environ.get("OPENROUTER_HTTP_REFERER", "http://localhost"),
        "X-Title": os.environ.get("OPENROUTER_APP_TITLE", "Nexus Agent"),
    }


def _format_error(status_code: int, data: Any) -> str:
    message = data
    if isinstance(data, dict):
        message = data.get("error", {}).get("message") or data.get("message") or data

    if status_code in (401, 403):
        return f"OpenRouter authentication failed: {message}"
    if status_code == 429:
        return f"OpenRouter rate limit reached: {message}"

    return f"OpenRouter request failed with HTTP {status_code}: {message}"


async def chat_completion(
    messages: list[dict[str, Any]],
    *,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | dict[str, Any] = "auto",
) -> dict[str, Any]:
    model = get_llm_model()
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
    }

    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = tool_choice

    try:
        data = await asyncio.to_thread(_post_openrouter, payload)
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        try:
            error_data = json.loads(error_body)
        except ValueError:
            error_data = error_body
        raise OpenRouterError(_format_error(exc.code, error_data)) from exc
    except URLError as exc:
        raise OpenRouterError(f"Could not connect to OpenRouter: {exc.reason}") from exc

    choices = data.get("choices") if isinstance(data, dict) else None
    if not choices:
        raise OpenRouterError("OpenRouter returned an empty choices array.")

    message = choices[0].get("message") or {}
    content = message.get("content") or ""
    tool_calls = message.get("tool_calls") or []

    if not content and not tool_calls:
        raise OpenRouterError("OpenRouter returned an empty message.")

    return {
        "content": content,
        "tool_calls": tool_calls,
        "model": data.get("model", model),
        "model_label": get_model_label(data.get("model", model)),
        "raw": data,
    }


async def generateLLM(prompt: str) -> str:
    result = await chat_completion([
        {"role": "user", "content": prompt}
    ])
    return result["content"]


generate_llm = generateLLM


def _post_openrouter(payload: dict[str, Any]) -> dict[str, Any]:
    request = Request(
        OPENROUTER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=_headers(),
        method="POST",
    )

    with urlopen(request, timeout=120) as response:
        body = response.read().decode("utf-8")

    return json.loads(body)
