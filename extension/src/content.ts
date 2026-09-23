// Nexus Agent Content Script
// Handles DOM reading, element interaction, form filling, and page extraction
console.log("[Nexus Agent] Content Script Initialized");

declare var chrome: any;

/**
 * Extracts a concise, structured snapshot of the current page to send as context to Gemini.
 */
const extractPageContent = () => {
  const main =
    document.querySelector("main") ||
    document.querySelector("article") ||
    document.querySelector("#content") ||
    document.body;

  // Extract primary headings
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((el) => (el as HTMLElement).innerText.trim())
    .filter(Boolean)
    .slice(0, 30);

  // Extract visible interactive links
  const links = Array.from(document.querySelectorAll("a[href]"))
    .map((el) => {
      const a = el as HTMLAnchorElement;
      return {
        text: a.innerText.trim(),
        href: a.href,
      };
    })
    .filter((l) => l.text && l.text.length > 1 && !l.href.startsWith("javascript:"))
    .slice(0, 40);

  // Extract inputs and form controls
  const inputs = Array.from(document.querySelectorAll("input, textarea, select, button"))
    .map((el) => {
      const htmlEl = el as HTMLElement;
      const tag = htmlEl.tagName.toLowerCase();
      const type = (el as HTMLInputElement).type || undefined;
      const name = el.getAttribute("name") || undefined;
      const id = el.id || undefined;
      const placeholder = el.getAttribute("placeholder") || undefined;
      const ariaLabel = el.getAttribute("aria-label") || undefined;
      const text = tag === "button" ? htmlEl.innerText.trim().slice(0, 30) : undefined;

      return {
        tag,
        type,
        name,
        id,
        placeholder,
        ariaLabel,
        text,
      };
    })
    .slice(0, 50);

  // Clean body text (remove excessive whitespace and scripts/styles)
  const bodyClone = main ? (main.cloneNode(true) as HTMLElement) : document.body.cloneNode(true) as HTMLElement;
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
};

/**
 * Smart Element Resolver:
 * Resolves an element using CSS selector, id, name, placeholder, aria-label, or text matching.
 */
const findElement = (selector?: string, text?: string): HTMLElement | null => {
  const sel = (selector || "").trim();
  const txt = (text || "").trim().toLowerCase();

  // 1. Try native CSS selector if valid
  if (sel) {
    try {
      const el = document.querySelector(sel);
      if (el) return el as HTMLElement;
    } catch {
      // Invalid selector string; fall through to heuristics
    }

    // 2. Try by ID or Name
    const byId = document.getElementById(sel);
    if (byId) return byId;

    const byName = document.querySelector(`[name="${sel}"]`);
    if (byName) return byName as HTMLElement;

    // 3. Try by Placeholder or aria-label
    const byPlaceholder = document.querySelector(`[placeholder*="${sel}" i]`);
    if (byPlaceholder) return byPlaceholder as HTMLElement;

    const byAria = document.querySelector(`[aria-label*="${sel}" i]`);
    if (byAria) return byAria as HTMLElement;
  }

  // 4. Try matching by text content (for buttons, links, etc.)
  const targetText = txt || (sel.length < 50 && !sel.startsWith(".") && !sel.startsWith("#") ? sel.toLowerCase() : "");
  if (targetText) {
    // Check buttons
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], input[type='submit'], input[type='button']"));
    for (const btn of buttons) {
      const bText = ((btn as HTMLElement).innerText || (btn as HTMLInputElement).value || "").toLowerCase();
      if (bText.includes(targetText)) return btn as HTMLElement;
    }

    // Check links
    const links = Array.from(document.querySelectorAll("a"));
    for (const link of links) {
      if (link.innerText.toLowerCase().includes(targetText)) return link;
    }

    // Check generic text elements
    const elements = Array.from(document.querySelectorAll("h1, h2, h3, h4, p, span, div, label"));
    for (const el of elements) {
      const elText = (el as HTMLElement).innerText?.trim().toLowerCase() || "";
      if (elText === targetText || (elText.includes(targetText) && elText.length < 100)) {
        return el as HTMLElement;
      }
    }
  }

  return null;
};

// Listen for background and sidepanel commands
chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (response?: any) => void) => {
  try {
    switch (message.action) {
      case "extract_page": {
        sendResponse(extractPageContent());
        break;
      }

      case "read_dom": {
        const el = findElement(message.selector, message.text);
        if (el) {
          const text = (el as HTMLInputElement).value || el.innerText || el.textContent;
          sendResponse({
            success: true,
            tagName: el.tagName.toLowerCase(),
            text: (text || "").trim().slice(0, 4000),
          });
        } else {
          sendResponse({
            success: false,
            error: `Element not found for selector: '${message.selector}'`,
          });
        }
        break;
      }

      case "click_element": {
        const el = findElement(message.selector, message.text);
        if (el) {
          // Scroll element into view and click
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
          el.click();

          // If it's a form submit button, also trigger submit
          if ((el as HTMLInputElement).type === "submit" && (el as any).form) {
            (el as any).form.requestSubmit?.();
          }

          sendResponse({
            success: true,
            status: "clicked",
            element: el.tagName.toLowerCase(),
            text: el.innerText?.slice(0, 50),
          });
        } else {
          sendResponse({
            success: false,
            error: `Could not find clickable element for selector='${message.selector}' or text='${message.text}'`,
          });
        }
        break;
      }

      case "fill_form_field": {
        // Find input or textarea
        let el = findElement(message.selector);
        if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
          // Fallback: search any input with matching name/placeholder
          const candidate = document.querySelector("input:not([type='hidden']), textarea");
          if (candidate) el = candidate as HTMLElement;
        }

        if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();

          const textValue = message.value == null ? "" : String(message.value);
          el.value = textValue;

          // Dispatch standard React / Vanilla input events
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));

          // If submit requested, simulate pressing Enter or submitting form
          if (message.submit) {
            el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, code: "Enter", which: 13, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", keyCode: 13, code: "Enter", which: 13, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, code: "Enter", which: 13, bubbles: true }));

            const form = (el as any).form;
            if (form && typeof form.requestSubmit === "function") {
              form.requestSubmit();
            }
          }

          sendResponse({
            success: true,
            status: "filled",
            value: textValue,
            submitted: Boolean(message.submit),
          });
        } else {
          sendResponse({
            success: false,
            error: `Input field not found for selector: '${message.selector}'`,
          });
        }
        break;
      }

      case "scroll_page": {
        const direction = message.direction === "up" ? -1 : 1;
        window.scrollBy({
          top: window.innerHeight * 0.7 * direction,
          behavior: "smooth",
        });
        sendResponse({ success: true, status: `scrolled_${message.direction || 'down'}` });
        break;
      }

      default:
        sendResponse({ success: false, error: `Unknown content action: ${message.action}` });
    }
  } catch (error: any) {
    sendResponse({ success: false, error: error.toString() });
  }

  return true; // Keep channel open for async response
});
