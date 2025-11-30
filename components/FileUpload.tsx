import React, { useRef, useState } from 'react';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { extractTextFromPDF } from '../services/pdfService';
import { PDFData } from '../types';

interface FileUploadProps {
  onUploadComplete: (data: PDFData) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const data = await extractTextFromPDF(file);
      onUploadComplete(data);
    } catch (err) {
      console.error(err);
      setError('Failed to process PDF. Please try again.');
    } finally {
      setIsProcessing(false);
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
          StudyMate AI
        </h1>
        <p className="text-lg text-slate-600">
          Upload your course material, ask questions, and listen to the answers.
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
          accept=".pdf"
          onChange={handleFileSelect}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center animate-pulse">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-4" />
            <p className="text-indigo-600 font-medium text-lg">Analyzing document...</p>
            <p className="text-slate-400 text-sm mt-2">This utilizes local browser capabilities</p>
          </div>
        ) : (
          <>
            <div className={`
              w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-6
              group-hover:scale-110 transition-transform duration-300
            `}>
              <Upload className="w-10 h-10 text-indigo-600" />
            </div>
            
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Drop your PDF here
            </h3>
            <p className="text-slate-500 text-center mb-6 max-w-xs">
              or click to browse from your device
            </p>

            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">Supports PDF up to 50MB</span>
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
