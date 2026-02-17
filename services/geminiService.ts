import { GoogleGenAI, Modality } from "@google/genai";
import { AIMode, DocumentData } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");
  return new GoogleGenAI({ apiKey });
};

export const checkLocalCapability = async (): Promise<AIMode> => {
  if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
    try {
      const capabilities = await window.ai.languageModel.capabilities();
      if (capabilities.available === 'readily') return 'local';
    } catch (e) {}
  }
  return (process.env.API_KEY && process.env.API_KEY.length > 0) ? 'cloud' : 'unavailable';
};

export const generateAnswer = async (
  documents: DocumentData[],
  question: string,
  chatHistory: { role: string; parts: { text: string }[] }[],
  mode: AIMode
): Promise<string> => {
  const textContext = documents
    .filter(doc => doc.fileType !== 'image')
    .map(doc => `--- START OF FILE: ${doc.name} (${doc.fileType}) ---\n${doc.text}\n--- END OF FILE: ${doc.name} ---`)
    .join('\n\n');

  const citationInstruction = `
    6. **CITATIONS**: 
       - Always specify which file you are referring to if there are multiple.
       - Use the format "Filename" [Page X] or "Filename" [Slide X].
       - Use double quotes (") for file names instead of asterisks.
  `;

  if (mode === 'local' && window.ai) {
    try {
      const combinedText = documents.map(doc => `[FILE: ${doc.name}]\n${doc.text}`).join('\n\n');
      const session = await window.ai.languageModel.create({ systemPrompt: `You are a helpful teaching assistant. ${citationInstruction}` });
      const fullPrompt = `DOCUMENTS:\n${combinedText.substring(0, 15000)}\nUser: ${question}\nAssistant:`;
      const response = await session.prompt(fullPrompt);
      session.destroy();
      return response;
    } catch (e) { return "Local AI failed. Please try cloud mode."; }
  }

  try {
    const ai = getClient();
    const systemInstruction = `You are a helpful teaching assistant with access to MULTIPLE DOCUMENTS, including images.
    
    VISUAL REASONING:
    - For images, the actual pixels are provided. Analyze colors, objects, and layout.
    - If a user asks about an image, reason based on its visual properties and OCR text.
    ${citationInstruction}
    
    TEXT CONTEXT:
    ${textContext.substring(0, 500000)}`;

    const userParts: any[] = [{ text: question }];
    documents.forEach(doc => {
      if (doc.fileType === 'image' && doc.base64Data && doc.mimeType) {
        userParts.push({ inlineData: { data: doc.base64Data, mimeType: doc.mimeType } });
        userParts.push({ text: `(Attached Image Reference: ${doc.name})` });
      }
    });

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
            ...chatHistory.map(msg => ({ role: msg.role, parts: msg.parts })),
            { role: 'user', parts: userParts }
        ],
        config: { systemInstruction }
    });

    return response.text || "I couldn't generate an answer.";
  } catch (error) { throw error; }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this response naturally: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data || null;
  } catch (e) { return null; }
};