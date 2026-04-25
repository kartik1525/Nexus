console.log("Nexus Agent Content Script Loaded");

declare var chrome: any;

const extractPageContent = () => {
  const main =
    document.querySelector('main') ||
    document.querySelector('article') ||
    document.body;

  const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
    .map((el) => (el as HTMLElement).innerText.trim())
    .filter(Boolean)
    .slice(0, 40);

  const links = Array.from(document.querySelectorAll('a[href]'))
    .map((el) => {
      const anchor = el as HTMLAnchorElement;
      return {
        text: anchor.innerText.trim(),
        href: anchor.href,
      };
    })
    .filter((link) => link.text && link.href)
    .slice(0, 80);

  const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
    .map((el) => {
      const field = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      return {
        tag: field.tagName.toLowerCase(),
        type: field instanceof HTMLInputElement ? field.type : undefined,
        name: field.getAttribute('name'),
        id: field.id || undefined,
        placeholder: field.getAttribute('placeholder'),
        ariaLabel: field.getAttribute('aria-label'),
      };
    })
    .slice(0, 80);

  return {
    success: true,
    page: {
      title: document.title,
      url: location.href,
      headings,
      links,
      inputs,
      text: (main?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 12000),
    },
  };
};

const getSelector = (selector: any): string => {
  if (typeof selector === 'string') return selector;
  if (selector == null) return '';
  return String(selector);
};

const queryElement = (selector: any): HTMLElement | null => {
  const safeSelector = getSelector(selector);
  if (!safeSelector.trim()) return null;
  return document.querySelector(safeSelector) as HTMLElement;
};

chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (response?: any) => void) => {
  try {
    switch (message.action) {
      case 'extract_page': {
        sendResponse(extractPageContent());
        break;
      }
      case 'read_dom': {
        const el = queryElement(message.selector);
        sendResponse({ success: true, text: el ? el.innerText : null });
        break;
      }
      case 'click_element': {
        const el = queryElement(message.selector);
        if (el) {
          el.click();
          sendResponse({ success: true, status: 'clicked' });
        } else {
          sendResponse({ success: false, error: 'element not found' });
        }
        break;
      }
      case 'fill_form_field': {
        const el = queryElement(message.selector) as HTMLInputElement | null;
        if (el) {
          el.value = message.value == null ? '' : String(message.value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          sendResponse({ success: true, status: 'filled' });
        } else {
          sendResponse({ success: false, error: 'element not found' });
        }
        break;
      }
      case 'scroll_to_element': {
        const el = queryElement(message.selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          sendResponse({ success: true, status: 'scrolled' });
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
