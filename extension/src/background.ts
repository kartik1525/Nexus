// This is the background service worker
declare var chrome: any;

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: any) => console.error(error));

console.log("Nexus Agent Service Worker Initialized");

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
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
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
        sendResponse({ success: true, image: dataUrl });
      });
      return true;
    }
  } catch (err: any) {
    sendResponse({ success: false, error: err.toString() });
  }
});
