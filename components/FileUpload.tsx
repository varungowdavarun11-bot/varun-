import React, { useRef, useState } from 'react';
import { Upload, FileText, Loader2, AlertCircle, X, Trash2 } from 'lucide-react';
import { extractTextFromDocument } from '../services/pdfService'; 
import { DocumentData } from '../types';

interface FileUploadProps {
  onUploadComplete: (docs: DocumentData[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)]);
  };

  const startAnalysis = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const results = await Promise.all(selectedFiles.map(file => extractTextFromDocument(file)));
      onUploadComplete(results);
    } catch (err: any) {
      setError(err.message || 'Failed to process files.');
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-6">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Read Anything</h1>
        <p className="text-lg text-slate-600">Upload documents and images for deep visual and textual analysis.</p>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-2xl p-10 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer group ${isDragging ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input type="file" ref={fileInputRef} className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.pptx,.ppt,.txt,.docx" onChange={handleFileSelect} />
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4"><Upload className="w-8 h-8 text-indigo-600" /></div>
        <h3 className="text-lg font-semibold text-slate-800">Click or drag files here</h3>
      </div>

      {selectedFiles.length > 0 && !isProcessing && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Selected Files ({selectedFiles.length})</h4>
            <button onClick={() => setSelectedFiles([])} className="text-xs font-medium text-slate-400 hover:text-red-500 flex items-center gap-1">
              <Trash2 size={12} /> Clear All
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
            {selectedFiles.map((file, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl group">
                <div className="flex items-center gap-3 truncate">
                  <FileText size={18} className="text-indigo-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{file.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setSelectedFiles(prev => prev.filter((_, idx) => idx !== i)); }} className="p-1 text-slate-400 hover:text-red-500"><X size={16} /></button>
              </div>
            ))}
          </div>
          <button onClick={startAnalysis} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-lg transition-all">Start Analysis</button>
        </div>
      )}

      {isProcessing && (
        <div className="mt-10 flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-indigo-600 font-medium animate-pulse">Processing Multimodal Content...</p>
        </div>
      )}

      {error && <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 flex gap-3 items-center"><AlertCircle size={20} />{error}</div>}
    </div>
  );
};

export default FileUpload;