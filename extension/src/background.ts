// Nexus Agent Background Service Worker
declare var chrome: any;

// Configure Chrome Side Panel to open upon clicking the action icon
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: any) => {
  console.warn("[Nexus Agent] Side panel behavior setup warning:", err);
});

console.log("[Nexus Agent] Service Worker Initialized");

const DOM_ACTIONS = ["extract_page", "read_dom", "click_element", "fill_form_field", "scroll_page"];

// Listen for messages from Side Panel to perform browser & tab orchestration
chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (response?: any) => void) => {
  try {
    // 1. Navigation Control
    if (message.action === "navigate") {
      let targetUrl = message.url || "";
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = "https://" + targetUrl;
      }

      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs: any[]) => {
        if (tabs && tabs.length > 0 && tabs[0].id) {
          chrome.tabs.update(tabs[0].id, { url: targetUrl }, () => {
            sendResponse({ success: true, status: `navigated_to_${targetUrl}` });
          });
        } else {
          sendResponse({ success: false, error: "No active tab found to navigate." });
        }
      });
      return true; // Keep message port open
    }

    // 2. Open New Tab
    if (message.action === "open_new_tab") {
      let targetUrl = message.url || "about:blank";
      if (targetUrl !== "about:blank" && !targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = "https://" + targetUrl;
      }
      chrome.tabs.create({ url: targetUrl, active: true }, (tab: any) => {
        sendResponse({ success: true, status: "tab_opened", tabId: tab.id });
      });
      return true;
    }

    // 3. Switch Tab
    if (message.action === "switch_tab") {
      chrome.tabs.update(message.tabId, { active: true }, () => {
        sendResponse({ success: true, status: `switched_to_tab_${message.tabId}` });
      });
      return true;
    }

    // 4. Forward DOM / Page Actions to Active Tab Content Script
    if (DOM_ACTIONS.includes(message.action)) {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs: any[]) => {
        if (!tabs || tabs.length === 0 || !tabs[0].id) {
          sendResponse({ success: false, error: "No active browser tab found." });
          return;
        }

        const tabId = tabs[0].id;

        // Send to content script
        chrome.tabs.sendMessage(tabId, message, (response: any) => {
          if (chrome.runtime.lastError) {
            // Content script might not be injected yet (e.g. if the tab was loaded before extension install)
            // Attempt to dynamically execute content script then retry
            chrome.scripting.executeScript(
              {
                target: { tabId },
                files: ["src/content.ts"],
              },
              () => {
                if (chrome.runtime.lastError) {
                  sendResponse({
                    success: false,
                    error: `Cannot inject script into this page (${chrome.runtime.lastError.message}). Note: Chrome Web Store and chrome:// URLs cannot be scripted.`,
                  });
                } else {
                  // Retry sending message after script injection
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, message, (retryResponse: any) => {
                      if (chrome.runtime.lastError) {
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                      } else {
                        sendResponse(retryResponse);
                      }
                    });
                  }, 150);
                }
              }
            );
          } else {
            sendResponse(response);
          }
        });
      });
      return true;
    }

    sendResponse({ success: false, error: `Unhandled action: ${message.action}` });
    return false;
  } catch (err: any) {
    sendResponse({ success: false, error: err.toString() });
    return false;
  }
});
