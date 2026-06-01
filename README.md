# Nexus Agent

AI-powered browser orchestration platform that combines Chrome Extensions, LLM agents, and workflow automation to execute tasks directly inside the browser.

## Overview

Nexus Agent is designed to eliminate context switching between AI tools and web applications.

Users provide goals in natural language and the agent:

- Understands intent
- Breaks tasks into subtasks
- Interacts with browser content
- Calls external APIs
- Executes workflows autonomously
- Streams reasoning in real time

---

## Key Features

### Browser Side Panel

- Persistent Chrome Side Panel
- React + TypeScript UI
- Real-time task monitoring
- Execution log viewer

### Agent Orchestration

- ReAct architecture
- Task decomposition
- Multi-step planning
- Tool calling

### Browser Automation

- DOM reading
- Element interaction
- Form filling
- Navigation control

### Execution Transparency

Every step records:

- Thought
- Action
- Observation
- Status
- Duration

---

## Architecture

```text
Chrome Extension
│
├── Side Panel (React)
├── Background Service Worker
├── Content Scripts
│
└── FastAPI Backend
    ├── LangChain
    ├── GPT-4o
    ├── Tool Registry
    └── Database Layer
