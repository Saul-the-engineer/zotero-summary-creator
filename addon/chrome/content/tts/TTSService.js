/**
 * TTSService - Provider abstraction for Text-to-Speech
 * Manages multiple TTS providers (Web Speech API, Cloud TTS, etc.)
 * and delegates to the active provider
 */

class TTSService {
  constructor(providers = {}) {
    this.providers = {
      webSpeech: providers.webSpeech || null,
      cloud: providers.cloud || null
    };
    this.activeProvider = null;
    this.currentVoice = null;
    this.currentRate = 1.0;
    this.isInitialized = false;

    Zotero.debug('TTS: TTSService created');
  }

  /**
   * Initialize TTS service - select and activate a provider
   * @returns {Promise<boolean>} - True if successfully initialized
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    // Try Web Speech API first (primary provider)
    if (this.providers.webSpeech && this.providers.webSpeech.isSupported()) {
      this.activeProvider = this.providers.webSpeech;
      Zotero.debug('TTS: Using Web Speech API provider');
      this.isInitialized = true;
      return true;
    }

    // Fallback to cloud TTS if configured
    if (this.providers.cloud && this.providers.cloud.isSupported()) {
      this.activeProvider = this.providers.cloud;
      Zotero.debug('TTS: Using Cloud TTS provider');
      this.isInitialized = true;
      return true;
    }

    // No providers available
    throw new Error('No TTS provider available. Web Speech API not supported and Cloud TTS not configured.');
  }

  /**
   * Speak text using active provider
   * @param {string} text - Text to speak
   * @param {object} options - Playback options
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.activeProvider) {
      throw new Error('No TTS provider available');
    }

    // Apply current settings
    const mergedOptions = {
      voiceName: this.currentVoice,
      rate: this.currentRate,
      ...options
    };

    Zotero.debug(`TTS: Speaking ${text.length} characters`);
    return this.activeProvider.speak(text, mergedOptions);
  }

  /**
   * Pause current playback
   */
  pause() {
    if (!this.activeProvider) {
      Zotero.debug('TTS: No active provider to pause', 2);
      return;
    }
    return this.activeProvider.pause();
  }

  /**
   * Resume paused playback
   */
  resume() {
    if (!this.activeProvider) {
      Zotero.debug('TTS: No active provider to resume', 2);
      return;
    }
    return this.activeProvider.resume();
  }

  /**
   * Stop current playback
   */
  stop() {
    if (!this.activeProvider) {
      Zotero.debug('TTS: No active provider to stop', 2);
      return;
    }
    return this.activeProvider.stop();
  }

  /**
   * Set voice for playback
   * @param {string} voiceId - Voice identifier (name or URI)
   */
  setVoice(voiceId) {
    this.currentVoice = voiceId;
    Zotero.debug(`TTS: Voice set to ${voiceId}`);
  }

  /**
   * Set playback speed
   * @param {number} rate - Playback rate (0.5-2.0)
   */
  setSpeed(rate) {
    this.currentRate = Math.max(0.5, Math.min(2.0, rate));
    Zotero.debug(`TTS: Speed set to ${this.currentRate}x`);
  }

  /**
   * Get list of available voices from active provider
   * @returns {Array<{id: string, name: string, lang: string, isDefault: boolean}>}
   */
  getAvailableVoices() {
    if (!this.activeProvider) {
      // Try to initialize if not already
      try {
        if (!this.isInitialized) {
          // Attempt synchronous initialization
          if (this.providers.webSpeech && this.providers.webSpeech.isSupported()) {
            this.activeProvider = this.providers.webSpeech;
            this.isInitialized = true;
          }
        }
      } catch (e) {
        Zotero.debug(`TTS: Failed to initialize for getAvailableVoices: ${e}`, 1);
        return [];
      }
    }

    if (!this.activeProvider || !this.activeProvider.getAvailableVoices) {
      return [];
    }

    return this.activeProvider.getAvailableVoices();
  }

  /**
   * Check if TTS is available
   * @returns {boolean}
   */
  isAvailable() {
    // Check if any provider is available
    const hasWebSpeech = this.providers.webSpeech && this.providers.webSpeech.isSupported();
    const hasCloud = this.providers.cloud && this.providers.cloud.isSupported();
    return hasWebSpeech || hasCloud;
  }

  /**
   * Get active provider name
   * @returns {string}
   */
  getActiveProviderName() {
    if (!this.activeProvider) {
      return 'none';
    }

    if (this.activeProvider === this.providers.webSpeech) {
      return 'Web Speech API';
    } else if (this.activeProvider === this.providers.cloud) {
      return 'Cloud TTS';
    }

    return 'unknown';
  }

  /**
   * Get current playback state
   * @returns {object}
   */
  getState() {
    if (!this.activeProvider || !this.activeProvider.getState) {
      return {
        isPlaying: false,
        isPaused: false
      };
    }

    return this.activeProvider.getState();
  }

  /**
   * Reload voices (useful if system voices change)
   */
  reloadVoices() {
    if (this.providers.webSpeech && this.providers.webSpeech.loadVoices) {
      this.providers.webSpeech.loadVoices();
      Zotero.debug('TTS: Voices reloaded');
    }
  }
}
