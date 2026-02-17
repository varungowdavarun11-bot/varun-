import React, { useState, useRef, useEffect } from 'react';
import { AppState, Message, DocumentData, AIMode, Session } from './types';
import FileUpload from './components/FileUpload';
import ChatMessage from './components/ChatMessage';
import DocumentViewer from './components/DocumentViewer';
import { generateAnswer, checkLocalCapability } from './services/geminiService';
import { Send, BookOpen, Plus, Trash2, Menu, History, Layers, ArrowLeft, PanelLeftClose, PanelLeftOpen, MessageSquare } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>('unavailable');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(false);
  const [activePageToScroll, setActivePageToScroll] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];
  const documents = currentSession?.documents || [];

  useEffect(() => {
    const saved = localStorage.getItem('read_pdf_sessions');
    if (saved) {
      try {
        const parsed: Session[] = JSON.parse(saved);
        if (parsed.length > 0) {
          setSessions(parsed);
          setCurrentSessionId(parsed[0].id);
          setAppState(AppState.CHAT);
        }
      } catch (e) {}
    }
    checkLocalCapability().then(setAiMode);
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => { window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); };
  }, []);

  useEffect(() => {
    localStorage.setItem('read_pdf_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (appState === AppState.CHAT) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, appState]);

  const handleUploadComplete = (docs: DocumentData[]) => {
    const newId = Date.now().toString();
    const hasImages = docs.some(d => d.fileType === 'image');
    const newSession: Session = {
      id: newId,
      documents: docs,
      messages: [{
        id: 'init-1',
        role: 'model',
        content: `I've analyzed ${docs.length} file(s). ${hasImages ? "My vision model is ready to reason about your images." : "You can ask questions now."}`,
        timestamp: Date.now()
      }],
      createdAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setAppState(AppState.CHAT);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || documents.length === 0 || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputText, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: updatedMessages } : s));
    setInputText('');
    setIsLoading(true);

    try {
      const history = updatedMessages.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
      const answer = await generateAnswer(documents, userMsg.content, history, isOnline ? aiMode : 'local');
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...updatedMessages, { id: Date.now().toString(), role: 'model', content: answer, timestamp: Date.now() }] } : s));
    } catch (e) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...updatedMessages, { id: Date.now().toString(), role: 'model', content: "An error occurred during reasoning.", timestamp: Date.now() }] } : s));
    } finally { setIsLoading(false); }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden text-slate-900">
      {/* Sidebar */}
      <aside className={`fixed inset-0 z-40 bg-slate-900 text-slate-300 transform transition-transform md:relative md:transform-none md:w-64 md:flex md:flex-col ${mobileMenuOpen ? 'translate-x-0 pt-16' : '-translate-x-full'}`}>
        <div className="hidden md:flex items-center gap-3 p-6 border-b border-slate-800 text-white font-bold"><BookOpen size={20} className="text-indigo-400" /> Read Anything</div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => { setAppState(AppState.UPLOAD); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${appState === AppState.UPLOAD ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Plus size={20} /> New Analysis</button>
          <div className="pt-6 pb-2 px-4 text-xs font-bold uppercase text-slate-500 flex items-center gap-2"><History size={12} /> Recent</div>
          {sessions.map(s => (
            <div key={s.id} className={`group flex items-center rounded-xl transition-all ${s.id === currentSessionId && appState === AppState.CHAT ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 text-slate-400'}`}>
              <button onClick={() => { setCurrentSessionId(s.id); setAppState(AppState.CHAT); setMobileMenuOpen(false); }} className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
                <Layers size={16} className="opacity-70 flex-shrink-0" />
                <span className="truncate text-sm font-medium">{s.documents[0]?.name}</span>
              </button>
              <button onClick={() => setSessions(prev => prev.filter(sess => sess.id !== s.id))} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {appState === AppState.UPLOAD ? (
          <div className="h-full flex flex-col">
            {sessions.length > 0 && (
              <header className="p-4 border-b border-slate-100">
                <button onClick={() => setAppState(AppState.CHAT)} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                  <MessageSquare size={18} /> Back to Chat
                </button>
              </header>
            )}
            <div className="flex-1 flex items-center justify-center p-4">
              <FileUpload onUploadComplete={handleUploadComplete} />
            </div>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col md:flex-row overflow-hidden relative">
            {/* Viewer Side */}
            <div className={`h-full bg-slate-100 border-r border-slate-200 transition-all duration-300 ${isDocumentPanelOpen ? 'flex-1 md:w-1/2 lg:w-3/5' : 'w-0 hidden'}`}>
              <DocumentViewer documents={documents} scrollToPage={activePageToScroll} />
            </div>
            
            {/* Chat Side */}
            <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isDocumentPanelOpen ? 'hidden md:flex md:w-1/2 lg:w-2/5' : 'flex w-full'}`}>
              <header className="flex-shrink-0 h-14 border-b border-slate-100 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                  <button onClick={() => setAppState(AppState.UPLOAD)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                    <ArrowLeft size={16} /> BACK
                  </button>
                  <div className="w-px h-6 bg-slate-200"></div>
                  <button onClick={() => setIsDocumentPanelOpen(!isDocumentPanelOpen)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Toggle Viewer">
                    {isDocumentPanelOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                  </button>
                </div>
                <div className="md:hidden"><button onClick={() => setMobileMenuOpen(true)}><Menu size={24} /></button></div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                <div className="max-w-3xl mx-auto">
                  {messages.map(m => (
                    <ChatMessage 
                      key={m.id} 
                      message={m} 
                      onAudioStart={(id) => setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: s.messages.map(msg => ({...msg, isAudioPlaying: msg.id === id})) } : s))}
                      onAudioEnd={() => setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: s.messages.map(msg => ({...msg, isAudioPlaying: false})) } : s))}
                      onPageClick={setActivePageToScroll} 
                    />
                  ))}
                  {isLoading && <div className="p-4 bg-white border border-slate-200 rounded-2xl animate-pulse text-xs text-slate-400 font-medium">Model is reasoning...</div>}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <footer className="p-4 border-t border-slate-100 bg-white">
                <div className="max-w-3xl mx-auto flex gap-2">
                  <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Ask about visuals or text..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  <button onClick={handleSendMessage} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md transition-all"><Send size={20} /></button>
                </div>
              </footer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;