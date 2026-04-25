def read_dom(selector: str) -> dict:
    """Scans and extracts the textual data from the active browser tab elements matching the given CSS selector."""
    return {"action": "read_dom", "selector": selector}

def click_element(selector: str) -> dict:
    """Invokes a native mouse click event on the browser element matching the CSS selector."""
    return {"action": "click_element", "selector": selector}

def fill_form_field(selector: str, value: str) -> dict:
    """Enters the provided string value into the input field or text area matched by the CSS selector."""
    return {"action": "fill_form_field", "selector": selector, "value": value}

def navigate(url: str, tabId: int = None) -> dict:
    """Redirects the browser tab to the requested URL. Specify tabId if orchestrating multiple tabs."""
    return {"action": "navigate", "url": url, "tabId": tabId}

def open_new_tab(url: str, active: bool = True) -> dict:
    """Opens the specified URL in a completely new Chrome Browser Tab. Set active to interact with it immediately."""
    return {"action": "open_new_tab", "url": url, "active": active}

def switch_tab(tabId: int) -> dict:
    """Switches the browser's focus to the requested tabId."""
    return {"action": "switch_tab", "tabId": tabId}

def close_tab(tabId: int) -> dict:
    """Closes the specified browser tab by its tabId."""
    return {"action": "close_tab", "tabId": tabId}

def scroll_to_element(selector: str) -> dict:
    """Scrolls the current viewport so the matching CSS selector element is in full view."""
    return {"action": "scroll_to_element", "selector": selector}

def take_screenshot() -> dict:
    """Captures a base64 encoded PNG snapshot of the entire active browser viewport. Use this when DOM selectors fail or to acquire vision bounding boxes."""
    return {"action": "take_screenshot"}


OPENROUTER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_dom",
            "description": "Extracts text from the active browser tab element matching a CSS selector.",
            "parameters": {
                "type": "object",
                "properties": {"selector": {"type": "string"}},
                "required": ["selector"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "click_element",
            "description": "Clicks an element in the active browser tab matching a CSS selector.",
            "parameters": {
                "type": "object",
                "properties": {"selector": {"type": "string"}},
                "required": ["selector"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "fill_form_field",
            "description": "Fills an input or text area matching a CSS selector.",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string"},
                    "value": {"type": "string"},
                },
                "required": ["selector", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "navigate",
            "description": "Navigates the active tab, or a specific tab, to a URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "tabId": {"type": ["integer", "null"]},
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_new_tab",
            "description": "Opens a URL in a new Chrome tab.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "active": {"type": "boolean"},
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "switch_tab",
            "description": "Switches focus to an existing tab ID.",
            "parameters": {
                "type": "object",
                "properties": {"tabId": {"type": "integer"}},
                "required": ["tabId"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "close_tab",
            "description": "Closes an existing tab ID.",
            "parameters": {
                "type": "object",
                "properties": {"tabId": {"type": "integer"}},
                "required": ["tabId"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "scroll_to_element",
            "description": "Scrolls the matching element into view.",
            "parameters": {
                "type": "object",
                "properties": {"selector": {"type": "string"}},
                "required": ["selector"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "take_screenshot",
            "description": "Captures a PNG screenshot of the visible active tab.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]

AVAILABLE_TOOLS_MAP = {
    "read_dom": read_dom,
    "click_element": click_element,
    "fill_form_field": fill_form_field,
    "navigate": navigate,
    "open_new_tab": open_new_tab,
    "switch_tab": switch_tab,
    "close_tab": close_tab,
    "scroll_to_element": scroll_to_element,
    "take_screenshot": take_screenshot,
}
