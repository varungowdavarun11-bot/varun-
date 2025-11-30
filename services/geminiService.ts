import { GoogleGenAI, Modality } from "@google/genai";
import { AIMode } from "../types";

// Initialize the client.
const getClient = () => {
  const apiKey = process.env.API_KEY;
  // If no key and no local AI, we might have an issue, but we'll handle that in UI.
  return new GoogleGenAI({ apiKey: apiKey || 'DUMMY_KEY' });
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
  return process.env.API_KEY ? 'cloud' : 'unavailable';
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
      // Local models (Nano) have smaller context windows (typically 4k tokens).
      // We truncate context to ~12,000 chars (approx 3k tokens) to leave room for the prompt and response.
      const truncatedContext = context.substring(0, 12000);
      
      const systemPrompt = `You are a helpful teaching assistant. Answer the student's question based strictly on the provided content. If the answer is not in the content, say so.`;

      // Create session with system prompt
      const session = await window.ai.languageModel.create({
        systemPrompt: systemPrompt
      });

      // Format the prompt clearly for the local model
      const fullPrompt = `
CONTENT:
${truncatedContext}

CHAT HISTORY:
${chatHistory.map(msg => `${msg.role === 'user' ? 'Student' : 'Assistant'}: ${msg.parts[0].text}`).join('\n')}

Student: ${question}
Assistant:`;

      const response = await session.prompt(fullPrompt);
      
      // Cleanup
      session.destroy();
      
      return response;
    } catch (error) {
      console.error("Local AI generation failed:", error);
      return "I'm sorry, I couldn't process that locally. Please try a shorter document or a simpler question.";
    }
  }

  // --- CLOUD MODE (Gemini Flash) ---
  const ai = getClient();
  const model = "gemini-2.5-flash";
  
  const systemInstruction = `You are a helpful and knowledgeable teaching assistant. 
  You have access to the following document content provided by the user. 
  Answer the user's questions strictly based on this content. 
  If the answer is not in the document, state that clearly.
  Keep answers concise and educational.
  
  DOCUMENT CONTENT:
  ${context.substring(0, 900000)}
  `;

  try {
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
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  // TTS is currently only high-quality via Cloud. 
  // We return null if it fails, prompting the UI to use Local TTS.
  if (!process.env.API_KEY) return null;
  
  const ai = getClient();
  const model = "gemini-2.5-flash-preview-tts";

  try {
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