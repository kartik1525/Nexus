// This is the background service worker
declare var chrome: any;

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: any) => console.error(error));

console.log("Nexus Agent Service Worker Initialized");

const DOM_ACTIONS = ['extract_page', 'read_dom', 'click_element', 'fill_form_field', 'scroll_to_element'];

// Listen for messages from the Side Panel or Backend to coordinate tab-level commands
chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (response?: any) => void) => {
  try {
    if (message.action === 'navigate') {
      const targetUrl = message.url;
      const targetTabId = message.tabId; // Optional target tab
      
      if (targetTabId) {
        chrome.tabs.update(targetTabId, { url: targetUrl }, () => {
          sendResponse({ success: true, status: 'navigating_specific_tab' });
        });
      } else {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs: any) => {
          if (tabs.length > 0 && tabs[0].id) {
            chrome.tabs.update(tabs[0].id, { url: targetUrl }, () => {
              sendResponse({ success: true, status: 'navigating_active_tab' });
            });
          } else {
            sendResponse({ success: false, error: 'no active tab found' });
          }
        });
      }
      return true; // keep channel open
    }
    
    if (message.action === 'open_new_tab') {
      chrome.tabs.create({ url: message.url, active: message.active !== false }, (tab: any) => {
        sendResponse({ success: true, tabId: tab.id });
      });
      return true;
    }
    
    if (message.action === 'switch_tab') {
      chrome.tabs.update(message.tabId, { active: true }, () => {
        sendResponse({ success: true, status: 'switched' });
      });
      return true;
    }
    
    if (message.action === 'close_tab') {
      chrome.tabs.remove(message.tabId, () => {
        sendResponse({ success: true, status: 'closed' });
      });
      return true;
    }

    if (message.action === 'take_screenshot') {
      chrome.tabs.captureVisibleTab(null, {format: 'png'}, (dataUrl: string) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, image: dataUrl });
        }
      });
      return true;
    }

    // Forward DOM Actions to the active Tab Content Script
    if (DOM_ACTIONS.includes(message.action)) {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs: any) => {
        if (tabs.length > 0 && tabs[0].id) {
          const targetTabId = tabs[0].id;
          chrome.tabs.sendMessage(targetTabId, message, (response: any) => {
             if (chrome.runtime.lastError) {
                // Fallback for pages where the content script was not already injected.
                if (message.action === 'read_dom' || message.action === 'extract_page') {
                   chrome.scripting.executeScript({
                       target: {tabId: targetTabId},
                       func: (action: string, selector?: string) => {
                           if (action === 'extract_page') {
                               const main =
                                   document.querySelector('main') ||
                                   document.querySelector('article') ||
                                   document.body;

                               const links = Array.from(document.querySelectorAll('a[href]'))
                                   .map((el) => {
                                       const anchor = el as HTMLAnchorElement;
                                       return { text: anchor.innerText.trim(), href: anchor.href };
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
                                       headings: Array.from(document.querySelectorAll('h1,h2,h3'))
                                           .map((el) => (el as HTMLElement).innerText.trim())
                                           .filter(Boolean)
                                           .slice(0, 40),
                                       links,
                                       inputs,
                                       text: (main?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 12000)
                                   }
                               };
                           }

                           const el = document.querySelector(selector || '') as HTMLElement;
                           return { success: true, text: el ? el.innerText : null };
                       },
                       args: [message.action, message.selector]
                   }, (injectionResults: any) => {
                       if (chrome.runtime.lastError) {
                           sendResponse({ success: false, error: chrome.runtime.lastError.message });
                       } else if (injectionResults && injectionResults[0]) {
                           sendResponse(injectionResults[0].result);
                       } else {
                           sendResponse({ success: false, error: 'No injection result returned' });
                       }
                   });
                } else {
                   sendResponse({ success: false, error: chrome.runtime.lastError.message });
                }
             } else {
                sendResponse(response);
             }
          });
        } else {
          sendResponse({ success: false, error: 'no active tab found to execute DOM action' });
        }
      });
      return true; // async
    }

    sendResponse({ success: false, error: `unknown background action: ${message.action}` });
    return false;

  } catch (err: any) {
    sendResponse({ success: false, error: err.toString() });
  }
});
