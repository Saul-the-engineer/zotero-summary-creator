/**
 * WebSpeechProvider - Browser Web Speech API integration for TTS
 * Handles text-to-speech using browser's native speechSynthesis API
 */

class WebSpeechProvider {
  constructor() {
    // Get speechSynthesis from Zotero main window
    const win = Zotero.getMainWindow();
    this.synthesis = win.speechSynthesis;
    this.currentUtterance = null;
    this.isPaused = false;
    this.isPlaying = false;
    this.voices = [];
    this.voicesLoaded = false;
    this.currentChunk = 0;
    this.chunks = [];
    this.onEndCallback = null;

    // Verify API availability
    if (!this.synthesis) {
      throw new Error('Web Speech API not available');
    }

    // Initial voice load
    this.loadVoices();

    // Setup voiceschanged event listener for async voice loading (Firefox/Zotero)
    // This is critical for Firefox which doesn't populate voices synchronously
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = () => {
        Zotero.debug('TTS: voiceschanged event fired');
        this.loadVoices();
      };
    }

    Zotero.debug('TTS: WebSpeechProvider initialized');
  }

  /**
   * Load available voices from browser
   */
  loadVoices() {
    this.voices = this.synthesis.getVoices();
    this.voicesLoaded = this.voices.length > 0;
    Zotero.debug(`TTS: Loaded ${this.voices.length} voices (voicesLoaded: ${this.voicesLoaded})`);

    // Log available voices for debugging
    this.voices.forEach((v, i) => {
      Zotero.debug(`  ${i}: ${v.name} (${v.lang}) ${v.default ? '[Default]' : ''}`);
    });
  }

  /**
   * Wait for voices to be loaded (async polling for Firefox)
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>} - True if voices loaded, false if timeout
   */
  async waitForVoices(timeout = 5000) {
    Zotero.debug(`TTS: Waiting for voices (timeout: ${timeout}ms)...`);
    const start = Date.now();

    while (!this.voicesLoaded && (Date.now() - start) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
      this.loadVoices();
    }

    if (this.voicesLoaded) {
      Zotero.debug(`TTS: Voices loaded after ${Date.now() - start}ms`);
    } else {
      Zotero.debug(`TTS: Voice loading timed out after ${timeout}ms`, 2);
    }

    return this.voicesLoaded;
  }

  /**
   * Speak text using Web Speech API
   * @param {string} text - Text to speak
   * @param {object} options - Playback options
   * @param {string} options.voiceName - Voice name or language code
   * @param {number} options.rate - Playback speed (0.5-2.0)
   * @param {number} options.pitch - Voice pitch (0.0-2.0)
   * @param {number} options.volume - Volume (0.0-1.0)
   * @param {function} options.onProgress - Progress callback (charIndex, total)
   * @param {function} options.onEnd - Completion callback
   * @param {function} options.onError - Error callback
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    // Cancel any ongoing speech
    this.stop();

    // Chunk text for long content (Web Speech API has limits)
    this.chunks = this.chunkText(text);
    this.currentChunk = 0;
    this.onEndCallback = options.onEnd;

    Zotero.debug(`TTS: Speaking ${text.length} chars in ${this.chunks.length} chunks`);

    return this.speakNextChunk(options);
  }

  /**
   * Speak next chunk in sequence
   * @param {object} options - Playback options
   * @returns {Promise<void>}
   */
  async speakNextChunk(options) {
    if (this.currentChunk >= this.chunks.length) {
      // All chunks complete
      this.isPlaying = false;
      Zotero.debug('TTS: Playback complete');
      if (this.onEndCallback) {
        this.onEndCallback();
      }
      return;
    }

    const chunk = this.chunks[this.currentChunk];
    Zotero.debug(`TTS: Playing chunk ${this.currentChunk + 1}/${this.chunks.length}`);

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(chunk);

      // Apply options
      utterance.voice = this.findVoice(options.voiceName || options.lang);
      utterance.rate = options.rate || 1.0;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      // Event handlers
      utterance.onend = () => {
        Zotero.debug(`TTS: Chunk ${this.currentChunk + 1} complete`);
        this.currentChunk++;
        this.speakNextChunk(options).then(resolve).catch(reject);
      };

      utterance.onerror = (e) => {
        Zotero.debug(`TTS: Speech error: ${e.error}`, 1);
        if (options.onError) {
          options.onError(new Error(`Speech error: ${e.error}`));
        }
        reject(new Error(`Speech error: ${e.error}`));
      };

      utterance.onpause = () => {
        this.isPaused = true;
        Zotero.debug('TTS: Paused');
      };

      utterance.onresume = () => {
        this.isPaused = false;
        Zotero.debug('TTS: Resumed');
      };

      // Progress tracking (for UI updates)
      if (options.onProgress) {
        utterance.onboundary = (e) => {
          // Calculate overall progress across all chunks
          const charsPerChunk = Math.floor(this.chunks.join('').length / this.chunks.length);
          const totalCharsRead = (this.currentChunk * charsPerChunk) + e.charIndex;
          const totalChars = this.chunks.join('').length;
          options.onProgress(totalCharsRead, totalChars);
        };
      }

      this.currentUtterance = utterance;
      this.isPlaying = true;
      this.isPaused = false;
      this.synthesis.speak(utterance);
    });
  }

  /**
   * Chunk long text into manageable pieces
   * Web Speech API can have issues with very long utterances
   * @param {string} text - Text to chunk
   * @param {number} maxChunkSize - Max characters per chunk
   * @returns {string[]}
   */
  chunkText(text, maxChunkSize = 5000) {
    if (text.length <= maxChunkSize) {
      return [text];
    }

    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        // If single sentence is > maxChunkSize, split on word boundaries
        if (sentence.length > maxChunkSize) {
          const words = sentence.split(/\s+/);
          let wordChunk = '';
          for (const word of words) {
            if ((wordChunk + word).length > maxChunkSize) {
              chunks.push(wordChunk.trim());
              wordChunk = word + ' ';
            } else {
              wordChunk += word + ' ';
            }
          }
          if (wordChunk) {
            chunks.push(wordChunk.trim());
          }
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(c => c.length > 0);
  }

  /**
   * Pause current playback
   */
  pause() {
    if (this.synthesis.speaking && !this.synthesis.paused) {
      this.synthesis.pause();
      this.isPaused = true;
      Zotero.debug('TTS: Paused');
    }
  }

  /**
   * Resume paused playback
   */
  resume() {
    if (this.synthesis.paused) {
      this.synthesis.resume();
      this.isPaused = false;
      Zotero.debug('TTS: Resumed');
    }
  }

  /**
   * Stop current playback completely
   */
  stop() {
    if (this.isPlaying) {
      this.synthesis.cancel();
      this.currentUtterance = null;
      this.isPaused = false;
      this.isPlaying = false;
      this.currentChunk = 0;
      this.chunks = [];
      Zotero.debug('TTS: Stopped');
    }
  }

  /**
   * Find voice by name or language code
   * @param {string} criteria - Voice name or language code (e.g., "en-US")
   * @returns {SpeechSynthesisVoice|null}
   */
  findVoice(criteria) {
    if (!criteria) {
      // Return default voice or first available
      const defaultVoice = this.voices.find(v => v.default);
      if (defaultVoice) return defaultVoice;

      // Try to find English voice
      const englishVoice = this.voices.find(v => v.lang.startsWith('en'));
      return englishVoice || this.voices[0] || null;
    }

    // Try exact name match first
    if (typeof criteria === 'string') {
      const exactMatch = this.voices.find(v => v.name === criteria);
      if (exactMatch) return exactMatch;

      // Try voice URI match
      const uriMatch = this.voices.find(v => v.voiceURI === criteria);
      if (uriMatch) return uriMatch;

      // Try language match (e.g., "en-US")
      const langMatch = this.voices.find(v => v.lang === criteria);
      if (langMatch) return langMatch;

      // Try partial language match (e.g., "en" matches "en-US")
      const partialLangMatch = this.voices.find(v => v.lang.startsWith(criteria));
      if (partialLangMatch) return partialLangMatch;
    }

    // Fallback: default English voice or first available
    const englishVoice = this.voices.find(v => v.lang.startsWith('en'));
    return englishVoice || this.voices[0] || null;
  }

  /**
   * Get list of available voices
   * @returns {Array<{id: string, name: string, lang: string, isDefault: boolean}>}
   */
  getAvailableVoices() {
    return this.voices.map(v => ({
      id: v.voiceURI,
      name: v.name,
      lang: v.lang,
      isDefault: v.default || false
    }));
  }

  /**
   * Check if Web Speech API is supported and has voices
   * @returns {boolean}
   */
  isSupported() {
    return !!this.synthesis && this.voicesLoaded;
  }

  /**
   * Get current playback state
   * @returns {object}
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentChunk: this.currentChunk,
      totalChunks: this.chunks.length
    };
  }
}
