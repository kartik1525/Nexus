/// <reference types="chrome" />
import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Activity, CheckCircle2, CircleDashed, Terminal, Search, Settings, AlertTriangle, Check, ChevronRight, Copy, CheckSquare, Zap, Eye, MousePointer2, Type, Globe, Maximize, FileText } from 'lucide-react';
import './index.css';

type LogLine = { id: string; role: 'user' | 'agent' | 'system' | 'action' | 'observation'; content: string };
type StepGroup = {
  id: string;
  rawAction: string;
  label: string;
  status: 'active' | 'completed' | 'error';
  items: LogLine[];
};

// --- UTILS ---
const getHumanAction = (raw: string) => {
  if (raw.startsWith('read_dom')) return { label: "Reading page content", icon: <Eye size={14} /> };
  if (raw.startsWith('click_element')) return { label: "Interacting with element", icon: <MousePointer2 size={14} /> };
  if (raw.startsWith('fill_form_field')) return { label: "Inputting data", icon: <Type size={14} /> };
  if (raw.startsWith('navigate')) return { label: "Navigating to URL", icon: <Globe size={14} /> };
  if (raw.startsWith('take_screenshot')) return { label: "Capturing visual context", icon: <Maximize size={14} /> };
  if (raw.startsWith('open_new_tab')) return { label: "Opening new tab", icon: <Globe size={14} /> };
  if (raw.startsWith('switch_tab')) return { label: "Switching tabs", icon: <CheckSquare size={14} /> };
  if (raw.startsWith('scroll_to_element')) return { label: "Scrolling page", icon: <Activity size={14} /> };
  if (raw.includes('plan') || raw.includes('Planning')) return { label: "Analyzing Intent & Planning", icon: <Zap size={14} /> };
  return { label: "Executing Agent Tool", icon: <Zap size={14} /> };
};

// --- COMPONENTS ---

const Header = ({ isExecuting, activeTab, setActiveTab }: { isExecuting: boolean, activeTab: string, setActiveTab: (t: any) => void }) => (
  <header className="px-4 py-3 border-b border-[#1f2937] bg-[#0B0F1A]/90 backdrop-blur-md sticky top-0 z-20 flex justify-between items-center shadow-sm">
    <div className="flex items-center gap-3">
      <div className="relative flex h-3 w-3">
        {isExecuting && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${isExecuting ? 'bg-[#22C55E]' : 'bg-[#374151]'}`}></span>
      </div>
      <div>
        <h1 className="font-bold text-sm tracking-wide bg-gradient-to-r from-white to-[#9CA3AF] bg-clip-text text-transparent leading-tight">Nexus Agent</h1>
        <p className="text-[10px] text-[#9CA3AF] tracking-widest uppercase font-semibold">{isExecuting ? 'Live Execution' : 'Standby'}</p>
      </div>
    </div>
    <div className="flex gap-2">
      <button onClick={() => setActiveTab('chat')} className={`p-1.5 rounded-md transition-colors ${activeTab === 'chat' ? 'bg-[#1f2937] text-white' : 'text-[#9CA3AF] hover:text-white hover:bg-[#1f2937]'}`}>
        <Terminal size={16} />
      </button>
      <button onClick={() => setActiveTab('settings')} className={`p-1.5 rounded-md transition-colors ${activeTab === 'settings' ? 'bg-[#1f2937] text-white' : 'text-[#9CA3AF] hover:text-white hover:bg-[#1f2937]'}`}>
        <Settings size={16} />
      </button>
    </div>
  </header>
);

const LogsViewer = ({ items, rawAction, expanded }: { items: LogLine[], rawAction: string, expanded: boolean }) => {
  const [copied, setCopied] = useState(false);
  
  if (!expanded) return null;

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-[#05080f] rounded-b-lg border-t border-[#1f2937]">
      <div className="p-3 text-[10px] font-mono text-[#9CA3AF] space-y-2 relative">
        <div className="flex justify-between items-start mb-2 pb-2 border-b border-[#1f2937]/50">
           <span className="text-[#6366F1] font-semibold">sys.call( {rawAction} )</span>
           <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(items, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="hover:text-white transition-colors">
             {copied ? <Check size={12} className="text-[#22C55E]"/> : <Copy size={12} />}
           </button>
        </div>
        {items.map(log => {
           let content = log.content;
           let isJson = false;
           if (log.role === 'observation') {
             try { const parsed = JSON.parse(content); content = JSON.stringify(parsed, null, 2); isJson = true; } catch(e){}
           }
           return (
             <div key={log.id} className="flex gap-2 items-start break-all">
               <span className={`flex-shrink-0 ${log.role === 'observation' ? 'text-[#22C55E]' : 'text-[#9CA3AF]'}`}>{'>'}</span>
               <pre className={`whitespace-pre-wrap ${log.role === 'observation' ? (isJson ? 'text-[#34d399]' : 'text-[#22C55E]') : 'text-[#D1D5DB]'}`}>{content}</pre>
             </div>
           );
        })}
        {items.length === 0 && <span className="text-[#4B5563] animate-pulse">awaiting telemetry...</span>}
      </div>
    </motion.div>
  );
};

const StepCard = ({ step, isLast }: { step: StepGroup, isLast: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(step.status === 'active' || isLast);
  const actionDetails = getHumanAction(step.rawAction);

  // Auto-collapse when status changes to completed, unless user toggled it manually
  useEffect(() => {
    if (step.status === 'completed' && !isLast) setIsExpanded(false);
    if (step.status === 'active') setIsExpanded(true);
  }, [step.status, isLast]);

  return (
    <div className="relative">
      <div className="absolute -left-[21px] top-1.5 bg-[#0B0F1A] p-0.5 z-10">
        {step.status === 'active' ? (
          <CircleDashed size={14} className="text-[#6366F1] animate-spin" />
        ) : step.status === 'error' ? (
          <AlertTriangle size={14} className="text-[#EF4444]" />
        ) : (
          <CheckCircle2 size={14} className="text-[#22C55E]" />
        )}
      </div>

      <div className={`bg-[#111827] rounded-lg transition-all duration-300 border ${step.status === 'active' ? 'border-[#6366F1]/40 shadow-[0_0_20px_rgba(99,102,241,0.15)] ring-1 ring-[#6366F1]/20' : step.status === 'error' ? 'border-[#EF4444]/50' : 'border-[#1f2937] hover:border-[#374151]'}`}>
        <button onClick={() => setIsExpanded(!isExpanded)} className="w-full px-3 py-2.5 flex items-center justify-between focus:outline-none">
          <div className="flex items-center gap-2">
            <span className={`${step.status === 'active' ? 'text-[#6366F1]' : 'text-[#9CA3AF]'}`}>{actionDetails.icon}</span>
            <h3 className={`text-xs font-semibold ${step.status === 'active' ? 'text-white' : 'text-[#D1D5DB]'}`}>
              {actionDetails.label}
              {step.status === 'active' && <span className="ml-2 text-[10px] text-[#6366F1] animate-pulse font-normal">Executing...</span>}
            </h3>
          </div>
          <span className="text-[#4B5563] transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <ChevronRight size={14} />
          </span>
        </button>
        
        <AnimatePresence>
          <LogsViewer items={step.items} rawAction={step.rawAction} expanded={isExpanded} />
        </AnimatePresence>
      </div>
    </div>
  );
};

const ResultPanel = ({ finalOutput }: { finalOutput: string }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-gradient-to-br from-[#111827] to-[#0B0F1A] border border-[#22C55E]/30 rounded-xl overflow-hidden shadow-lg shadow-[#22C55E]/5 relative">
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#22C55E] to-[#10B981]"></div>
    <div className="p-4">
      <div className="text-[10px] font-bold text-[#22C55E] uppercase tracking-wider mb-3 flex items-center gap-2">
        <FileText size={14} /> Task Successfully Completed
      </div>
      <div className="text-sm text-[#E5E7EB] leading-relaxed whitespace-pre-wrap font-medium">
        {finalOutput}
      </div>
    </div>
  </motion.div>
);

const CommandInput = ({ input, setInput, sendTask, isExecuting }: any) => (
  <footer className="p-4 bg-[#0B0F1A]/95 backdrop-blur-md border-t border-[#1f2937] relative z-10">
    <div className="relative group flex items-center">
      <Search className="absolute left-3 text-[#6B7280] group-focus-within:text-[#6366F1] transition-colors" size={16} />
      <input 
        placeholder={isExecuting ? "Agent is busy executing..." : "Ask your agent to do something..."}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isExecuting}
        className="w-full bg-[#111827] border border-[#1f2937] focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all rounded-full py-3 pl-10 pr-12 text-sm text-white shadow-inner placeholder:text-[#4B5563] disabled:opacity-50"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTask(); } }}
      />
      <button 
        onClick={sendTask}
        disabled={isExecuting || !input.trim()}
        className="absolute right-1.5 p-2 bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-[#374151] text-white rounded-full shadow-md transition-all disabled:opacity-50"
      >
        <Play size={14} fill="currentColor" className="ml-0.5" />
      </button>
    </div>
  </footer>
);

// --- MAIN APP ---

const App = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [input, setInput] = useState('');
  const [taskName, setTaskName] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepGroup[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [finalOutput, setFinalOutput] = useState<string | null>(null);

  const [backendUrl, setBackendUrl] = useState('ws://localhost:8000/v1/ws/agent');
  const [authToken, setAuthToken] = useState('nexus-dev-token-xyz');

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [steps]);

  const sendObservation = (ws: WebSocket, observation: string, isError: boolean) => {
    ws.send(JSON.stringify({
      type: "OBSERVATION",
      payload: {
        observation,
        status: isError ? "FAILED" : "SUCCESS"
      }
    }));
  };

  const sendTask = () => {
    if (!input.trim() || isExecuting) return;
    const taskInput = input;
    setTaskName(taskInput);
    setInput('');
    setIsExecuting(true);
    setFinalOutput(null);
    
    setSteps([{ id: 'init_plan', rawAction: 'Planning', label: 'Analyzing Intent & Planning', status: 'active', items: [] }]);

    const ws = new WebSocket(`${backendUrl}?token=${authToken}`);
    ws.onopen = () => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        ws.send(JSON.stringify({ type: 'TASK_REQUEST', payload: { task: taskInput, page: null } }));
        return;
      }

      chrome.runtime.sendMessage({ action: 'extract_page' }, (response: any) => {
        const page = response?.success ? response.page : null;
        const extractionError = chrome.runtime.lastError?.message || response?.error;

        if (extractionError) {
          setSteps(prev => {
            const arr = [...prev];
            arr[arr.length - 1].items.push({
              id: Math.random().toString(),
              role: 'system',
              content: `Page extraction failed: ${extractionError}`
            });
            return arr;
          });
        }

        ws.send(JSON.stringify({ type: 'TASK_REQUEST', payload: { task: taskInput, page } }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'LOG_ENTRY') {
          if (data.payload.final_answer) {
             setFinalOutput(data.payload.final_answer);
          }

          if (data.payload.status === 'FAILED') {
             setFinalOutput(null);
             setSteps(prev => {
                const arr = [...prev];
                if (arr.length > 0) arr[arr.length - 1].status = 'error';
                return arr;
             });
          }

          if (data.payload.thought) {
             setSteps(prev => {
                const arr = [...prev];
                arr[arr.length - 1].items.push({ id: Math.random().toString(), role: 'agent', content: data.payload.thought });
                if (data.payload.status === 'FINISH') arr[arr.length - 1].status = 'completed';
                return arr;
             });
          } 
          
          if (data.payload.action) {
             setSteps(prev => {
                const arr = [...prev];
                if (arr.length > 0) arr[arr.length - 1].status = 'completed';
                arr.push({ id: Math.random().toString(), rawAction: data.payload.action, label: `Action`, status: 'active', items: [] });
                return arr;
             });
          }
          
          if (data.payload.bridge_trigger) {
             if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                 chrome.runtime.sendMessage(data.payload.bridge_trigger, (response: any) => {
                     let obs = "No response returned from extension background.";
                     let isError = true;
                     if (chrome.runtime.lastError) {
                         obs = "Extension Error: " + chrome.runtime.lastError.message;
                         isError = true;
                     } else if (response) {
                         obs = typeof response === 'object' ? JSON.stringify(response) : String(response);
                         isError = response.success === false;
                     }
                     
                     setSteps(prev => {
                         const arr = [...prev];
                         arr[arr.length - 1].items.push({ id: Math.random().toString(), role: 'observation', content: obs });
                         if (isError) arr[arr.length - 1].status = 'error';
                         return arr;
                     });

                     sendObservation(ws, obs, isError);
                 });
             } else {
                 sendObservation(ws, "Mock environment: no chrome APIs.", true);
             }
          }
        }
      } catch (e) {
        console.error("WSS Error", e);
      }
    };

    ws.onclose = () => {
      setIsExecuting(false);
      setSteps(prev => {
          const arr = [...prev];
          if (arr.length > 0 && arr[arr.length - 1].status === 'active') arr[arr.length - 1].status = 'completed';
          return arr;
      });
    };

    ws.onerror = () => {
       setIsExecuting(false);
       setSteps(prev => {
          const arr = [...prev];
          if (arr.length > 0) {
             arr[arr.length - 1].status = 'error';
             arr[arr.length - 1].items.push({ id: 'err', role: 'system', content: 'Connection Error: Backend unreachable.' });
          }
          return arr;
       });
    };
  };

  return (
    <div className="flex flex-col h-screen bg-[#0B0F1A] text-[#E5E7EB] font-sans selection:bg-[#6366F1]/30">
      <Header isExecuting={isExecuting} activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'chat' ? (
        <>
          <main className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
            {!taskName ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col items-center justify-center text-center space-y-4 text-[#9CA3AF] mt-10">
                <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-[#1f2937] flex items-center justify-center shadow-lg shadow-[#1f2937]/20">
                  <Activity size={32} className="text-[#6366F1]" />
                </div>
                <div>
                  <h2 className="text-white font-medium mb-1">System Ready</h2>
                  <p className="text-xs max-w-[200px] leading-relaxed">Agent is standing by for browser orchestration.</p>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6">
                <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 shadow-sm">
                  <div className="text-[10px] font-bold text-[#6366F1] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <CheckCircle2 size={12} /> Active Task
                  </div>
                  <p className="text-sm text-white font-medium leading-relaxed">{taskName}</p>
                </div>

                <div className="relative pl-4 border-l border-[#1f2937] space-y-6 ml-2">
                  <AnimatePresence initial={false}>
                    {steps.map((step, idx) => (
                      <motion.div key={step.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} layout className="relative">
                        <StepCard step={step} isLast={idx === steps.length - 1} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {finalOutput && !isExecuting && <ResultPanel finalOutput={finalOutput} />}
              </div>
            )}
            <div ref={bottomRef} className="h-4" />
          </main>

          <CommandInput input={input} setInput={setInput} sendTask={sendTask} isExecuting={isExecuting} />
        </>
      ) : (
        <div className="flex-1 py-6 px-4 flex flex-col gap-6 overflow-y-auto">
          <div className="space-y-4 bg-[#111827] p-4 rounded-xl border border-[#1f2937]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
               <Settings size={14} className="text-[#6366F1]" /> Engine Configuration
            </h2>
            <div>
              <label className="block text-xs font-bold tracking-wider text-[#9CA3AF] mb-1.5 uppercase">Backend WebSocket URL</label>
              <input type="text" className="w-full bg-[#0B0F1A] border border-[#1f2937] focus:border-[#6366F1] rounded-lg p-2.5 text-sm text-white transition-colors" value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-wider text-[#9CA3AF] mb-1.5 uppercase">Agent Auth Token</label>
              <input type="password" className="w-full bg-[#0B0F1A] border border-[#1f2937] focus:border-[#6366F1] rounded-lg p-2.5 text-sm text-white transition-colors" value={authToken} onChange={(e) => setAuthToken(e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
