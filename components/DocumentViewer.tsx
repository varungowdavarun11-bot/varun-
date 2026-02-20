import React, { useEffect, useState, useRef } from 'react';
import { DocumentData } from '../types';
import { Loader2, FileText } from 'lucide-react';

interface DocumentViewerProps {
  documents: DocumentData[];
  scrollToPage?: number | null;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documents, scrollToPage }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [content, setContent] = useState<React.ReactNode>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeDoc = documents[activeIndex];

  useEffect(() => {
    if (!activeDoc) return;

    const loadContent = async () => {
      setLoading(true);
      try {
        if (!activeDoc.file) {
          setContent(
            <div className="p-8 h-full overflow-y-auto bg-white" ref={containerRef}>
              <div className="max-w-3xl mx-auto">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg mb-4 text-xs">Viewing extracted text from history.</div>
                <div className="font-mono text-xs whitespace-pre-wrap p-4 bg-slate-50 border rounded-lg">{activeDoc.text}</div>
              </div>
            </div>
          );
          return;
        }

        const file = activeDoc.file;
        const fileType = activeDoc.fileType;

        if (fileType === 'pdf') {
          const url = URL.createObjectURL(file);
          setContent(<iframe key={url} src={scrollToPage ? `${url}#page=${scrollToPage}` : url} className="w-full h-full border-none" />);
        } else if (fileType === 'image') {
          setContent(<div className="flex items-center justify-center h-full bg-slate-900/5 p-4 overflow-auto"><img src={URL.createObjectURL(file)} alt="Doc" className="max-w-full max-h-full object-contain shadow-lg rounded-lg" /></div>);
        } else if (fileType === 'excel' && window.XLSX) {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = window.XLSX.read(arrayBuffer);
          const html = window.XLSX.utils.sheet_to_html(workbook.Sheets[workbook.SheetNames[0]]);
          setContent(<div className="h-full overflow-auto bg-white p-6" dangerouslySetInnerHTML={{ __html: html }} />);
        } else {
          setContent(<div className="h-full overflow-y-auto bg-white p-8"><div className="font-mono text-sm whitespace-pre-wrap">{activeDoc.text}</div></div>);
        }
      } catch (e) {
        setContent(<div className="p-10 text-red-500">Error loading document.</div>);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [activeDoc, scrollToPage]);

  if (documents.length === 0) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* File Switcher Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 flex items-center overflow-x-auto p-2 gap-2 scrollbar-hide">
        {documents.map((doc, idx) => (
          <button
            key={doc.id}
            onClick={() => setActiveIndex(idx)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${activeIndex === idx ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <FileText size={14} />
            <span className="truncate max-w-[120px]">{doc.name}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 relative bg-slate-100 overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
        ) : content}
      </div>
    </div>
  );
};

export default DocumentViewer;