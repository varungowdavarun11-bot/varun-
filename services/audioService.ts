/**
 * Handles audio playback using either Gemini TTS (PCM/WAV) or Browser TTS (SpeechSynthesis).
 */
export class AudioService {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }
    return this.audioContext;
  }

  private decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number = 24000,
    numChannels: number = 1
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  /**
   * Plays audio. 
   * If base64Audio is provided, decodes and plays it (Cloud/Gemini).
   * If text is provided without base64, uses window.speechSynthesis (Local/Offline).
   */
  public async play(options: { text?: string; base64Audio?: string | null }, onEnded?: () => void): Promise<void> {
    this.stop();

    // 1. Try Gemini Cloud Audio
    if (options.base64Audio) {
      try {
        const ctx = this.getAudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const bytes = this.decodeBase64(options.base64Audio);
        const audioBuffer = await this.decodeAudioData(bytes, ctx);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        source.onended = () => {
          this.currentSource = null;
          if (onEnded) onEnded();
        };

        this.currentSource = source;
        source.start();
        return;
      } catch (error) {
        console.error("Error playing cloud audio, falling back to local:", error);
        // Fallthrough to local
      }
    }

    // 2. Fallback to Local Browser TTS
    if (options.text) {
      const utterance = new SpeechSynthesisUtterance(options.text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      utterance.onend = () => {
        if (onEnded) onEnded();
      };
      
      utterance.onerror = (e) => {
        console.error("Local TTS error", e);
        if (onEnded) onEnded();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      if (onEnded) onEnded();
    }
  }

  public stop(): void {
    // Stop Web Audio API
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) { }
      this.currentSource = null;
    }
    // Stop SpeechSynthesis
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const audioService = new AudioService();