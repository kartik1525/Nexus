import json

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

def notion_create_page(title: str, content: str = "") -> dict:
    """A mock API action representing creating a Notion documentation page with a title and content."""
    return {"action": "notion_create_page", "title": title, "content": content}

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


GEMINI_TOOLS = [
    read_dom, click_element, fill_form_field, navigate,
    notion_create_page, open_new_tab, switch_tab, close_tab,
    scroll_to_element, take_screenshot
]

AVAILABLE_TOOLS_MAP = {func.__name__: func for func in GEMINI_TOOLS}
