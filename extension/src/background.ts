// Nexus Agent Background Service Worker
declare var chrome: any;

// Configure Chrome Side Panel to open upon clicking the extension toolbar icon
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: any) => {
  console.warn("[Nexus Agent] Side panel behavior setup warning:", err);
});

console.log("[Nexus Agent] Service Worker Initialized");

// Auto-inject content script into open tabs upon extension reload / installation
chrome.runtime.onInstalled?.addListener(() => {
  try {
    const manifest = chrome.runtime.getManifest();
    const scriptFile = manifest.content_scripts?.[0]?.js?.[0];
    if (!scriptFile) return;

    chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs: any[]) => {
      for (const tab of tabs || []) {
        if (tab.id) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [scriptFile],
          }).catch(() => {});
        }
      }
    });
  } catch (e) {
    console.warn("[Nexus Agent] onInstalled script injection:", e);
  }
});

const DOM_ACTIONS = ["extract_page", "read_dom", "click_element", "fill_form_field", "scroll_page"];

/**
 * Universal in-tab DOM executor function.
 * Injected dynamically via func: so it works on any tab without requiring file path lookups.
 */
function runDomActionInline(message: any) {
  try {
    const sel = (message.selector || "").trim();
    const txt = (message.text || "").trim().toLowerCase();

    // Smart element finder
    const findEl = (): HTMLElement | null => {
      if (sel) {
        try {
          const el = document.querySelector(sel);
          if (el) return el as HTMLElement;
        } catch {}

        const byId = document.getElementById(sel);
        if (byId) return byId;

        const byName = document.querySelector(`[name="${sel}"]`);
        if (byName) return byName as HTMLElement;

        const byPlaceholder = document.querySelector(`[placeholder*="${sel}" i]`);
        if (byPlaceholder) return byPlaceholder as HTMLElement;

        const byAria = document.querySelector(`[aria-label*="${sel}" i]`);
        if (byAria) return byAria as HTMLElement;
      }

      const targetText = txt || (sel.length < 50 && !sel.startsWith(".") && !sel.startsWith("#") ? sel.toLowerCase() : "");
      if (targetText) {
        // Buttons
        const buttons = Array.from(document.querySelectorAll("button, [role='button'], input[type='submit'], input[type='button']"));
        for (const btn of buttons) {
          const bText = ((btn as HTMLElement).innerText || (btn as HTMLInputElement).value || "").toLowerCase();
          if (bText.includes(targetText)) return btn as HTMLElement;
        }
        // Links
        const links = Array.from(document.querySelectorAll("a"));
        for (const link of links) {
          if (link.innerText.toLowerCase().includes(targetText)) return link;
        }
        // Headings & texts
        const general = Array.from(document.querySelectorAll("h1, h2, h3, h4, p, span, div, label"));
        for (const el of general) {
          const elText = (el as HTMLElement).innerText?.trim().toLowerCase() || "";
          if (elText === targetText || (elText.includes(targetText) && elText.length < 100)) {
            return el as HTMLElement;
          }
        }
      }
      return null;
    };

    switch (message.action) {
      case "extract_page": {
        const main =
          document.querySelector("main") ||
          document.querySelector("article") ||
          document.querySelector("#content") ||
          document.body;

        const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
          .map((el) => (el as HTMLElement).innerText.trim())
          .filter(Boolean)
          .slice(0, 30);

        const links = Array.from(document.querySelectorAll("a[href]"))
          .map((el) => ({
            text: (el as HTMLElement).innerText.trim(),
            href: (el as HTMLAnchorElement).href,
          }))
          .filter((l) => l.text && l.text.length > 1 && !l.href.startsWith("javascript:"))
          .slice(0, 40);

        const inputs = Array.from(document.querySelectorAll("input, textarea, select, button"))
          .map((el) => {
            const htmlEl = el as HTMLElement;
            const tag = htmlEl.tagName.toLowerCase();
            return {
              tag,
              type: (el as HTMLInputElement).type || undefined,
              name: el.getAttribute("name") || undefined,
              id: el.id || undefined,
              placeholder: el.getAttribute("placeholder") || undefined,
              ariaLabel: el.getAttribute("aria-label") || undefined,
              text: tag === "button" ? htmlEl.innerText.trim().slice(0, 30) : undefined,
            };
          })
          .slice(0, 50);

        const bodyClone = main ? (main.cloneNode(true) as HTMLElement) : (document.body.cloneNode(true) as HTMLElement);
        bodyClone.querySelectorAll("script, style, noscript, svg").forEach((n) => n.remove());
        const cleanText = (bodyClone.innerText || "").replace(/\s+/g, " ").trim().slice(0, 8000);

        return {
          success: true,
          page: {
            title: document.title,
            url: location.href,
            headings,
            inputs,
            links,
            text: cleanText,
          },
        };
      }

      case "read_dom": {
        const el = findEl();
        if (el) {
          const text = (el as HTMLInputElement).value || el.innerText || el.textContent || "";
          return {
            success: true,
            tagName: el.tagName.toLowerCase(),
            text: text.trim().slice(0, 4000),
          };
        }
        return { success: false, error: `Element not found for selector: '${message.selector}'` };
      }

      case "click_element": {
        const el = findEl();
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
          el.click();
          if ((el as HTMLInputElement).type === "submit" && (el as any).form) {
            (el as any).form.requestSubmit?.();
          }
          return {
            success: true,
            status: "clicked",
            element: el.tagName.toLowerCase(),
            text: el.innerText?.slice(0, 50),
          };
        }
        return { success: false, error: `Could not find element to click for selector='${message.selector}'` };
      }

      case "fill_form_field": {
        let el = findEl();
        if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
          const candidate = document.querySelector("input:not([type='hidden']), textarea");
          if (candidate) el = candidate as HTMLElement;
        }

        if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
          const val = message.value == null ? "" : String(message.value);
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));

          if (message.submit) {
            el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, code: "Enter", which: 13, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", keyCode: 13, code: "Enter", which: 13, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, code: "Enter", which: 13, bubbles: true }));
            const form = (el as any).form;
            if (form && typeof form.requestSubmit === "function") {
              form.requestSubmit();
            }
          }
          return { success: true, status: "filled", value: val, submitted: Boolean(message.submit) };
        }
        return { success: false, error: `Input field not found for selector: '${message.selector}'` };
      }

      case "scroll_page": {
        const direction = message.direction === "up" ? -1 : 1;
        window.scrollBy({ top: window.innerHeight * 0.7 * direction, behavior: "smooth" });
        return { success: true, status: `scrolled_${message.direction || "down"}` };
      }

      default:
        return { success: false, error: `Unknown action: ${message.action}` };
    }
  } catch (err: any) {
    return { success: false, error: err.toString() };
  }
}

// Listen for messages from Side Panel
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
      return true;
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

    // 4. DOM Actions (read_dom, extract_page, click_element, fill_form_field, scroll_page)
    if (DOM_ACTIONS.includes(message.action)) {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs: any[]) => {
        if (!tabs || tabs.length === 0 || !tabs[0].id) {
          sendResponse({ success: false, error: "No active browser tab found." });
          return;
        }

        const tabId = tabs[0].id;
        const currentUrl = tabs[0].url || "";

        // Check if Chrome restricts scripting on this URL
        if (
          currentUrl.startsWith("chrome://") ||
          currentUrl.startsWith("chrome-extension://") ||
          currentUrl.startsWith("https://chromewebstore.google.com")
        ) {
          sendResponse({
            success: false,
            error: `Chrome security restricts extensions from scripting on ${currentUrl}. Please open a standard web page (like https://wikipedia.org or google.com).`,
          });
          return;
        }

        // First attempt: try sending directly to content script
        chrome.tabs.sendMessage(tabId, message, (response: any) => {
          if (!chrome.runtime.lastError && response) {
            sendResponse(response);
            return;
          }

          // Fallback: If content script is not yet active in this tab, execute inline function directly!
          // This avoids ANY file path lookups and works on every webpage immediately!
          chrome.scripting.executeScript(
            {
              target: { tabId },
              func: runDomActionInline,
              args: [message],
            },
            (injectionResults: any[]) => {
              if (chrome.runtime.lastError) {
                sendResponse({
                  success: false,
                  error: `Could not access page content: ${chrome.runtime.lastError.message}`,
                });
              } else if (injectionResults && injectionResults[0]) {
                sendResponse(injectionResults[0].result);
              } else {
                sendResponse({ success: false, error: "No response returned from page." });
              }
            }
          );
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
