import React, { useState } from 'react';
import { Message } from '../types';
import { Bot, User, Volume2, StopCircle, Loader2, WifiOff, FileSearch } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';
import { audioService } from '../services/audioService';

interface ChatMessageProps {
  message: Message;
  onAudioStart: (id: string) => void;
  onAudioEnd: (id: string) => void;
  onPageClick?: (page: number) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onAudioStart, onAudioEnd, onPageClick }) => {
  const isUser = message.role === 'user';
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const handlePlayAudio = async () => {
    if (message.isAudioPlaying) {
      audioService.stop();
      onAudioEnd(message.id);
      return;
    }

    setIsGeneratingAudio(true);
    try {
      // 1. Try to generate high-quality cloud audio ONLY if online and key exists
      let base64Audio: string | null = null;
      
      if (navigator.onLine && process.env.API_KEY) {
        try {
          base64Audio = await generateSpeech(message.content);
        } catch (e) {
          console.warn("Cloud TTS failed, falling back to local immediately");
        }
      }

      // 2. Play audio (Service handles fallback to local TTS if base64Audio is null)
      onAudioStart(message.id);
      await audioService.play(
        { text: message.content, base64Audio }, 
        () => onAudioEnd(message.id)
      );
      
    } catch (e) {
      console.error("Failed to play audio", e);
      onAudioEnd(message.id);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Helper to render text with clickable page links
  const renderContent = (text: string) => {
    // Regex matches [Page X], [Slide X], [Sheet X] (case insensitive)
    const regex = /\[(Page|Slide|Sheet)\s+(\d+)\]/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      const pageNum = parseInt(match[2], 10);
      const label = match[0];
      
      parts.push(
        <button
          key={match.index}
          onClick={() => onPageClick && onPageClick(pageNum)}
          className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors align-baseline"
          title={`Go to ${label}`}
        >
          <FileSearch size={10} />
          {label}
        </button>
      );
      
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[80%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          ${isUser ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}
        `}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Bubble */}
        <div className={`
          relative px-5 py-4 rounded-2xl shadow-sm text-sm leading-relaxed
          ${isUser 
            ? 'bg-indigo-600 text-white rounded-tr-none' 
            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
          }
        `}>
          <div className="whitespace-pre-wrap">
             {isUser ? message.content : renderContent(message.content)}
          </div>

          {/* TTS Button (Only for Model) */}
          {!isUser && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={handlePlayAudio}
                disabled={isGeneratingAudio}
                className={`
                  flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-md transition-colors
                  ${message.isAudioPlaying 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }
                `}
              >
                {isGeneratingAudio ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : message.isAudioPlaying ? (
                  <StopCircle size={14} />
                ) : (
                  <Volume2 size={14} />
                )}
                <span>
                  {isGeneratingAudio ? 'Loading Audio...' : message.isAudioPlaying ? 'Stop Reading' : 'Read Aloud'}
                </span>
              </button>
              
              {!navigator.onLine && !message.isAudioPlaying && (
                 <div className="flex items-center gap-1 text-xs text-slate-400" title="Using offline voice">
                   <WifiOff size={12} />
                   <span>Offline Voice</span>
                 </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;