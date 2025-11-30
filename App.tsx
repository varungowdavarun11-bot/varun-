import React, { useState, useRef, useEffect } from 'react';
import { AppState, Message, PDFData, AIMode } from './types';
import FileUpload from './components/FileUpload';
import ChatMessage from './components/ChatMessage';
import { generateAnswer, checkLocalCapability } from './services/geminiService';
import { Send, ArrowLeft, BookOpen, AlertTriangle, Cloud, Laptop, Wifi, WifiOff } from 'lucide-react';
import { audioService } from './services/audioService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [pdfData, setPdfData] = useState<PDFData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>('unavailable');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check capabilities and network on mount
  useEffect(() => {
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

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleUploadComplete = (data: PDFData) => {
    setPdfData(data);
    setAppState(AppState.CHAT);
    // Add initial greeting
    setMessages([
      {
        id: 'init-1',
        role: 'model',
        content: `I've analyzed **${data.name}** (${data.pageCount} pages). What would you like to know about it?`,
        timestamp: Date.now()
      }
    ]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !pdfData || isLoading) return;

    // Check if we can actually generate an answer
    if (!isOnline && aiMode !== 'local') {
      setMessages(prev => [...prev, {
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

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Prepare history for API
      const historyForApi = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
      }));

      // If we are offline but have local mode, force local mode usage
      const modeToUse = (!isOnline && aiMode === 'local') ? 'local' : aiMode;

      const answer = await generateAnswer(pdfData.text, userMsg.content, historyForApi, modeToUse);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: answer,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setMessages(prev => [...prev, {
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
    setMessages(prev => prev.map(m => ({
      ...m,
      isAudioPlaying: m.id === id
    })));
  };

  const handleAudioEnd = (id: string) => {
    setMessages(prev => prev.map(m => ({
      ...m,
      isAudioPlaying: false
    })));
  };

  const handleReset = () => {
    audioService.stop();
    setPdfData(null);
    setMessages([]);
    setAppState(AppState.UPLOAD);
  };

  // Block only if BOTH cloud and local are unavailable AND we are online (checking capabilities failed).
  // If we are offline, we might just be unable to check cloud, but if aiMode is 'unavailable' and no API Key, we can't do anything.
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
              <br/><br/>
              To run offline, enable <b>Chrome Built-in AI</b>. 
              To run online, set the <code>API_KEY</code> environment variable.
            </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6 justify-between flex-shrink-0 z-10 transition-colors duration-300">
        <div className="flex items-center gap-3">
          {appState === AppState.CHAT && (
            <button 
              onClick={handleReset}
              className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
              title="Back to upload"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isOnline ? 'bg-indigo-600' : 'bg-slate-600'} text-white`}>
              <BookOpen size={18} />
            </div>
            <span className="font-semibold text-slate-800 tracking-tight">StudyMate AI</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           {/* Connection/Mode Indicator */}
           <div className={`
             flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-300
             ${!isOnline 
               ? (aiMode === 'local' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200')
               : (aiMode === 'local' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200')
             }
           `}>
             {!isOnline ? (
               aiMode === 'local' ? (
                 <>
                   <WifiOff size={12} />
                   <span className="hidden sm:inline">Offline • On-Device Ready</span>
                   <span className="sm:hidden">Offline</span>
                 </>
               ) : (
                 <>
                   <WifiOff size={12} />
                   <span>Offline</span>
                 </>
               )
             ) : (
               aiMode === 'local' ? (
                 <>
                   <Laptop size={12} />
                   <span className="hidden sm:inline">On-Device AI</span>
                   <span className="sm:hidden">Local</span>
                 </>
               ) : (
                 <>
                   <Cloud size={12} />
                   <span className="hidden sm:inline">Cloud AI</span>
                   <span className="sm:hidden">Cloud</span>
                 </>
               )
             )}
           </div>

           {appState === AppState.CHAT && pdfData && (
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
              <span className="font-medium text-slate-700 truncate max-w-[200px]">{pdfData.name}</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <span>{pdfData.pageCount} pages</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {!isOnline && appState === AppState.UPLOAD && aiMode !== 'local' && (
          <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs font-medium py-1 text-center z-20">
            No internet connection. Cloud features unavailable.
          </div>
        )}

        {appState === AppState.UPLOAD ? (
          <div className="h-full flex items-center justify-center">
            <FileUpload onUploadComplete={handleUploadComplete} />
          </div>
        ) : (
          <div className="h-full flex flex-col max-w-3xl mx-auto w-full bg-white shadow-xl shadow-slate-200/50 md:border-x border-slate-200">
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide">
               {messages.map((msg) => (
                 <ChatMessage 
                    key={msg.id} 
                    message={msg} 
                    onAudioStart={handleAudioStart}
                    onAudioEnd={handleAudioEnd}
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
                        {(aiMode === 'local' || !isOnline) ? 'Processing on device...' : 'Thinking...'}
                      </span>
                    </div>
                 </div>
               )}
               <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-100 bg-white">
              <div className="relative flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    !isOnline 
                      ? (aiMode === 'local' ? "Ask question (Offline Mode)..." : "Waiting for connection...") 
                      : (aiMode === 'local' ? "Ask question (Local Mode)..." : "Ask a question...")
                  }
                  disabled={isLoading || (!isOnline && aiMode !== 'local')}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3.5 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isLoading || (!isOnline && aiMode !== 'local')}
                  className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-center text-xs text-slate-400 mt-3">
                {(!isOnline || aiMode === 'local')
                  ? 'Running privately on your device. Answers are generated offline.' 
                  : 'AI answers are generated based on document content. Verify important details.'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;