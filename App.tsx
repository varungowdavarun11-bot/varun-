import React, { useState, useRef, useEffect } from 'react';
import { AppState, Message, DocumentData, AIMode, Session } from './types';
import FileUpload from './components/FileUpload';
import ChatMessage from './components/ChatMessage';
import DocumentViewer from './components/DocumentViewer';
import { generateAnswer, checkLocalCapability } from './services/geminiService';
import { Send, BookOpen, AlertTriangle, Plus, Trash2, Menu, X, History, FileSpreadsheet, File as FileIcon, Image as ImageIcon, FileText, PanelLeftClose, PanelLeftOpen, MessageSquare, Eye } from 'lucide-react';
import { audioService } from './services/audioService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  
  // State for multiple sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>('unavailable');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Document Panel State
  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState(false);
  const [activePageToScroll, setActivePageToScroll] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derived state for the current active session
  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];
  const documentData = currentSession?.documentData || null;

  // Load sessions from storage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('read_pdf_sessions');
    if (savedSessions) {
      try {
        const parsed: Session[] = JSON.parse(savedSessions);
        if (parsed.length > 0) {
          setSessions(parsed);
          setCurrentSessionId(parsed[0].id);
          setAppState(AppState.CHAT);
        }
      } catch (e) {
        console.error("Failed to restore sessions", e);
      }
    }

    checkLocalCapability().then(setAiMode);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persist sessions whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('read_pdf_sessions', JSON.stringify(sessions));
    } catch (e) {
      console.warn("Session storage limit reached or error", e);
    }
  }, [sessions]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (appState === AppState.CHAT && !isDocumentPanelOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, appState, isDocumentPanelOpen]);

  // Helper to update messages for the active session
  const updateCurrentSessionMessages = (newMessagesOrUpdater: Message[] | ((prev: Message[]) => Message[])) => {
    setSessions(prevSessions => {
      return prevSessions.map(session => {
        if (session.id === currentSessionId) {
          const updatedMessages = typeof newMessagesOrUpdater === 'function'
            ? newMessagesOrUpdater(session.messages)
            : newMessagesOrUpdater;
          return { ...session, messages: updatedMessages };
        }
        return session;
      });
    });
  };

  const handleUploadComplete = (data: DocumentData) => {
    const newSessionId = Date.now().toString();
    
    // Determine unit label and generic document descriptor
    let unitLabel = 'pages';
    let docLabel = 'document';
    
    if (data.fileType === 'excel') { unitLabel = 'sheets'; docLabel = 'spreadsheet'; }
    if (data.fileType === 'powerpoint') { unitLabel = 'slides'; docLabel = 'presentation'; }
    if (data.fileType === 'image') { unitLabel = 'image'; docLabel = 'image'; }
    if (data.fileType === 'word') { unitLabel = 'document'; docLabel = 'document'; }

    // If it's a single image, omitting the count "(1 image)" looks cleaner.
    const stats = (data.fileType === 'image') ? '' : ` (${data.pageCount} ${unitLabel})`;

    const newSession: Session = {
      id: newSessionId,
      documentData: data,
      messages: [{
        id: 'init-1',
        role: 'model',
        content: `I've analyzed this ${docLabel}${stats}. What would you like to know about it?`,
        timestamp: Date.now()
      }],
      createdAt: Date.now()
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setAppState(AppState.CHAT);
    setMobileMenuOpen(false);
    setIsDocumentPanelOpen(false); // Default to chat view
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !documentData || isLoading) return;

    if (!isOnline && aiMode !== 'local') {
      updateCurrentSessionMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: "I'm offline and don't have access to the On-Device AI. Please check your internet connection.",
        timestamp: Date.now()
      }]);
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      timestamp: Date.now()
    };

    updateCurrentSessionMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const historyForApi = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
      }));

      const modeToUse = (!isOnline && aiMode === 'local') ? 'local' : aiMode;

      const answer = await generateAnswer(
        documentData.text, 
        userMsg.content, 
        historyForApi, 
        modeToUse,
        { pageCount: documentData.pageCount, fileType: documentData.fileType }
      );
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: answer,
        timestamp: Date.now()
      };

      updateCurrentSessionMessages(prev => [...prev, botMsg]);
    } catch (error) {
      updateCurrentSessionMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "I'm sorry, I encountered an error while trying to answer your question. Please check your connection or try again.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAudioStart = (id: string) => {
    updateCurrentSessionMessages(prev => prev.map(m => ({
      ...m,
      isAudioPlaying: m.id === id
    })));
  };

  const handleAudioEnd = (id: string) => {
    updateCurrentSessionMessages(prev => prev.map(m => ({
      ...m,
      isAudioPlaying: false
    })));
  };
  
  const handlePageClick = (page: number) => {
      setIsDocumentPanelOpen(true);
      setActivePageToScroll(page);
  };

  // Sidebar Actions
  const handleNewFile = () => {
    setAppState(AppState.UPLOAD);
    audioService.stop();
    setMobileMenuOpen(false);
  };

  const handleSwitchSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setAppState(AppState.CHAT);
    audioService.stop();
    setMobileMenuOpen(false);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    audioService.stop();
    
    setSessions(prev => {
      const newSessions = prev.filter(s => s.id !== sessionId);
      if (sessionId === currentSessionId) {
        if (newSessions.length > 0) {
          setCurrentSessionId(newSessions[0].id);
        } else {
          setCurrentSessionId(null);
          setAppState(AppState.UPLOAD);
        }
      }
      return newSessions;
    });
  };

  const handleClearCurrentChat = () => {
    if (!currentSessionId || !documentData) return;
    
    audioService.stop();

    let docLabel = 'document';
    if (documentData.fileType === 'image') docLabel = 'image';
    if (documentData.fileType === 'excel') docLabel = 'spreadsheet';
    if (documentData.fileType === 'powerpoint') docLabel = 'presentation';

    updateCurrentSessionMessages([{
      id: `reset-${Date.now()}`,
      role: 'model',
      content: `Conversation cleared. I'm ready for new questions about this ${docLabel}.`,
      timestamp: Date.now()
    }]);
    setMobileMenuOpen(false);
  };

  const getFileIcon = (type?: string) => {
    switch(type) {
      case 'excel': return <FileSpreadsheet size={16} />;
      case 'powerpoint': return <FileIcon size={16} />;
      case 'image': return <ImageIcon size={16} />;
      case 'word': return <FileText size={16} />;
      default: return <BookOpen size={16} />;
    }
  };

  // Error State
  if (aiMode === 'unavailable' && !process.env.API_KEY) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-red-200 max-w-md text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Configuration Missing</h2>
            <p className="text-gray-600 mb-4">
              Neither an API Key nor a Local AI model was found. 
            </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-3 bg-slate-900 text-white flex-shrink-0 z-50 shadow-md">
        <div className="flex items-center gap-2 truncate">
           <div className="text-indigo-400">{getFileIcon(documentData?.fileType)}</div>
           <span className="font-semibold text-sm truncate max-w-[150px]">{documentData?.name || 'Read Anything'}</span>
        </div>
        <div className="flex items-center gap-2">
            {appState === AppState.CHAT && (
              <div className="flex bg-slate-800 rounded-lg p-1 mr-2">
                 <button 
                    onClick={() => setIsDocumentPanelOpen(!isDocumentPanelOpen)}
                    className="p-1.5 rounded-md transition-colors text-slate-400 hover:text-white"
                    title={isDocumentPanelOpen ? "Show Chat" : "Show Document"}
                 >
                    {isDocumentPanelOpen ? <MessageSquare size={18} /> : <Eye size={18} />}
                 </button>
              </div>
            )}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
        </div>
      </div>

      {/* Sidebar (Desktop + Mobile Menu) */}
      <aside className={`
        fixed inset-0 z-40 bg-slate-900 text-slate-300 transform transition-transform duration-300 ease-in-out
        md:relative md:transform-none md:translate-x-0 md:w-64 md:flex md:flex-col
        ${mobileMenuOpen ? 'translate-x-0 pt-16' : '-translate-x-full md:pt-0'}
      `}>
        {/* Desktop Logo */}
        <div className="hidden md:flex items-center gap-3 p-6 border-b border-slate-800 text-white">
          <div className="p-1.5 bg-indigo-600 rounded-lg">
             <BookOpen size={20} />
          </div>
          <span className="font-bold text-lg tracking-tight">Read Anything</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto flex flex-col">
          
          <button 
            onClick={handleNewFile}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium flex-shrink-0
              ${appState === AppState.UPLOAD ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}
            `}
          >
            <Plus size={20} />
            <span>New File</span>
          </button>

          {currentSession && (
             <button 
               onClick={handleClearCurrentChat}
               className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all duration-200 font-medium flex-shrink-0"
             >
               <Trash2 size={20} />
               <span>Clear Chat</span>
             </button>
          )}

          <div className="pt-6 pb-2 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 flex-shrink-0 flex items-center gap-2">
            <History size={12} />
            History
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {sessions.length === 0 ? (
              <div className="px-4 text-sm text-slate-600 italic">No history yet</div>
            ) : (
              sessions.map(session => (
                <div 
                  key={session.id} 
                  className={`group flex items-center rounded-xl transition-colors duration-200
                    ${session.id === currentSessionId && appState === AppState.CHAT ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 text-slate-400 hover:text-white'}
                  `}
                >
                  <button 
                    onClick={() => handleSwitchSession(session.id)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0"
                  >
                    <span className="flex-shrink-0 opacity-70">
                        {getFileIcon(session.documentData.fileType)}
                    </span>
                    <div className="text-left overflow-hidden min-w-0">
                      <span className="block truncate text-sm font-medium">{session.documentData.name}</span>
                      <span className="block text-xs opacity-60 truncate">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                  <button 
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="p-2 mr-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-500 px-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
            <span>{isOnline ? 'Online' : 'Offline'} Mode</span>
          </div>
          {aiMode === 'local' && (
            <div className="mt-2 text-xs text-indigo-400 bg-indigo-900/30 px-3 py-1.5 rounded-md border border-indigo-900/50">
              Running Local AI
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full bg-slate-50">
        {!isOnline && appState === AppState.UPLOAD && aiMode !== 'local' && (
          <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs font-medium py-1 text-center z-20">
            No internet connection. Cloud features unavailable.
          </div>
        )}

        {appState === AppState.UPLOAD ? (
          <div className="h-full flex items-center justify-center bg-slate-50 p-4">
             <div className="w-full max-w-xl animate-in fade-in zoom-in-95 duration-300">
                <FileUpload onUploadComplete={handleUploadComplete} />
             </div>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col md:flex-row overflow-hidden relative">
            
            {/* Document Viewer Column (Left) */}
            <div className={`
                h-full bg-slate-200 border-r border-slate-300 relative overflow-hidden transition-all duration-300
                ${isDocumentPanelOpen ? 'flex-1 md:w-1/2 lg:w-3/5' : 'w-0 hidden'}
            `}>
                {documentData ? (
                  <DocumentViewer documentData={documentData} scrollToPage={activePageToScroll} />
                ) : (
                   <div className="h-full flex items-center justify-center text-slate-400">No Document</div>
                )}
            </div>

            {/* Chat Column (Right) */}
            <div className={`
                flex-col h-full bg-white relative transition-all duration-300
                ${isDocumentPanelOpen ? 'hidden md:flex md:w-1/2 lg:w-2/5' : 'flex w-full'}
            `}>
                {/* Desktop Chat Header */}
                <header className="hidden md:flex flex-shrink-0 h-14 border-b border-slate-100 items-center justify-between px-6 bg-white z-10">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <button 
                           onClick={() => setIsDocumentPanelOpen(!isDocumentPanelOpen)}
                           className="text-slate-500 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-slate-100"
                           title={isDocumentPanelOpen ? "Close Document" : "Open Document"}
                        >
                            {isDocumentPanelOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        </button>
                        <div className="w-px h-6 bg-slate-200"></div>
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                            {getFileIcon(documentData?.fileType)}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <h2 className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">
                            {documentData?.name || 'Document'}
                            </h2>
                            <span className="text-xs text-slate-500">
                                {documentData?.pageCount} {documentData?.fileType === 'excel' ? 'sheets' : documentData?.fileType === 'powerpoint' ? 'slides' : documentData?.fileType === 'word' ? 'document' : 'pages'}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide bg-slate-50/50">
                    <div className="w-full max-w-3xl mx-auto">
                        {messages.map((msg) => (
                            <ChatMessage 
                                key={msg.id} 
                                message={msg} 
                                onAudioStart={handleAudioStart}
                                onAudioEnd={handleAudioEnd}
                                onPageClick={handlePageClick}
                            />
                        ))}
                        {isLoading && (
                            <div className="flex justify-start mb-6 animate-pulse">
                                <div className="bg-white border border-slate-100 px-5 py-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                                </div>
                                <span className="text-xs text-slate-400 font-medium">
                                    Thinking...
                                </span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-slate-100 bg-white">
                    <div className="w-full max-w-3xl mx-auto">
                        <div className="relative flex items-center gap-2">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask a question..."
                            disabled={isLoading || (!isOnline && aiMode !== 'local')}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3.5 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!inputText.trim() || isLoading}
                            className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            <Send size={18} />
                        </button>
                        </div>
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