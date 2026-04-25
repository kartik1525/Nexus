import httpx
import json
import os

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

async def generate_with_local_llm(messages: list, model: str = "llama3") -> dict:
    """
    Calls the Ollama API natively with the given chat history and model.
    Forces JSON output.
    Returns a parsed dictionary, or raises an Exception if invalid or timed out.
    """
    url = f"{OLLAMA_BASE_URL}/api/chat"
    
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "format": "json"
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            message_content = data.get("message", {}).get("content", "")
            
            if not message_content:
                raise ValueError("Ollama returned an empty response.")
                
            try:
                parsed_json = json.loads(message_content)
                return parsed_json
            except json.JSONDecodeError as e:
                # If the model hallucinates non-JSON despite `format="json"`
                raise ValueError(f"Failed to parse LLM output as JSON. Output was: {message_content}")
                
    except httpx.ConnectError:
        raise ConnectionError(f"Could not connect to Ollama at {OLLAMA_BASE_URL}. Is it running?")
    except httpx.TimeoutException:
        raise TimeoutError("Ollama API timed out while generating response.")
    except Exception as e:
        raise RuntimeError(f"Ollama API Error: {str(e)}")
