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
  
  const textContext = documents
    .filter(doc => doc.fileType !== 'image')
    .map(doc => `--- START OF FILE: ${doc.name} (${doc.fileType}) ---\n${doc.text}\n--- END OF FILE: ${doc.name} ---`)
    .join('\n\n');

  const citationInstruction = `
    6. **CITATIONS**: 
       - Always specify which file you are referring to if there are multiple.
       - Use the format "Filename" [Page X] or "Filename" [Slide X].
       - Use double quotes (") for file names instead of asterisks (*) or bold symbols (**).
       - Keep it concise.
  `;

  if (mode === 'local' && window.ai) {
    try {
      const combinedText = documents.map(doc => `[FILE: ${doc.name}]\n${doc.text}`).join('\n\n');
      const truncatedContext = combinedText.substring(0, 15000);
      const systemPrompt = `You are a helpful teaching assistant. Answer based on the provided documents. ${citationInstruction}`;
      const session = await window.ai.languageModel.create({ systemPrompt });
      const fullPrompt = `DOCUMENTS:\n${truncatedContext}\nHISTORY:\n${chatHistory.map(m => `${m.role}: ${m.parts[0].text}`).join('\n')}\nUser: ${question}\nAssistant:`;
      const response = await session.prompt(fullPrompt);
      session.destroy();
      return response;
    } catch (error) {
      return "Local AI failed. Please try cloud mode for complex visual analysis.";
    }
  }

  try {
    const ai = getClient();
    const model = "gemini-3-flash-preview"; 
    
    const systemInstruction = `You are a helpful teaching assistant. 
    You have access to MULTIPLE DOCUMENTS, including images.
    
    VISUAL REASONING:
    - For images, analyze colors, objects, layout, and spatial relationships.
    - If a user asks about an image, the pixels have been provided to you.
    - Combine visual details with any extracted text.
    
    GUIDELINES:
    1. Answer strictly based on the provided content.
    2. If information exists in different files, synthesize the answer.
    3. If the answer is missing, say so.
    ${citationInstruction}
    
    TEXT CONTEXT:
    ${textContext.substring(0, 500000)}
    `;

    const userParts: any[] = [{ text: question }];

    documents.forEach(doc => {
      if (doc.fileType === 'image' && doc.base64Data && doc.mimeType) {
        userParts.push({
          inlineData: {
            data: doc.base64Data,
            mimeType: doc.mimeType
          }
        });
        userParts.push({ text: `(Attached Image: ${doc.name})` });
      }
    });

    const response = await ai.models.generateContent({
        model,
        contents: [
            ...chatHistory.map(msg => ({ role: msg.role, parts: msg.parts })),
            { role: 'user', parts: userParts }
        ],
        config: { systemInstruction }
    });

    return response.text || "I couldn't generate an answer.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

/**
 * TTS Flow: Text -> TTS Model -> Audio
 */
export const generateSpeech = async (text: string): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this response naturally and clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { voiceName: 'Kore' } 
          } 
        },
      },
    });
    // Extract raw PCM audio data from candidate parts
    const audioData = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    return audioData || null;
  } catch (e) { 
    console.error("TTS Generation Error:", e);
    return null; 
  }
};
