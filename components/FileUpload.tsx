import React, { useRef, useState } from 'react';
import { Upload, FileText, Loader2, AlertCircle, Image as ImageIcon, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import { extractTextFromDocument } from '../services/pdfService'; 
import { DocumentData } from '../types';

interface FileUploadProps {
  onUploadComplete: (data: DocumentData) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Analyzing document...');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    
    // Custom status messages based on file type
    if (file.type.startsWith('image/')) {
      setStatusMessage('Reading text from image (OCR)...');
    } else if (file.name.endsWith('.pptx')) {
      setStatusMessage('Extracting slides...');
    } else if (file.name.endsWith('.docx')) {
      setStatusMessage('Reading Word document...');
    } else {
      setStatusMessage('Analyzing document...');
    }

    try {
      const data = await extractTextFromDocument(file);
      onUploadComplete(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to process file. Please try again.');
    } finally {
      setIsProcessing(false);
      setStatusMessage('Analyzing document...');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-6">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">
          Read Anything
        </h1>
        <p className="text-lg text-slate-600">
          Upload PDF, Word, Excel, PowerPoint, or Images to ask questions and listen to answers.
        </p>
      </div>

      <div
        className={`
          relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ease-in-out
          flex flex-col items-center justify-center cursor-pointer group
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' 
            : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
          }
          ${isProcessing ? 'opacity-75 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.pptx,.ppt,.txt,.docx"
          onChange={handleFileSelect}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center animate-pulse">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-4" />
            <p className="text-indigo-600 font-medium text-lg">{statusMessage}</p>
            <p className="text-slate-400 text-sm mt-2">Processing on your device...</p>
          </div>
        ) : (
          <>
            <div className={`
              w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-6
              group-hover:scale-110 transition-transform duration-300 relative
            `}>
              <Upload className="w-10 h-10 text-indigo-600" />
            </div>
            
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Drop your file here
            </h3>
            <p className="text-slate-500 text-center mb-6 max-w-xs">
              PDF, Word, Excel, PowerPoint, Images
            </p>

            <div className="flex flex-wrap gap-2 justify-center">
              <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium flex items-center gap-1">
                <FileText size={12} /> PDF
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium flex items-center gap-1">
                <FileText size={12} /> DOCX
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium flex items-center gap-1">
                <ImageIcon size={12} /> IMG
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium flex items-center gap-1">
                <FileSpreadsheet size={12} /> XLS
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium flex items-center gap-1">
                <FileIcon size={12} /> PPT
              </span>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;