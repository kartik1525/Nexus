"""Browser automation tools exposed to Google Gemini.
Each tool function returns the JSON payload dispatched to the Chrome Extension bridge.
"""
from typing import Optional, Dict, Any


def read_dom(selector: str) -> Dict[str, Any]:
    """Reads text content and attributes from the active page element matching a CSS selector.
    
    Args:
        selector: CSS selector of the element to read (e.g., 'h1', '#main-content', '.price-tag').
    """
    return {"action": "read_dom", "selector": selector}


def extract_page() -> Dict[str, Any]:
    """Extracts the entire active web page structure including title, URL, headings, interactive elements, forms, and main body text."""
    return {"action": "extract_page"}


def click_element(selector: str = "", text: str = "") -> Dict[str, Any]:
    """Clicks an element in the active browser tab. You can provide a CSS selector, a visible text label, or both.
    
    Args:
        selector: CSS selector for the element (e.g. 'button.submit', '#login-btn', 'a.next-page').
        text: Visible text of the button/link to click if selector is unknown or general (e.g. 'Sign In', 'Search').
    """
    return {"action": "click_element", "selector": selector, "text": text}


def fill_form_field(selector: str, value: str, submit: bool = False) -> Dict[str, Any]:
    """Fills an input field, search box, or textarea with the provided value.
    
    Args:
        selector: CSS selector, placeholder, name, or id of the input (e.g., 'input[name=\"q\"]', '#search', 'textarea').
        value: Text string to enter into the field.
        submit: If True, simulates pressing the Enter key to automatically submit the form after typing.
    """
    return {"action": "fill_form_field", "selector": selector, "value": value, "submit": submit}


def navigate(url: str) -> Dict[str, Any]:
    """Navigates the current browser tab to a specified URL.
    
    Args:
        url: Full web address to navigate to (e.g., 'https://wikipedia.org', 'https://google.com').
    """
    return {"action": "navigate", "url": url}


def open_new_tab(url: str) -> Dict[str, Any]:
    """Opens a new browser tab with the specified URL.
    
    Args:
        url: URL to open in a new tab.
    """
    return {"action": "open_new_tab", "url": url}


def scroll_page(direction: str = "down") -> Dict[str, Any]:
    """Scrolls the current viewport up or down to inspect more page content.
    
    Args:
        direction: 'down' or 'up'.
    """
    return {"action": "scroll_page", "direction": direction}


BROWSER_TOOLS = [
    read_dom,
    extract_page,
    click_element,
    fill_form_field,
    navigate,
    open_new_tab,
    scroll_page,
]

AVAILABLE_TOOLS_MAP = {
    "read_dom": read_dom,
    "extract_page": extract_page,
    "click_element": click_element,
    "fill_form_field": fill_form_field,
    "navigate": navigate,
    "open_new_tab": open_new_tab,
    "scroll_page": scroll_page,
}
