import React, { useEffect, useState } from 'react';
import { DocumentData } from '../types';
import { Loader2, FileText, AlertCircle } from 'lucide-react';

interface DocumentViewerProps {
  documentData: DocumentData;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentData }) => {
  const [content, setContent] = useState<React.ReactNode>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadContent = async () => {
      // If we don't have the original file object (e.g. page reload), show the extracted text.
      if (!documentData.file) {
        setContent(
          <div className="p-8 h-full overflow-y-auto bg-white">
             <div className="max-w-3xl mx-auto">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
                   <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                   <p className="text-sm">
                     The original file is not available in this session (reloaded from history). 
                     Showing the extracted text instead.
                   </p>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Extracted Content</h3>
                <div className="font-mono text-xs md:text-sm whitespace-pre-wrap text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200">
                   {documentData.text}
                </div>
             </div>
          </div>
        );
        return;
      }

      setLoading(true);
      try {
        const file = documentData.file;
        const fileType = documentData.fileType;

        if (fileType === 'pdf') {
          const url = URL.createObjectURL(file);
          // Use object tag for PDF or iframe
          setContent(
            <iframe 
              src={url} 
              className="w-full h-full border-none bg-slate-200" 
              title="PDF Viewer"
            />
          );
        } else if (fileType === 'image') {
           const url = URL.createObjectURL(file);
           setContent(
             <div className="flex items-center justify-center h-full bg-slate-900/5 p-4 overflow-auto">
                <img src={url} alt="Document" className="max-w-full max-h-full object-contain shadow-xl rounded-lg bg-white" />
             </div>
           );
        } else if (fileType === 'word') {
          if (window.mammoth) {
             const arrayBuffer = await file.arrayBuffer();
             const result = await window.mammoth.convertToHtml({ arrayBuffer });
             setContent(
               <div className="h-full overflow-y-auto bg-slate-100 p-4 md:p-8">
                 <div 
                   className="bg-white shadow-lg p-8 md:p-12 min-h-full max-w-4xl mx-auto prose prose-slate prose-sm md:prose-base lg:prose-lg"
                   dangerouslySetInnerHTML={{ __html: result.value }}
                 />
               </div>
             );
          } else {
             throw new Error("Mammoth library missing");
          }
        } else if (fileType === 'excel') {
           if (window.XLSX) {
             const arrayBuffer = await file.arrayBuffer();
             const workbook = window.XLSX.read(arrayBuffer);
             // Render all sheets? Just first for now.
             const firstSheetName = workbook.SheetNames[0];
             const worksheet = workbook.Sheets[firstSheetName];
             const html = window.XLSX.utils.sheet_to_html(worksheet, { id: 'excel-table', editable: false });
             
             setContent(
               <div className="h-full overflow-auto bg-white p-4">
                 <div className="prose max-w-none">
                    <h3 className="text-sm font-semibold text-slate-500 mb-2">Sheet: {firstSheetName}</h3>
                    <div 
                        className="excel-preview overflow-x-auto border border-slate-200 rounded-lg"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                    <style>{`
                      .excel-preview table { border-collapse: collapse; width: 100%; font-size: 13px; }
                      .excel-preview td, .excel-preview th { border: 1px solid #e2e8f0; padding: 4px 8px; white-space: nowrap; }
                    `}</style>
                 </div>
               </div>
             );
           } else {
              throw new Error("XLSX library missing");
           }
        } else {
           // Default fallback (Text, PPT, etc)
           setContent(
            <div className="h-full overflow-y-auto bg-white p-6 md:p-8">
               <div className="max-w-3xl mx-auto">
                 <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Document Content</h3>
                 <div className="font-mono text-sm whitespace-pre-wrap text-slate-700 leading-relaxed">
                   {documentData.text}
                 </div>
               </div>
            </div>
          );
        }
      } catch (e) {
        console.error("Error rendering document preview", e);
        setContent(
          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
             <AlertCircle className="w-10 h-10 text-slate-400 mb-2" />
             <p className="text-slate-600 font-medium">Preview not available</p>
             <p className="text-slate-500 text-sm mt-1 mb-6">We couldn't render a visual preview for this file type.</p>
             <div className="w-full max-w-2xl text-left bg-white p-4 rounded-lg border border-slate-200 h-64 overflow-y-auto shadow-sm">
               <pre className="text-xs text-slate-600 whitespace-pre-wrap">{documentData.text}</pre>
             </div>
          </div>
        );
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [documentData]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-indigo-600 bg-slate-50">
        <Loader2 className="animate-spin w-10 h-10 mb-3" />
        <span className="text-sm font-medium animate-pulse">Loading preview...</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-100 overflow-hidden">
      {content}
    </div>
  );
};

export default DocumentViewer;