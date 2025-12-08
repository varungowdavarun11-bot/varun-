import { GoogleGenAI, Modality } from "@google/genai";
import { AIMode } from "../types";

// Initialize the client strictly with process.env.API_KEY as per guidelines.
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please add it to your environment variables.");
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
  // Check if API key exists and is not empty
  return (process.env.API_KEY && process.env.API_KEY.length > 0) ? 'cloud' : 'unavailable';
};

export const generateAnswer = async (
  context: string,
  question: string,
  chatHistory: { role: string; parts: { text: string }[] }[],
  mode: AIMode
): Promise<string> => {
  
  // --- LOCAL MODE (Gemini Nano via window.ai) ---
  if (mode === 'local' && window.ai) {
    try {
      const truncatedContext = context.substring(0, 12000);
      const systemPrompt = `You are a helpful teaching assistant. Answer the student's question based strictly on the provided content. If the answer is not in the content, say so.`;

      const session = await window.ai.languageModel.create({
        systemPrompt: systemPrompt
      });

      const fullPrompt = `
CONTENT:
${truncatedContext}

CHAT HISTORY:
${chatHistory.map(msg => `${msg.role === 'user' ? 'Student' : 'Assistant'}: ${msg.parts[0].text}`).join('\n')}

Student: ${question}
Assistant:`;

      const response = await session.prompt(fullPrompt);
      session.destroy();
      return response;
    } catch (error) {
      console.error("Local AI generation failed:", error);
      return "I'm sorry, I couldn't process that locally. Please try a shorter document or a simpler question.";
    }
  }

  // --- CLOUD MODE ---
  try {
    const ai = getClient();
    const model = "gemini-2.5-flash";
    
    // Improved System Prompt for handling various extracted file types
    const systemInstruction = `You are a helpful and knowledgeable teaching assistant. 
    You have access to the following DOCUMENT CONTENT, which has been extracted from a user's file (PDF, Excel, Image, etc.).
    
    GUIDELINES:
    1. Answer the user's questions **strictly** based on this content.
    2. The content might contain OCR errors, raw text artifacts, or CSV formatting (for Excel). Do your best to interpret it intelligently.
    3. If the content is an Excel sheet, interpret the rows and columns to answer questions about the data.
    4. If the answer is not in the document, state that clearly.
    5. Keep answers concise, accurate, and educational.
    
    DOCUMENT CONTENT:
    ${context.substring(0, 900000)}
    `;

    const response = await ai.models.generateContent({
        model,
        contents: [
            ...chatHistory.map(msg => ({
                role: msg.role,
                parts: msg.parts
            })),
            {
                role: 'user',
                parts: [{ text: question }]
            }
        ],
        config: {
            systemInstruction,
        }
    });

    return response.text || "I couldn't generate an answer.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    if ((error as any).message?.includes("API Key")) {
        return "Configuration Error: API Key is missing. Please check your Vercel settings.";
    }
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  
  try {
    const ai = getClient();
    const model = "gemini-2.5-flash-preview-tts";

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};