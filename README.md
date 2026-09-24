# Nexus Agent 🚀

**AI-Powered Browser Automation & Orchestration Platform**

Nexus Agent transforms Google Chrome into an intelligent, autonomous workspace. By embedding a ReAct AI agent directly inside Chrome's Side Panel, Nexus Agent eliminates context switching between external chat interfaces and web pages. It interprets natural language goals, analyzes live page DOM, interacts with web elements, fills forms, navigates tabs, and streams reasoning in real time using the **Google Gemini API**.

---

## 🌟 Key Capabilities

Nexus Agent specializes in 5 core browser automation tasks:

1. **DOM Reading & Extraction**
   - Extracts page titles, URLs, primary headings, input fields, interactive links, and clean text.
   - Queries specific elements by CSS selector or semantic description.
2. **Element Interaction**
   - Clicks buttons, links, toggles, and dropdowns.
   - Fuzzy element resolution: automatically matches by CSS selector, ID, `name`, or visible text content (e.g. "Submit", "Sign In").
3. **Form Filling & Submission**
   - Automatically populates textboxes, search bars, textareas, and form inputs.
   - Triggers native `input`, `change`, and `blur` events.
   - Supports automatic form submission via simulated `Enter` key events.
4. **Navigation Control**
   - Navigates active tabs to target URLs (`https://...`).
   - Opens and switches between browser tabs.
   - Smoothly scrolls viewports (`up` / `down`) to explore dynamic and infinite-scroll pages.
5. **Multi-Model Failover Pool**
   - Uses Google's official `google-genai` Python SDK.
   - Built-in multi-model pool (`gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3-flash-preview`, `gemini-3.8-flash`).
   - Automatically and instantly fails over across candidate models if any single endpoint encounters temporary high demand (503).

---

## 🏗️ Architecture

```text
Chrome Extension (Manifest V3)
│
├── Side Panel (React + TypeScript + Tailwind CSS)
│   ├── Real-time Thought / Action / Observation Stream
│   ├── Quick Action Chips (Read Page, Find Form, Navigate Wiki)
│   └── Settings Panel (WebSocket URL & API Key Status)
│
├── Background Service Worker
│   ├── Tab Management & URL Routing
│   ├── Universal Inline Script Executor (Zero-delay fallback)
│   └── Auto-injection on Extension Reload
│
└── Content Script
    ├── Structured Page Extractor
    └── Smart Element Matcher & Event Dispatcher
         │
         │ (WebSocket: ws://localhost:8001/v1/ws/agent)
         ▼
FastAPI Backend
├── Services
│   └── gemini.py (Google GenAI Client, Model Pool, Tool Declarations)
├── tools.py (DOM reading, Element click, Form fill, Navigation tools)
├── database.py & models.py (SQLite Session & Execution Audit Logs)
└── main.py (FastAPI WebSocket Agent ReAct Orchestrator)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or later (`npm` included)
- **Python**: 3.10 or later
- **Google Chrome**: Latest version
- **Gemini API Key**: Free key from [Google AI Studio](https://aistudio.google.com/app/apikey)

---

### 1. Backend Setup

1. Open a terminal and navigate to `backend`:
   ```powershell
   cd backend
   ```

2. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

3. Configure your Gemini API key in `backend/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.5-flash
   ```

4. Start the FastAPI backend server:
   ```powershell
   python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
   ```
   *The backend will be running at `http://127.0.0.1:8001`.*

---

### 2. Chrome Extension Setup

1. Open a new terminal and navigate to `extension`:
   ```powershell
   cd extension
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Build the extension bundle:
   ```powershell
   npm run build
   ```
   *(Compiled files will be generated in `extension/dist`).*

---

### 3. Load Extension in Google Chrome

1. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
2. In the top-right corner, turn **Developer mode** **ON**.
3. In the top-left corner, click **Load unpacked**.
4. In the folder picker, select:
   ```text
   D:\Nexus-main\extension\dist
   ```
   *(Ensure you select the `dist` folder, where `manifest.json` is located).*
5. Click the puzzle icon in Chrome and **pin** Nexus Agent to your toolbar.

---

## 🎯 Usage Examples

Open any webpage (e.g. [Wikipedia](https://en.wikipedia.org) or a Google Form), click the **Nexus Agent** icon in Chrome to open the Side Panel, and try:

- **DOM Reading**:
  > *"Read this page, summarize the main topic, and list key points."*
- **Form Filling & Search**:
  > *"Search for Quantum Computing in the search box on this page."*
- **Element Interaction**:
  > *"Click on the first article link."*
- **Navigation Control**:
  > *"Navigate to https://wikipedia.org and read the top headline."*
- **Autonomous Multi-Step Goal**:
  > *"Go to wikipedia.org, search for James Webb Space Telescope, and tell me its launch date and primary mirror size."*

---

## 🧪 Testing & Verification

Run the verification suites in the `backend` folder:
```powershell
cd backend
python test_gemini_tools.py
python test_logs.py
```

To run the extension in hot-reloading development mode:
```powershell
cd extension
npm run dev
```

---

## 📄 License

This project is licensed under the MIT License.
