export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isAudioPlaying?: boolean;
}

export type FileType = 'pdf' | 'image' | 'excel' | 'powerpoint' | 'text' | 'word';

export interface DocumentData {
  id: string;
  name: string;
  text: string;
  pageCount: number;
  fileType: FileType;
  file?: File;
  // Multimodal support
  base64Data?: string;
  mimeType?: string;
}

export interface Session {
  id: string;
  documents: DocumentData[];
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