export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isAudioPlaying?: boolean;
}

export type FileType = 'pdf' | 'image' | 'excel' | 'powerpoint' | 'text' | 'word';

export interface DocumentData {
  name: string;
  text: string;
  pageCount: number; // Acts as "units" (pages, slides, sheets)
  fileType: FileType;
  file?: File;
}

export interface Session {
  id: string;
  documentData: DocumentData;
  messages: Message[];
  createdAt: number;
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  CHAT = 'CHAT',
}

export type AIMode = 'cloud' | 'local' | 'unavailable';

declare global {
  interface Window {
    pdfjsLib: any;
    XLSX: any;
    JSZip: any;
    Tesseract: any;
    mammoth: any;
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