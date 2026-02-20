/**
 * Handles audio playback for the Text -> TTS Model -> Audio -> Speaker flow.
 * Decodes raw PCM bytes from the Gemini TTS model and plays them via Web Audio API.
 */

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

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

  public async play(options: { text?: string; base64Audio?: string | null }, onEnded?: () => void): Promise<void> {
    this.stop();
    const ctx = this.getAudioContext();

    if (options.base64Audio) {
      try {
        if (ctx.state === 'suspended') await ctx.resume();
        const bytes = decodeBase64(options.base64Audio);
        const audioBuffer = await this.decodeAudioData(bytes, ctx);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => {
          if (this.currentSource === source) {
            this.currentSource = null;
            if (onEnded) onEnded();
          }
        };
        this.currentSource = source;
        source.start();
        return;
      } catch (error) {
        console.error("Error in Audio -> Speaker flow:", error);
      }
    }

    if (options.text) {
      const utterance = new SpeechSynthesisUtterance(options.text);
      utterance.onend = () => { if (onEnded) onEnded(); };
      utterance.onerror = () => { if (onEnded) onEnded(); };
      window.speechSynthesis.speak(utterance);
    } else {
      if (onEnded) onEnded();
    }
  }

  public stop(): void {
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch (e) { /* ignore */ }
      this.currentSource = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }
}

export const audioService = new AudioService();