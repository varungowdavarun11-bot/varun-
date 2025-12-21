import { GoogleGenAI, Modality } from "@google/genai";
import { AIMode, DocumentData } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

export const checkLocalCapability = async (): Promise<AIMode> => {
  if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
    try {
      const capabilities = await window.ai.languageModel.capabilities();
      if (capabilities.available === 'readily') {
        return 'local';
      }
    } catch (e) {
      console.warn("Local AI capability check failed", e);
    }
  }
  return (process.env.API_KEY && process.env.API_KEY.length > 0) ? 'cloud' : 'unavailable';
};

export const generateAnswer = async (
  documents: DocumentData[],
  question: string,
  chatHistory: { role: string; parts: { text: string }[] }[],
  mode: AIMode
): Promise<string> => {
  
  // Combine all document contents with clear separators
  const combinedContext = documents.map(doc => 
    `--- START OF FILE: ${doc.name} (${doc.fileType}) ---\n${doc.text}\n--- END OF FILE: ${doc.name} ---`
  ).join('\n\n');

  const citationInstruction = `
    6. **CITATIONS**: 
       - Always specify which file you are referring to if there are multiple.
       - Use the format "Filename" [Page X] or "Filename" [Slide X].
       - Use double quotes (") for file names instead of asterisks (*) or bold symbols (**).
       - For example, say "Book1.xlsx" instead of **Book1.xlsx**.
       - Keep it concise.
  `;

  if (mode === 'local' && window.ai) {
    try {
      const truncatedContext = combinedContext.substring(0, 15000);
      const systemPrompt = `You are a helpful teaching assistant. Answer based on the provided documents. ${citationInstruction}`;

      const session = await window.ai.languageModel.create({ systemPrompt });
      const fullPrompt = `DOCUMENTS:\n${truncatedContext}\n\nHISTORY:\n${chatHistory.map(m => `${m.role}: ${m.parts[0].text}`).join('\n')}\n\nUser: ${question}\nAssistant:`;

      const response = await session.prompt(fullPrompt);
      session.destroy();
      return response;
    } catch (error) {
      return "Local AI failed. Please try a smaller set of documents.";
    }
  }

  try {
    const ai = getClient();
    const model = "gemini-3-flash-preview"; // Using the latest recommended model for complex reasoning
    
    const systemInstruction = `You are a helpful teaching assistant. 
    You have access to MULTIPLE DOCUMENTS.
    
    GUIDELINES:
    1. Answer strictly based on the provided content.
    2. If information exists in different files, synthesize the answer and mention both sources.
    3. If the answer is missing, say so.
    ${citationInstruction}
    
    DOCUMENTS:
    ${combinedContext.substring(0, 800000)}
    `;

    const response = await ai.models.generateContent({
        model,
        contents: [
            ...chatHistory.map(msg => ({ role: msg.role, parts: msg.parts })),
            { role: 'user', parts: [{ text: question }] }
        ],
        config: { systemInstruction }
    });

    return response.text || "I couldn't generate an answer.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) { return null; }
};