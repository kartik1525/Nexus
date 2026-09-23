/// <reference types="chrome" />
import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Terminal,
  Settings,
  Send,
  Eye,
  MousePointer2,
  Type,
  Globe,
  Activity,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Zap,
  ExternalLink,
} from 'lucide-react';
import './index.css';

type LogLine = {
  id: string;
  role: 'user' | 'thought' | 'action' | 'observation' | 'system' | 'result';
  content: string;
};

type StepGroup = {
  id: string;
  actionName: string;
  label: string;
  status: 'active' | 'completed' | 'error';
  items: LogLine[];
};

// Friendly visual mapping for the 5 core tasks
const getActionMeta = (rawAction: string) => {
  if (rawAction.startsWith('read_dom') || rawAction.startsWith('extract_page')) {
    return { label: 'Reading Page DOM', icon: <Eye size={14} className="text-cyan-400" /> };
  }
  if (rawAction.startsWith('click_element')) {
    return { label: 'Interacting with Element', icon: <MousePointer2 size={14} className="text-amber-400" /> };
  }
  if (rawAction.startsWith('fill_form_field')) {
    return { label: 'Filling Form Field', icon: <Type size={14} className="text-emerald-400" /> };
  }
  if (rawAction.startsWith('navigate') || rawAction.startsWith('open_new_tab')) {
    return { label: 'Browser Navigation', icon: <Globe size={14} className="text-blue-400" /> };
  }
  if (rawAction.startsWith('scroll_page')) {
    return { label: 'Scrolling Viewport', icon: <Activity size={14} className="text-purple-400" /> };
  }
  return { label: 'Browser Automation', icon: <Zap size={14} className="text-indigo-400" /> };
};

// --- HEADER COMPONENT ---
const Header = ({
  isExecuting,
  activeTab,
  setActiveTab,
  modelLabel,
}: {
  isExecuting: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  modelLabel: string;
}) => (
  <header className="px-4 py-3 border-b border-[#1f2937] bg-[#0B0F1A]/95 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center shadow-lg">
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-3 w-3">
        {isExecuting && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        <span
          className={`relative inline-flex rounded-full h-3 w-3 ${
            isExecuting ? 'bg-emerald-500' : 'bg-slate-500'
          }`}
        ></span>
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="font-bold text-sm tracking-wide bg-gradient-to-r from-white via-indigo-100 to-indigo-400 bg-clip-text text-transparent leading-tight">
            Nexus Agent
          </h1>
          <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-mono px-1.5 py-0.5 rounded border border-indigo-500/30">
            Gemini
          </span>
        </div>
        <p className="text-[10px] text-slate-400 tracking-wider font-medium">
          {isExecuting ? 'Executing in Browser...' : modelLabel}
        </p>
      </div>
    </div>
    <div className="flex gap-1.5">
      <button
        onClick={() => setActiveTab('chat')}
        className={`p-2 rounded-lg transition-all ${
          activeTab === 'chat'
            ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        title="Agent Execution"
      >
        <Terminal size={15} />
      </button>
      <button
        onClick={() => setActiveTab('settings')}
        className={`p-2 rounded-lg transition-all ${
          activeTab === 'settings'
            ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        title="Settings & API Key"
      >
        <Settings size={15} />
      </button>
    </div>
  </header>
);

// --- STEP CARD COMPONENT ---
const StepCard = ({ step }: { step: StepGroup }) => {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const meta = getActionMeta(step.actionName);

  return (
    <div className="bg-[#111827]/90 rounded-xl border border-slate-800 overflow-hidden shadow-sm transition-all hover:border-slate-700">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-3 flex items-center justify-between cursor-pointer select-none bg-slate-900/60 hover:bg-slate-900/90 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50">
            {meta.icon}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-200">{meta.label}</h4>
            <p className="text-[10px] font-mono text-slate-400 truncate max-w-[220px]">
              {step.actionName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step.status === 'active' && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              Running
            </span>
          )}
          {step.status === 'completed' && (
            <CheckCircle2 size={15} className="text-emerald-400" />
          )}
          {step.status === 'error' && (
            <AlertCircle size={15} className="text-rose-400" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-800/80 bg-[#080d1a] p-3 text-[11px] font-mono space-y-2 text-slate-300"
          >
            {step.items.map((it) => (
              <div key={it.id} className="flex flex-col gap-1">
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider ${
                    it.role === 'thought'
                      ? 'text-indigo-400'
                      : it.role === 'observation'
                      ? 'text-cyan-400'
                      : 'text-slate-400'
                  }`}
                >
                  {it.role}
                </span>
                <p className="text-slate-200 bg-slate-900/70 p-2 rounded border border-slate-800/60 whitespace-pre-wrap leading-relaxed text-[11px]">
                  {it.content}
                </p>
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(JSON.stringify(step.items, null, 2));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded bg-slate-800/50 hover:bg-slate-800"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- QUICK ACTIONS ---
const QuickActions = ({ onSelect }: { onSelect: (task: string) => void }) => {
  const actions = [
    { label: 'Read Page', task: 'Read this page, summarize the main topic, and list key points.', icon: <Eye size={12} /> },
    { label: 'Find Form', task: 'Find all form inputs on this page and report what information is needed.', icon: <Type size={12} /> },
    { label: 'Navigate Wiki', task: 'Navigate to https://wikipedia.org and read the main headline.', icon: <Globe size={12} /> },
  ];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {actions.map((act) => (
        <button
          key={act.label}
          onClick={() => onSelect(act.task)}
          className="flex-shrink-0 flex items-center gap-1.5 text-[11px] bg-slate-900/80 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg transition-all"
        >
          {act.icon}
          {act.label}
        </button>
      ))}
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export const App = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [input, setInput] = useState('');
  const [taskGoal, setTaskGoal] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepGroup[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [finalOutput, setFinalOutput] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState('Gemini 2.5 Flash');
  const [backendUrl, setBackendUrl] = useState('ws://localhost:8001/v1/ws/agent');

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps, finalOutput]);

  const sendObservation = (ws: WebSocket, observation: string, isError: boolean) => {
    ws.send(
      JSON.stringify({
        type: 'OBSERVATION',
        payload: {
          observation,
          status: isError ? 'FAILED' : 'SUCCESS',
        },
      })
    );
  };

  const executeGoal = (targetGoal?: string) => {
    const goalToRun = targetGoal || input;
    if (!goalToRun.trim() || isExecuting) return;

    setTaskGoal(goalToRun);
    setInput('');
    setIsExecuting(true);
    setFinalOutput(null);

    // Initial step
    setSteps([
      {
        id: 'init_plan',
        actionName: 'Planning Task',
        label: 'Analyzing Goal with Gemini',
        status: 'active',
        items: [{ id: 'plan_item', role: 'thought', content: `Goal: ${goalToRun}` }],
      },
    ]);

    const ws = new WebSocket(backendUrl);

    ws.onopen = () => {
      // Extract page context from active tab
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        ws.send(JSON.stringify({ type: 'TASK_REQUEST', payload: { task: goalToRun, page: null } }));
        return;
      }

      chrome.runtime.sendMessage({ action: 'extract_page' }, (response: any) => {
        const page = response?.success ? response.page : null;
        ws.send(JSON.stringify({ type: 'TASK_REQUEST', payload: { task: goalToRun, page } }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'LOG_ENTRY' && data.payload) {
          const payload = data.payload;

          if (payload.model) {
            setModelLabel(payload.model);
          }

          // Thought stream from Gemini
          if (payload.thought) {
            setSteps((prev) => {
              const arr = [...prev];
              if (arr.length > 0) {
                arr[arr.length - 1].items.push({
                  id: Math.random().toString(),
                  role: 'thought',
                  content: payload.thought,
                });
                if (payload.status === 'FINISH') {
                  arr[arr.length - 1].status = 'completed';
                }
              }
              return arr;
            });
          }

          // Tool Action triggered
          if (payload.action) {
            setSteps((prev) => {
              const arr = [...prev];
              if (arr.length > 0) arr[arr.length - 1].status = 'completed';
              arr.push({
                id: Math.random().toString(),
                actionName: payload.action,
                label: 'Executing Browser Action',
                status: 'active',
                items: [],
              });
              return arr;
            });
          }

          // Bridge trigger: Execute tool in Chrome
          if (payload.bridge_trigger) {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
              chrome.runtime.sendMessage(payload.bridge_trigger, (response: any) => {
                let obsText = 'No response returned from browser.';
                let isError = false;

                if (chrome.runtime.lastError) {
                  obsText = `Chrome Error: ${chrome.runtime.lastError.message}`;
                  isError = true;
                } else if (response) {
                  obsText = typeof response === 'object' ? JSON.stringify(response) : String(response);
                  isError = response.success === false;
                }

                setSteps((prev) => {
                  const arr = [...prev];
                  if (arr.length > 0) {
                    arr[arr.length - 1].items.push({
                      id: Math.random().toString(),
                      role: 'observation',
                      content: obsText,
                    });
                    if (isError) arr[arr.length - 1].status = 'error';
                  }
                  return arr;
                });

                sendObservation(ws, obsText, isError);
              });
            } else {
              sendObservation(ws, 'Mock environment: Chrome APIs unavailable', true);
            }
          }

          // Final Answer from Gemini
          if (payload.final_answer) {
            setFinalOutput(payload.final_answer);
          }
        }
      } catch (err) {
        console.error('[Nexus Agent] WSS Error:', err);
      }
    };

    ws.onclose = () => {
      setIsExecuting(false);
      setSteps((prev) => {
        const arr = [...prev];
        if (arr.length > 0 && arr[arr.length - 1].status === 'active') {
          arr[arr.length - 1].status = 'completed';
        }
        return arr;
      });
    };

    ws.onerror = () => {
      setIsExecuting(false);
      setSteps((prev) => {
        const arr = [...prev];
        if (arr.length > 0) {
          arr[arr.length - 1].status = 'error';
          arr[arr.length - 1].items.push({
            id: 'err',
            role: 'system',
            content: 'Connection to backend failed. Please make sure the backend is running at ' + backendUrl,
          });
        }
        return arr;
      });
    };
  };

  return (
    <div className="flex flex-col h-screen bg-[#070B14] text-slate-100 font-sans antialiased overflow-hidden">
      <Header
        isExecuting={isExecuting}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        modelLabel={modelLabel}
      />

      {activeTab === 'chat' ? (
        <>
          <main className="flex-1 overflow-y-auto p-4 space-y-4">
            {steps.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Sparkles size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Browser Orchestration</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-[260px] leading-relaxed">
                    Ask Gemini to read page content, fill out forms, click buttons, or navigate anywhere.
                  </p>
                </div>
                <div className="w-full pt-2">
                  <QuickActions onSelect={(task) => executeGoal(task)} />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {taskGoal && (
                  <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2.5">
                    <Sparkles size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                        Goal
                      </span>
                      <p className="text-xs text-white leading-relaxed mt-0.5">{taskGoal}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {steps.map((step) => (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        layout
                      >
                        <StepCard step={step} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {finalOutput && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                      <CheckCircle2 size={15} />
                      Completed
                    </div>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {finalOutput}
                    </p>
                  </motion.div>
                )}
              </div>
            )}
            <div ref={bottomRef} className="h-2" />
          </main>

          {/* Bottom Chat Bar */}
          <footer className="p-3 bg-[#0B0F1A]/95 border-t border-slate-800/80 backdrop-blur-md space-y-2">
            {steps.length > 0 && (
              <QuickActions onSelect={(task) => executeGoal(task)} />
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeGoal();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Give Gemini a browser task..."
                disabled={isExecuting}
                className="flex-1 bg-slate-900/90 border border-slate-700/70 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={isExecuting || !input.trim()}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-all shadow-md shadow-indigo-600/20"
              >
                <Send size={14} />
              </button>
            </form>
          </footer>
        </>
      ) : (
        <div className="flex-1 p-5 overflow-y-auto space-y-5">
          <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 space-y-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Settings size={14} className="text-indigo-400" />
              Engine Settings
            </h2>
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-medium">Backend WebSocket URL</label>
              <input
                type="text"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                className="w-full bg-[#080D1A] border border-slate-700/80 focus:border-indigo-500 rounded-lg p-2.5 text-xs text-white outline-none font-mono"
              />
            </div>
          </div>

          <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 space-y-3 text-xs leading-relaxed">
            <h3 className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" />
              Gemini API Setup
            </h3>
            <p className="text-slate-400">
              Nexus Agent uses Google's official <span className="text-indigo-400 font-mono">google-genai</span> SDK.
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-slate-300">
              <li>Get your free Gemini API key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 underline inline-flex items-center gap-0.5">Google AI Studio <ExternalLink size={10} /></a>.</li>
              <li>Add it to <span className="font-mono text-slate-200">backend/.env</span>:</li>
            </ol>
            <div className="bg-[#080D1A] p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400">
              GEMINI_API_KEY=your_key_here
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
