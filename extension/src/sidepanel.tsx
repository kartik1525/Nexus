import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const App = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');

  // Settings State
  const [backendUrl, setBackendUrl] = useState('ws://localhost:8000/v1/ws/agent');
  const [authToken, setAuthToken] = useState('nexus-dev-token-xyz');

  // Metrics State
  const [, setTasksCompleted] = useState(0);
  const [showNps, setShowNps] = useState(false);

  const sendTask = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, {role: 'user', content: input}]);
    
    // Mock completion to trigger NPS
    setTimeout(() => {
        setMessages(prev => [...prev, {role: 'agent', content: 'Task completed!'}]);
        setTasksCompleted(prev => {
            const next = prev + 1;
            if (next === 5) setShowNps(true);
            return next;
        });
    }, 1500);

    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-4">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-slate-700 pb-3">
         <h1 className="text-xl font-bold text-center">Nexus Agent</h1>
         <div className="flex justify-center gap-4 text-xs font-semibold">
           <button 
             className={`${activeTab === 'chat' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
             onClick={() => setActiveTab('chat')}
           >
             CHAT
           </button>
           <button 
             className={`${activeTab === 'settings' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
             onClick={() => setActiveTab('settings')}
           >
             SETTINGS
           </button>
         </div>
      </div>

      {/* View Router */}
      {activeTab === 'chat' ? (
        <>
          <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`p-3 rounded-lg text-sm max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 self-end' : 'bg-slate-700 self-start'}`}>
                {msg.content}
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-center text-sm text-slate-500 my-auto">
                Ready to orchestrate tasks!
              </div>
            )}
          </div>

          {showNps && (
          <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg text-sm mt-4 text-center">
             <p className="font-semibold mb-2">How likely are you to recommend Nexus Agent?</p>
             <div className="flex justify-between gap-1 mb-3">
               {[1,2,3,4,5,6,7,8,9,10].map(score => (
                 <button key={score} className="bg-slate-700 hover:bg-blue-600 text-[10px] w-6 h-6 rounded" onClick={() => setShowNps(false)}>{score}</button>
               ))}
             </div>
             <p className="text-[10px] text-slate-400">10 = Extremely Likely</p>
          </div>
        )}

        <div className="mt-2 border-t border-slate-700 pt-3 relative">
            <textarea 
              placeholder="What can I automate?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full bg-slate-800 rounded-md border border-slate-700 p-2 text-sm text-white resize-none h-[80px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTask(); }
              }}
            />
            <button 
              onClick={sendTask}
              className="absolute bottom-5 right-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded shadow text-xs font-semibold"
            >
              Send
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 py-4 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Backend WebSocket URL</label>
            <input 
              type="text" 
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Agent Auth Token</label>
            <input 
              type="password" 
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
            />
          </div>
          <div className="mt-4">
             <button className="w-full bg-slate-700 hover:bg-slate-600 text-white p-2 rounded text-sm font-semibold">
               Save Settings
             </button>
             <p className="text-xs text-slate-500 mt-2 text-center">Settings are saved locally.</p>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
