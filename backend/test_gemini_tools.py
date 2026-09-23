from tools import AVAILABLE_TOOLS_MAP, BROWSER_TOOLS
from services.gemini import create_agent_config, get_model_label


def test_gemini_tools():
    config = create_agent_config()
    assert config.tools is not None, "Tools should be configured"
    assert len(config.tools) == len(BROWSER_TOOLS), "All tools should be present"
    
    expected_tools = [
        "read_dom",
        "extract_page",
        "click_element",
        "fill_form_field",
        "navigate",
        "open_new_tab",
        "scroll_page",
    ]
    for tool_name in expected_tools:
        assert tool_name in AVAILABLE_TOOLS_MAP, f"Missing tool in AVAILABLE_TOOLS_MAP: {tool_name}"
    
    print(f"Gemini tools verified! Model: {get_model_label()}, Available tools: {list(AVAILABLE_TOOLS_MAP.keys())}")


if __name__ == "__main__":
    test_gemini_tools()
