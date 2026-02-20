
import React, { useState } from 'react';
import { Message } from '../types';
import { Bot, User, Volume2, Loader2, WifiOff, FileSearch, AudioLines } from 'lucide-react';
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
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const handlePlayAudio = async () => {
    if (message.isAudioPlaying) {
      audioService.stop();
      onAudioEnd(message.id);
      return;
    }

    setIsSynthesizing(true);
    try {
      let base64Audio: string | null = null;
      
      // Path: Text -> TTS Model
      if (navigator.onLine && process.env.API_KEY) {
        try {
          base64Audio = await generateSpeech(message.content);
        } catch (e) {
          console.warn("Cloud TTS failed, using browser fallback");
        }
      }

      // Path: Audio Data -> Speaker
      onAudioStart(message.id);
      setIsSynthesizing(false); // Move from synthesizing state to playing state
      
      await audioService.play(
        { text: message.content, base64Audio }, 
        () => onAudioEnd(message.id)
      );
      
    } catch (e) {
      console.error("Failed to execute TTS flow", e);
      onAudioEnd(message.id);
      setIsSynthesizing(false);
    }
  };

  const renderContent = (text: string) => {
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
          className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600 transition-colors border border-slate-200"
        >
          <FileSearch size={10} />
          {label}
        </button>
      );
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.substring(lastIndex));
    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[80%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        <div className={`relative px-5 py-4 rounded-2xl shadow-sm text-sm leading-relaxed ${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>
          <div className="whitespace-pre-wrap">{isUser ? message.content : renderContent(message.content)}</div>

          {!isUser && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={handlePlayAudio}
                className={`flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-md transition-all ${message.isAudioPlaying ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                {isSynthesizing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : message.isAudioPlaying ? (
                  <AudioLines size={14} className="animate-pulse" />
                ) : (
                  <Volume2 size={14} />
                )}
                <span>
                  {isSynthesizing ? 'Synthesizing...' : message.isAudioPlaying ? 'Reading...' : 'Read Aloud'}
                </span>
              </button>
              
              {!navigator.onLine && !message.isAudioPlaying && (
                 <div className="flex items-center gap-1 text-xs text-slate-400">
                   <WifiOff size={12} />
                   <span>Browser Voice</span>
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
