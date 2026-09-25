# Nexus Agent

A Chrome extension + FastAPI backend that turns the browser into an AI-powered workflow assistant.

Nexus Agent brings a ReAct-style agent directly into Chrome’s side panel so you can explore pages, interact with UI elements, fill forms, and navigate the web using natural language instructions.

---

## Overview

Nexus Agent helps you:

- read and interpret live page content
- identify and interact with page elements
- fill forms and trigger input flows
- navigate tabs and URLs automatically
- orchestrate browser tasks using Gemini-powered reasoning

It combines a Chrome extension front end with a FastAPI backend and model failover logic to make browser automation feel more like a collaborative assistant than a scripted tool.

---

## Key capabilities

### 1. DOM reading and extraction
- Reads page titles, URLs, headings, inputs, links, and visible text
- Queries the page by CSS selector or semantic description
- Extracts structured information from dynamic web content

### 2. Element interaction
- Clicks buttons, links, toggles, and dropdowns
- Resolves elements by CSS selector, ID, `name`, or visible text
- Supports fuzzy matching for common UI actions

### 3. Form filling and submission
- Fills textboxes, search bars, textareas, and form inputs
- Triggers native `input`, `change`, and `blur` events
- Submits forms automatically when needed

### 4. Navigation control
- Opens or switches tabs
- Moves to target URLs
- Scrolls the viewport to explore content and infinite-scroll pages

### 5. Multi-model failover
- Uses the official Google GenAI Python SDK
- Supports a pool of Gemini models
- Automatically retries across alternative models if one endpoint is temporarily unavailable

---

## Architecture

```text
Chrome Extension (Manifest V3)
├── Side Panel (React + TypeScript)
│   ├── live reasoning stream
│   ├── quick action chips
│   └── settings panel
├── Background Service Worker
│   ├── tab and URL routing
│   ├── script execution fallback
│   └── extension auto-injection
└── Content Script
    ├── structured page extraction
    └── DOM matching and event dispatch
          │
          │ WebSocket: ws://localhost:8001/v1/ws/agent
          ▼
FastAPI Backend
├── services/gemini.py
│   └── Gemini client, model pool, tool declarations
├── tools.py
│   └── DOM reading, click, form fill, navigation tools
├── database.py and models.py
│   └── SQLite session and audit logs
├── main.py
│   └── ReAct-style orchestration server
└── config/
    └── llm configuration
```

---

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Google Chrome (latest version)
- Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 1. Backend setup

Open a terminal in the backend folder:

```powershell
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the backend folder:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
```

Start the backend:

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

The app will be available at `http://127.0.0.1:8001`.

### 2. Extension setup

Open a terminal in the extension folder:

```powershell
cd extension
npm install
npm run build
```

This generates the compiled extension bundle in the `dist` folder.

### 3. Load the extension in Chrome

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click Load unpacked
4. Select the extension `dist` folder
5. Pin the Nexus Agent extension to the toolbar

---

## Example usage

Open any page such as [Wikipedia](https://en.wikipedia.org) or a form, then open the Nexus Agent side panel and try prompts like:

- “Read this page and summarize the main topic.”
- “Search for quantum computing in the page search box.”
- “Click the first article link.”
- “Navigate to https://wikipedia.org and read the top headline.”
- “Go to wikipedia.org, search for James Webb Space Telescope, and tell me its launch date and primary mirror size.”

---

## Testing and verification

Run the backend checks:

```powershell
cd backend
python test_gemini_tools.py
python test_logs.py
```

Run the extension in development mode:

```powershell
cd extension
npm run dev
```

---

## Project structure

```text
Nexus/
├── README.md
├── PRD_content.md
├── backend/
│   ├── main.py
│   ├── tools.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── requirements.txt
│   ├── config/
│   │   └── llm.json
│   └── services/
│       └── gemini.py
└── extension/
    ├── package.json
    ├── vite.config.ts
    ├── manifest.json
    ├── index.html
    └── src/
        ├── background.ts
        ├── content.ts
        ├── sidepanel.tsx
        └── index.css
```

---

## License

This project is licensed under the MIT License.
