/**
 * TTS Playback Dialog Controller
 * Manages the TTS playback UI and controls
 */

var TTSDialog = {
  ttsService: null,
  currentItem: null,
  mode: null,
  textContent: null,
  isPlaying: false,
  isPaused: false,

  /**
   * Initialize dialog when window loads
   */
  async init() {
    Zotero.debug('TTS Dialog: Initializing');

    try {
      // Get arguments passed from parent window
      const args = window.arguments[0];
      this.ttsService = args.ttsService;
      this.currentItem = args.item;
      this.mode = args.mode;
      this.textContent = args.textContent;

      // Load paper info
      await this.loadPaperInfo();

      // Load voices
      await this.loadVoices();

      // Load preferences
      this.loadPreferences();

      // Setup event listeners
      this.setupEventListeners();

      // Update UI
      this.updateContentLength();
      this.updateStatus('Ready to play');

      // Auto-play if preference enabled
      const prefs = Services.prefs.getBranch('extensions.summarycreator.tts.');
      if (prefs.getBoolPref('autoPlay', false)) {
        // Give UI a moment to render before starting
        setTimeout(() => this.play(), 500);
      }

      Zotero.debug('TTS Dialog: Initialization complete');
    } catch (error) {
      Zotero.debug(`TTS Dialog: Initialization error: ${error}`, 1);
      this.updateStatus(`Error: ${error.message}`);
    }
  },

  /**
   * Load paper information and display in UI
   */
  async loadPaperInfo() {
    try {
      const title = this.currentItem.getField('title');
      document.getElementById('tts-current-title').textContent = title;

      const authors = this.currentItem.getCreators()
        .map(c => `${c.firstName || ''} ${c.lastName || ''}`.trim())
        .join(', ');

      const authorsEl = document.getElementById('tts-current-authors');
      if (authors) {
        authorsEl.textContent = authors;
      } else {
        authorsEl.textContent = 'Unknown authors';
      }

      Zotero.debug(`TTS Dialog: Loaded info for "${title}"`);
    } catch (error) {
      Zotero.debug(`TTS Dialog: Error loading paper info: ${error}`, 1);
    }
  },

  /**
   * Load available voices into dropdown
   */
  async loadVoices() {
    try {
      const voices = this.ttsService.getAvailableVoices();
      const voiceSelect = document.getElementById('tts-voice');

      // Clear existing options
      voiceSelect.innerHTML = '';

      if (voices.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'No voices available';
        option.disabled = true;
        voiceSelect.appendChild(option);
        return;
      }

      // Add voices to dropdown
      voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.id;
        option.textContent = `${voice.name} (${voice.lang})`;
        if (voice.isDefault) {
          option.textContent += ' [Default]';
        }
        voiceSelect.appendChild(option);
      });

      Zotero.debug(`TTS Dialog: Loaded ${voices.length} voices`);
    } catch (error) {
      Zotero.debug(`TTS Dialog: Error loading voices: ${error}`, 1);
    }
  },

  /**
   * Load TTS preferences
   */
  loadPreferences() {
    try {
      const prefs = Services.prefs.getBranch('extensions.summarycreator.tts.');

      // Load default voice
      const defaultVoice = prefs.getCharPref('defaultVoice', '');
      if (defaultVoice) {
        const voiceSelect = document.getElementById('tts-voice');
        voiceSelect.value = defaultVoice;
      }

      // Load playback speed
      const speed = prefs.getCharPref('playbackSpeed', '1.0');
      document.getElementById('tts-speed').value = speed;
      document.getElementById('tts-speed-value').textContent = `${speed}x`;

      Zotero.debug(`TTS Dialog: Loaded preferences (voice: ${defaultVoice}, speed: ${speed})`);
    } catch (error) {
      Zotero.debug(`TTS Dialog: Error loading preferences: ${error}`, 1);
    }
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Handle window close - stop playback
    window.addEventListener('unload', () => {
      Zotero.debug('TTS Dialog: Window closing, stopping playback');
      this.stop();
    });

    // Handle keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (this.isPlaying && !this.isPaused) {
          this.pause();
        } else if (this.isPaused) {
          this.resume();
        } else {
          this.play();
        }
      } else if (e.key === 'Escape') {
        this.stop();
      }
    });
  },

  /**
   * Start playback
   */
  async play() {
    Zotero.debug('TTS Dialog: Play button clicked');

    const playBtn = document.getElementById('tts-btn-play');
    const pauseBtn = document.getElementById('tts-btn-pause');
    const stopBtn = document.getElementById('tts-btn-stop');

    // Update button states
    playBtn.disabled = true;
    playBtn.style.opacity = '0.5';
    pauseBtn.disabled = false;
    pauseBtn.style.opacity = '1';
    stopBtn.disabled = false;
    stopBtn.style.opacity = '1';

    this.isPlaying = true;
    this.isPaused = false;
    this.updateStatus('Playing...');

    try {
      const voiceId = document.getElementById('tts-voice').value;
      const speed = parseFloat(document.getElementById('tts-speed').value);

      Zotero.debug(`TTS Dialog: Starting playback (voice: ${voiceId}, speed: ${speed})`);

      await this.ttsService.speak(this.textContent, {
        voiceName: voiceId,
        rate: speed,
        onProgress: (charIndex, total) => {
          this.updateProgress(charIndex, total);
        },
        onEnd: () => {
          Zotero.debug('TTS Dialog: Playback complete');
          this.updateStatus('Playback complete');
          this.resetButtons();
          this.isPlaying = false;
        },
        onError: (error) => {
          Zotero.debug(`TTS Dialog: Playback error: ${error}`, 1);
          this.updateStatus(`Error: ${error.message}`);
          this.resetButtons();
          this.isPlaying = false;
        }
      });

    } catch (error) {
      Zotero.debug(`TTS Dialog: Play error: ${error}`, 1);
      this.updateStatus(`Error: ${error.message}`);
      this.resetButtons();
      this.isPlaying = false;
    }
  },

  /**
   * Pause playback
   */
  pause() {
    Zotero.debug('TTS Dialog: Pause button clicked');

    this.ttsService.pause();
    this.isPaused = true;
    this.updateStatus('Paused');

    // Update button states
    const playBtn = document.getElementById('tts-btn-play');
    const pauseBtn = document.getElementById('tts-btn-pause');
    const resumeBtn = document.getElementById('tts-btn-resume');

    playBtn.style.display = 'none';
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'inline-block';
    resumeBtn.disabled = false;
    resumeBtn.style.opacity = '1';
  },

  /**
   * Resume playback
   */
  resume() {
    Zotero.debug('TTS Dialog: Resume button clicked');

    this.ttsService.resume();
    this.isPaused = false;
    this.updateStatus('Playing...');

    // Update button states
    const playBtn = document.getElementById('tts-btn-play');
    const pauseBtn = document.getElementById('tts-btn-pause');
    const resumeBtn = document.getElementById('tts-btn-resume');

    playBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'inline-block';
    resumeBtn.style.display = 'none';

    playBtn.disabled = true;
    playBtn.style.opacity = '0.5';
    pauseBtn.disabled = false;
    pauseBtn.style.opacity = '1';
  },

  /**
   * Stop playback
   */
  stop() {
    Zotero.debug('TTS Dialog: Stop button clicked');

    this.ttsService.stop();
    this.isPlaying = false;
    this.isPaused = false;
    this.updateStatus('Stopped');
    this.resetButtons();

    // Reset progress
    document.getElementById('tts-progress').value = 0;
    document.getElementById('tts-current-position').textContent = '0%';
  },

  /**
   * Update playback speed
   */
  updateSpeed(value) {
    document.getElementById('tts-speed-value').textContent = `${value}x`;
    this.ttsService.setSpeed(parseFloat(value));

    // Save to preferences
    const prefs = Services.prefs.getBranch('extensions.summarycreator.tts.');
    prefs.setCharPref('playbackSpeed', value);

    Zotero.debug(`TTS Dialog: Speed changed to ${value}x`);
  },

  /**
   * Change voice
   */
  changeVoice(voiceId) {
    this.ttsService.setVoice(voiceId);

    // Save to preferences
    const prefs = Services.prefs.getBranch('extensions.summarycreator.tts.');
    prefs.setCharPref('defaultVoice', voiceId);

    Zotero.debug(`TTS Dialog: Voice changed to ${voiceId}`);
  },

  /**
   * Update progress bar
   */
  updateProgress(charIndex, total) {
    const percentage = Math.round((charIndex / total) * 100);
    document.getElementById('tts-progress').value = percentage;
    document.getElementById('tts-current-position').textContent = `${percentage}%`;
  },

  /**
   * Update content length display
   */
  updateContentLength() {
    const length = this.textContent ? this.textContent.length : 0;
    const lengthEl = document.getElementById('tts-content-length');
    lengthEl.textContent = `${length.toLocaleString()} characters`;
  },

  /**
   * Update status message
   */
  updateStatus(message) {
    const statusEl = document.getElementById('tts-status');
    statusEl.textContent = message;

    // Change color based on status
    if (message.toLowerCase().includes('error')) {
      statusEl.style.borderLeftColor = '#f44336';
      statusEl.style.background = '#ffebee';
    } else if (message.toLowerCase().includes('complete')) {
      statusEl.style.borderLeftColor = '#4CAF50';
      statusEl.style.background = '#e8f5e9';
    } else {
      statusEl.style.borderLeftColor = '#2196F3';
      statusEl.style.background = '#f5f5f5';
    }
  },

  /**
   * Reset button states
   */
  resetButtons() {
    const playBtn = document.getElementById('tts-btn-play');
    const pauseBtn = document.getElementById('tts-btn-pause');
    const resumeBtn = document.getElementById('tts-btn-resume');
    const stopBtn = document.getElementById('tts-btn-stop');

    playBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'inline-block';
    resumeBtn.style.display = 'none';

    playBtn.disabled = false;
    playBtn.style.opacity = '1';
    pauseBtn.disabled = true;
    pauseBtn.style.opacity = '0.5';
    stopBtn.disabled = true;
    stopBtn.style.opacity = '0.5';
  }
};

// Initialize when window loads
window.addEventListener('load', () => {
  TTSDialog.init().catch(error => {
    Zotero.debug(`TTS Dialog: Load error: ${error}`, 1);
  });
});
