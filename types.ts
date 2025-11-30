export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isAudioPlaying?: boolean;
}

export interface PDFData {
  name: string;
  text: string;
  pageCount: number;
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  CHAT = 'CHAT',
}

export type AIMode = 'cloud' | 'local' | 'unavailable';

declare global {
  interface Window {
    pdfjsLib: any;
    ai?: {
      languageModel: {
        capabilities: () => Promise<{ available: 'readily' | 'after-download' | 'no'; defaultTopK?: number; maxTopK?: number; defaultTemperature?: number }>;
        create: (options?: any) => Promise<{
          prompt: (input: string) => Promise<string>;
          promptStreaming: (input: string) => AsyncIterable<string>;
          destroy: () => void;
        }>;
      };
    };
  }
}