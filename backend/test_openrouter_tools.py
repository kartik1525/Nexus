from tools import AVAILABLE_TOOLS_MAP, OPENROUTER_TOOLS


def verify_tool_registry():
    tool_names = {
        tool["function"]["name"]
        for tool in OPENROUTER_TOOLS
    }

    missing_handlers = tool_names - set(AVAILABLE_TOOLS_MAP)
    missing_schemas = set(AVAILABLE_TOOLS_MAP) - tool_names

    assert not missing_handlers, f"Missing handlers for tool schemas: {missing_handlers}"
    assert not missing_schemas, f"Missing OpenRouter schemas for handlers: {missing_schemas}"
    print(f"OpenRouter tool registry valid: {len(tool_names)} tools")


if __name__ == "__main__":
    verify_tool_registry()
