import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppState, Message, DocumentData, AIMode, Session } from './types';
import FileUpload from './components/FileUpload';
import ChatMessage from './components/ChatMessage';
import DocumentViewer from './components/DocumentViewer';
import { generateAnswer, checkLocalCapability } from './services/geminiService';
import { Send, BookOpen, Plus, Trash2, Menu, History, Layers, ArrowLeft, PanelLeftClose, PanelLeftOpen, MessageSquare, Loader2 } from 'lucide-react';

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
  const [isAppReady, setIsAppReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = useMemo(() => sessions.find(s => s.id === currentSessionId), [sessions, currentSessionId]);
  const messages = useMemo(() => currentSession?.messages || [], [currentSession]);
  const documents = useMemo(() => currentSession?.documents || [], [currentSession]);

  useEffect(() => {
    const initApp = async () => {
      const saved = localStorage.getItem('read_pdf_sessions');
      if (saved) {
        try {
          const parsed: Session[] = JSON.parse(saved);
          if (parsed.length > 0) {
            setSessions(parsed);
            setCurrentSessionId(parsed[0].id);
            setAppState(AppState.CHAT);
          }
        } catch (e) {
          console.error("Failed to parse saved sessions", e);
        }
      }
      
      const mode = await checkLocalCapability();
      setAiMode(mode);
      setIsAppReady(true);
    };

    initApp();

    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => { 
      window.removeEventListener('online', updateOnline); 
      window.removeEventListener('offline', updateOnline); 
    };
  }, []);

  useEffect(() => {
    if (isAppReady) {
      localStorage.setItem('read_pdf_sessions', JSON.stringify(sessions));
    }
  }, [sessions, isAppReady]);

  useEffect(() => {
    if (appState === AppState.CHAT) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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
        content: `Analysis complete! I've processed ${docs.length} file(s). ${hasImages ? "I'm ready to answer questions about the visuals and text." : "What would you like to know?"}`,
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
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...updatedMessages, { id: Date.now().toString(), role: 'model', content: "Something went wrong while thinking. Check your connection.", timestamp: Date.now() }] } : s));
    } finally { 
      setIsLoading(false); 
    }
  };

  if (!isAppReady) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-4" />
        <p className="text-sm font-medium animate-pulse">Initializing Interface...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden text-slate-900">
      {/* Sidebar - Appears on Left or Overlay on Mobile */}
      <aside className={`fixed inset-0 z-40 bg-slate-900 text-slate-300 transform transition-transform duration-300 md:relative md:transform-none md:w-64 md:flex md:flex-col ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between p-6 border-b border-slate-800 text-white font-bold">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-indigo-400" /> 
            <span>Read Anything</span>
          </div>
          <button className="md:hidden" onClick={() => setMobileMenuOpen(false)}>
            <ArrowLeft size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => { setAppState(AppState.UPLOAD); setMobileMenuOpen(false); }} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${appState === AppState.UPLOAD ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}
          >
            <Plus size={20} /> New Analysis
          </button>
          
          <div className="pt-6 pb-2 px-4 text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
            <History size={12} /> Recent Sessions
          </div>
          
          {sessions.map(s => (
            <div key={s.id} className={`group flex items-center rounded-xl transition-all ${s.id === currentSessionId && appState === AppState.CHAT ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 text-slate-400'}`}>
              <button 
                onClick={() => { setCurrentSessionId(s.id); setAppState(AppState.CHAT); setMobileMenuOpen(false); }} 
                className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0"
              >
                <Layers size={16} className="opacity-70 flex-shrink-0" />
                <span className="truncate text-sm font-medium">{s.documents[0]?.name || "Untitled"}</span>
              </button>
              <button 
                onClick={() => setSessions(prev => prev.filter(sess => sess.id !== s.id))} 
                className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col h-full bg-white relative">
        {appState === AppState.UPLOAD ? (
          <div className="h-full flex flex-col bg-slate-50">
            {sessions.length > 0 && (
              <header className="p-4 border-b border-slate-200 bg-white">
                <button onClick={() => setAppState(AppState.CHAT)} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                  <MessageSquare size={18} /> Resume Last Chat
                </button>
              </header>
            )}
            <div className="flex-1 flex items-center justify-center p-4">
              <FileUpload onUploadComplete={handleUploadComplete} />
            </div>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col md:flex-row overflow-hidden">
            {/* Split Pane: Document Viewer (Optional Left) */}
            <div className={`h-full bg-slate-100 border-r border-slate-200 transition-all duration-500 ease-in-out ${isDocumentPanelOpen ? 'flex-1 md:w-1/2 lg:w-3/5' : 'w-0 opacity-0 invisible overflow-hidden'}`}>
              <DocumentViewer documents={documents} scrollToPage={activePageToScroll} />
            </div>
            
            {/* Split Pane: Chat Window (Main Right) */}
            <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isDocumentPanelOpen ? 'md:w-1/2 lg:w-2/5' : 'w-full'}`}>
              <header className="flex-shrink-0 h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white z-10">
                <div className="flex items-center gap-4">
                  <button onClick={() => setAppState(AppState.UPLOAD)} className="flex items-center gap-1.5 text-xs font-black tracking-widest text-slate-400 hover:text-indigo-600 transition-colors">
                    <ArrowLeft size={16} /> BACK
                  </button>
                  <div className="w-px h-6 bg-slate-200"></div>
                  <button 
                    onClick={() => setIsDocumentPanelOpen(!isDocumentPanelOpen)} 
                    className={`p-2 rounded-lg transition-colors ${isDocumentPanelOpen ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}
                    title="Toggle Document Viewer"
                  >
                    {isDocumentPanelOpen ? <PanelLeftClose size={22} /> : <PanelLeftOpen size={22} />}
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} title={isOnline ? 'Online' : 'Offline'}></div>
                  <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 hover:bg-slate-100 rounded-lg">
                    <Menu size={24} />
                  </button>
                </div>
              </header>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                <div className="max-w-3xl mx-auto space-y-6">
                  {messages.map(m => (
                    <ChatMessage 
                      key={m.id} 
                      message={m} 
                      onAudioStart={(id) => setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: s.messages.map(msg => ({...msg, isAudioPlaying: msg.id === id})) } : s))}
                      onAudioEnd={() => setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: s.messages.map(msg => ({...msg, isAudioPlaying: false})) } : s))}
                      onPageClick={setActivePageToScroll} 
                    />
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-sm flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-tighter">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <footer className="p-4 border-t border-slate-100 bg-white">
                <div className="max-w-3xl mx-auto relative flex gap-2">
                  <input 
                    type="text" 
                    value={inputText} 
                    onChange={e => setInputText(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                    placeholder="Ask about text or images..." 
                    className="flex-1 bg-slate-100 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-500/30 transition-shadow text-sm" 
                  />
                  <button 
                    onClick={handleSendMessage} 
                    disabled={isLoading || !inputText.trim()}
                    className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center"
                  >
                    <Send size={20} />
                  </button>
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