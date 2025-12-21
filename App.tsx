import React, { useState, useRef, useEffect } from 'react';
import { AppState, Message, DocumentData, AIMode, Session } from './types';
import FileUpload from './components/FileUpload';
import ChatMessage from './components/ChatMessage';
import DocumentViewer from './components/DocumentViewer';
import { generateAnswer, checkLocalCapability } from './services/geminiService';
import { Send, BookOpen, AlertTriangle, Plus, Trash2, Menu, X, History, FileSpreadsheet, File as FileIcon, Image as ImageIcon, FileText, PanelLeftClose, PanelLeftOpen, MessageSquare, Eye, Layers } from 'lucide-react';
import { audioService } from './services/audioService';

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
    const hOnline = () => setIsOnline(true);
    const hOffline = () => setIsOnline(false);
    window.addEventListener('online', hOnline);
    window.addEventListener('offline', hOffline);
    return () => { window.removeEventListener('online', hOnline); window.removeEventListener('offline', hOffline); };
  }, []);

  useEffect(() => {
    localStorage.setItem('read_pdf_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (appState === AppState.CHAT && !isDocumentPanelOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, appState, isDocumentPanelOpen]);

  const updateCurrentSessionMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: typeof updater === 'function' ? updater(s.messages) : updater } : s));
  };

  const handleUploadComplete = (docs: DocumentData[]) => {
    const newId = Date.now().toString();
    const newSession: Session = {
      id: newId,
      documents: docs,
      messages: [{
        id: 'init-1',
        role: 'model',
        content: `I've analyzed ${docs.length} document(s). You can ask questions about any of them, or compare their contents.`,
        timestamp: Date.now()
      }],
      createdAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setAppState(AppState.CHAT);
    setMobileMenuOpen(false);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || documents.length === 0 || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputText, timestamp: Date.now() };
    updateCurrentSessionMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
      const answer = await generateAnswer(documents, userMsg.content, history, isOnline ? aiMode : 'local');
      updateCurrentSessionMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: answer, timestamp: Date.now() }]);
    } catch (e) {
      updateCurrentSessionMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: "An error occurred.", timestamp: Date.now() }]);
    } finally { setIsLoading(false); }
  };

  const getFileIcon = (type?: string) => {
    switch(type) {
      case 'excel': return <FileSpreadsheet size={16} />;
      case 'image': return <ImageIcon size={16} />;
      case 'word': return <FileText size={16} />;
      default: return <FileIcon size={16} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden text-slate-900">
      <aside className={`fixed inset-0 z-40 bg-slate-900 text-slate-300 transform transition-transform md:relative md:transform-none md:w-64 md:flex md:flex-col ${mobileMenuOpen ? 'translate-x-0 pt-16' : '-translate-x-full'}`}>
        <div className="hidden md:flex items-center gap-3 p-6 border-b border-slate-800 text-white font-bold"><BookOpen size={20} className="text-indigo-400" /> Read Anything</div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => { setAppState(AppState.UPLOAD); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${appState === AppState.UPLOAD ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Plus size={20} /> New Analysis</button>
          <div className="pt-6 pb-2 px-4 text-xs font-bold uppercase text-slate-500 flex items-center gap-2"><History size={12} /> Recent</div>
          {sessions.map(s => (
            <div key={s.id} className={`group flex items-center rounded-xl transition-all ${s.id === currentSessionId && appState === AppState.CHAT ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 text-slate-400'}`}>
              <button onClick={() => { setCurrentSessionId(s.id); setAppState(AppState.CHAT); setMobileMenuOpen(false); }} className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
                <Layers size={16} className="opacity-70 flex-shrink-0" />
                <div className="text-left truncate min-w-0">
                  <div className="truncate text-sm font-medium">{s.documents[0]?.name}{s.documents.length > 1 ? ` +${s.documents.length-1}` : ''}</div>
                </div>
              </button>
              <button onClick={(e) => { e.stopPropagation(); setSessions(prev => prev.filter(sess => sess.id !== s.id)); if (s.id === currentSessionId) setAppState(AppState.UPLOAD); }} className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {appState === AppState.UPLOAD ? <div className="h-full flex items-center justify-center p-4"><FileUpload onUploadComplete={handleUploadComplete} /></div> : (
          <div className="h-full w-full flex flex-col md:flex-row overflow-hidden relative">
            <div className={`h-full bg-slate-100 border-r border-slate-200 transition-all ${isDocumentPanelOpen ? 'flex-1 md:w-1/2 lg:w-3/5' : 'w-0 hidden'}`}>
              <DocumentViewer documents={documents} scrollToPage={activePageToScroll} />
            </div>
            <div className={`flex flex-col h-full bg-white transition-all ${isDocumentPanelOpen ? 'hidden md:flex md:w-1/2 lg:w-2/5' : 'flex w-full'}`}>
              <header className="flex-shrink-0 h-14 border-b border-slate-100 flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsDocumentPanelOpen(!isDocumentPanelOpen)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors">
                    {isDocumentPanelOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                  </button>
                  <div className="font-semibold text-sm truncate max-w-[200px]">{documents.length} File(s) Loaded</div>
                </div>
                <div className="md:hidden"><button onClick={() => setMobileMenuOpen(true)}><Menu size={24} /></button></div>
              </header>
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                <div className="max-w-3xl mx-auto">
                  {messages.map(m => <ChatMessage key={m.id} message={m} onAudioStart={(id) => updateCurrentSessionMessages(prev => prev.map(msg => ({...msg, isAudioPlaying: msg.id === id})))} onAudioEnd={() => updateCurrentSessionMessages(prev => prev.map(msg => ({...msg, isAudioPlaying: false})))} onPageClick={setActivePageToScroll} />)}
                  {isLoading && <div className="p-4 bg-white border rounded-2xl animate-pulse text-xs text-slate-400">Thinking...</div>}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              <div className="p-4 border-t border-slate-100">
                <div className="max-w-3xl mx-auto relative flex gap-2">
                  <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Ask about the documents..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/20" />
                  <button onClick={handleSendMessage} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"><Send size={20} /></button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;