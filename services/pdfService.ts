
import { DocumentData, FileType } from '../types';
import { createWorker } from 'tesseract.js';

declare global {
  interface Window {
    pdfjsLib: any;
    XLSX: any;
    JSZip: any;
    mammoth: any;
  }
}

// Helper to determine file type
const getFileType = (file: File): FileType => {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/') || name.match(/\.(jpg|jpeg|png|bmp|webp)$/)) return 'image';
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || type.includes('spreadsheet')) return 'excel';
  if (name.endsWith('.pptx') || name.endsWith('.ppt') || type.includes('presentation')) return 'powerpoint';
  if (name.endsWith('.docx') || type.includes('wordprocessing')) return 'word';
  if (type === 'text/plain' || name.endsWith('.txt')) return 'text';
  
  return 'text';
};

const extractFromPDF = async (file: File): Promise<{ text: string; pages: number }> => {
  if (!window.pdfjsLib) throw new Error("PDF Library not loaded");
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Improved PDF extraction: Preserves lines to help AI understand paragraphs/headings
    const pageText = textContent.items.map((item: any) => {
        return item.str + (item.hasEOL ? '\n' : ' ');
    }).join('');

    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }
  
  return { text: fullText, pages: pdf.numPages };
};

const extractFromExcel = async (file: File): Promise<{ text: string; pages: number }> => {
  if (!window.XLSX) throw new Error("Excel Library not loaded");

  const arrayBuffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(arrayBuffer);
  let fullText = '';
  
  workbook.SheetNames.forEach((sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    // Use CSV format so the AI understands rows and columns better
    const sheetCsv = window.XLSX.utils.sheet_to_csv(sheet);
    fullText += `--- Sheet: ${sheetName} ---\n${sheetCsv}\n\n`;
  });

  return { text: fullText, pages: workbook.SheetNames.length };
};

const extractFromPPTX = async (file: File): Promise<{ text: string; pages: number }> => {
  if (!window.JSZip) throw new Error("ZIP Library not loaded for PPTX");

  const zip = await window.JSZip.loadAsync(file);
  const slideFiles = Object.keys(zip.files).filter(name => 
    name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
  );

  // Sort slides numerically (slide1, slide2, etc.)
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0");
    const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0");
    return numA - numB;
  });

  let fullText = '';
  let count = 0;

  for (const filename of slideFiles) {
    count++;
    const content = await zip.files[filename].async("string");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, "text/xml");
    
    // Extract text from <a:t> tags (PowerPoint text elements)
    const textNodes = xmlDoc.getElementsByTagName("a:t");
    let slideText = "";
    for(let i=0; i<textNodes.length; i++) {
        slideText += textNodes[i].textContent + "\n";
    }
    
    fullText += `--- Slide ${count} ---\n${slideText}\n\n`;
  }

  return { text: fullText, pages: count };
};

const extractFromDocx = async (file: File): Promise<{ text: string; pages: number }> => {
  if (!window.mammoth) throw new Error("Word Library not loaded");
  
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
  
  return { text: `--- Document Content ---\n${result.value}`, pages: 1 };
};

const extractFromImage = async (file: File): Promise<{ text: string; pages: number }> => {
  // Use tesseract.js worker
  const worker = await createWorker('eng');
  const ret = await worker.recognize(file);
  await worker.terminate();
  return { text: `--- Image OCR Result ---\n${ret.data.text}`, pages: 1 };
};

const extractFromText = async (file: File): Promise<{ text: string; pages: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ text: `--- Text File ---\n${reader.result as string}`, pages: 1 });
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

export const extractTextFromDocument = async (file: File): Promise<DocumentData> => {
  const fileType = getFileType(file);
  let result: { text: string; pages: number };

  switch (fileType) {
    case 'pdf':
      result = await extractFromPDF(file);
      break;
    case 'excel':
      result = await extractFromExcel(file);
      break;
    case 'powerpoint':
      result = await extractFromPPTX(file);
      break;
    case 'word':
      result = await extractFromDocx(file);
      break;
    case 'image':
      result = await extractFromImage(file);
      break;
    case 'text':
      result = await extractFromText(file);
      break;
    default:
      throw new Error("Unsupported file type");
  }

  // Generate a unique ID for the DocumentData object
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: file.name,
    text: result.text,
    pageCount: result.pages,
    fileType: fileType,
    file: file
  };
};

export const extractTextFromPDF = extractTextFromDocument;
