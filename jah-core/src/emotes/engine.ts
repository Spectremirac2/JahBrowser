import type { Emote, EmoteProvider, MessageSegment } from './types.js';

/**
 * Emote resolution core: merges global + channel emotes from all registered
 * providers and tokenizes chat messages into text/emote segments.
 * Priority on code collision: later-registered provider wins channel-level,
 * channel emotes always win over global ones.
 */
export class EmoteEngine {
  private providers: EmoteProvider[] = [];
  private globalEmotes = new Map<string, Emote>();
  private channelEmotes = new Map<string, Map<string, Emote>>();

  registerProvider(provider: EmoteProvider): void {
    this.providers.push(provider);
  }

  async loadGlobal(): Promise<void> {
    for (const p of this.providers) {
      const emotes = await p.fetchGlobalEmotes().catch(() => [] as Emote[]);
      for (const e of emotes) this.globalEmotes.set(e.code, e);
    }
  }

  async loadChannel(channelKey: string): Promise<void> {
    const map = new Map<string, Emote>();
    for (const p of this.providers) {
      const emotes = await p.fetchChannelEmotes(channelKey).catch(() => [] as Emote[]);
      for (const e of emotes) map.set(e.code, e);
    }
    this.channelEmotes.set(channelKey, map);
  }

  resolve(channelKey: string, code: string): Emote | undefined {
    return this.channelEmotes.get(channelKey)?.get(code) ?? this.globalEmotes.get(code);
  }

  /** Tokenize a raw chat message into text/emote segments. */
  segment(channelKey: string, message: string): MessageSegment[] {
    const out: MessageSegment[] = [];
    let textBuf: string[] = [];
    for (const word of message.split(' ')) {
      const emote = this.resolve(channelKey, word);
      if (emote) {
        if (textBuf.length) {
          out.push({ kind: 'text', text: textBuf.join(' ') + ' ' });
          textBuf = [];
        }
        out.push({ kind: 'emote', emote });
      } else {
        textBuf.push(word);
      }
    }
    if (textBuf.length) out.push({ kind: 'text', text: textBuf.join(' ') });
    return out;
  }
}
