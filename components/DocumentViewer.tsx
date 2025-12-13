import React, { useEffect, useState, useRef } from 'react';
import { DocumentData } from '../types';
import { Loader2, AlertCircle } from 'lucide-react';

interface DocumentViewerProps {
  documentData: DocumentData;
  scrollToPage?: number | null;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentData, scrollToPage }) => {
  const [content, setContent] = useState<React.ReactNode>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);

  // Helper to format text with Page anchors for scrolling
  const renderTextWithAnchors = (text: string) => {
    // Split by "--- Page X ---" markers
    const parts = text.split(/(--- Page \d+ ---|--- Sheet: .+? ---|--- Slide \d+ ---)/);
    
    return parts.map((part, index) => {
        // Check if this part is a header
        const headerMatch = part.match(/--- (Page|Slide) (\d+) ---/);
        
        if (headerMatch) {
            const pageNum = headerMatch[2];
            return (
                <div key={index} id={`doc-page-${pageNum}`} className="text-indigo-600 font-bold mt-8 mb-2 border-b border-indigo-100 pb-1">
                    {part}
                </div>
            );
        }
        
        if (part.match(/--- Sheet: .+? ---/)) {
            return (
                <div key={index} className="text-indigo-600 font-bold mt-8 mb-2 border-b border-indigo-100 pb-1">
                    {part}
                </div>
            );
        }

        return <span key={index}>{part}</span>;
    });
  };

  // Effect to handle Scrolling
  useEffect(() => {
    if (scrollToPage && documentData.fileType === 'pdf') {
       // For PDF, we need to update the iframe src hash
       // We'll handle this in the content render logic or separate effect
       if (currentPdfUrl) {
           // Force reload iframe with new hash if needed? 
           // Actually, iframe src changes usually trigger reload.
           // Since we can't easily access iframe internal DOM for cross-origin reasons (even blob sometimes),
           // the #page=X hash is the standard way.
       }
    } else if (scrollToPage && containerRef.current) {
        // For HTML content
        const element = document.getElementById(`doc-page-${scrollToPage}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
  }, [scrollToPage, documentData.fileType, currentPdfUrl]);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      try {
        if (!documentData.file) {
          // Fallback View (Reloaded Session)
          setContent(
            <div className="p-8 h-full overflow-y-auto bg-white" ref={containerRef}>
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
                     {renderTextWithAnchors(documentData.text)}
                  </div>
               </div>
            </div>
          );
          return;
        }

        const file = documentData.file;
        const fileType = documentData.fileType;

        if (fileType === 'pdf') {
          const baseUrl = URL.createObjectURL(file);
          setCurrentPdfUrl(baseUrl);
          // PDF Viewer handling
          // We wrap it in a functional component to handle prop updates cleanly
          setContent(
             <PdfFrame baseUrl={baseUrl} page={scrollToPage} />
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
               <div className="h-full overflow-y-auto bg-slate-100 p-4 md:p-8" ref={containerRef}>
                 <div 
                   className="bg-white shadow-lg p-8 md:p-12 min-h-full max-w-4xl mx-auto prose prose-slate prose-sm md:prose-base lg:prose-lg"
                   dangerouslySetInnerHTML={{ __html: result.value }}
                 />
               </div>
             );
          }
        } else if (fileType === 'excel') {
           if (window.XLSX) {
             const arrayBuffer = await file.arrayBuffer();
             const workbook = window.XLSX.read(arrayBuffer);
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
           }
        } else {
           // Default fallback (Text, PPT, etc)
           setContent(
            <div className="h-full overflow-y-auto bg-white p-6 md:p-8" ref={containerRef}>
               <div className="max-w-3xl mx-auto">
                 <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Document Content</h3>
                 <div className="font-mono text-sm whitespace-pre-wrap text-slate-700 leading-relaxed">
                   {renderTextWithAnchors(documentData.text)}
                 </div>
               </div>
            </div>
          );
        }
      } catch (e) {
        console.error("Error rendering document preview", e);
        // Fallback error view...
        setContent(<div>Error loading preview</div>);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [documentData, scrollToPage]); // Re-run if document changes. `scrollToPage` inside effect is for non-PDF.

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

// Sub-component to handle PDF iframe updates specifically
const PdfFrame = ({ baseUrl, page }: { baseUrl: string, page?: number | null }) => {
    const src = page ? `${baseUrl}#page=${page}` : baseUrl;
    return (
        <iframe 
            key={src} // Key forces remount on hash change to ensure navigation happens
            src={src} 
            className="w-full h-full border-none bg-slate-200" 
            title="PDF Viewer"
        />
    );
};

export default DocumentViewer;