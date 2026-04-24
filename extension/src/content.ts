console.log("Nexus Agent Content Script Loaded");

declare var chrome: any;

chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (response?: any) => void) => {
  try {
    switch (message.action) {
      case 'read_dom': {
        const el = document.querySelector(message.selector);
        sendResponse({ success: true, text: el?.textContent || null });
        break;
      }
      case 'click_element': {
        const el = document.querySelector(message.selector) as HTMLElement;
        if (el) {
          el.click();
          sendResponse({ success: true, status: 'clicked' });
        } else {
          sendResponse({ success: false, error: 'element not found' });
        }
        break;
      }
      case 'fill_form_field': {
        const el = document.querySelector(message.selector) as HTMLInputElement;
        if (el) {
          el.value = message.value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          sendResponse({ success: true, status: 'filled' });
        } else {
          sendResponse({ success: false, error: 'element not found' });
        }
        break;
      }
      default:
        sendResponse({ success: false, error: 'unknown action' });
    }
  } catch (error: any) {
    sendResponse({ success: false, error: error.toString() });
  }
  return true; // Keep message channel open for async response if needed
});
