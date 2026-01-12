// Zotero Summary Creator - Bootstrap
// This file handles the plugin lifecycle

const { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');

var ZoteroSummaryCreator = {
  id: 'summary-creator@zotero.org',
  version: '1.0.0',
  rootURI: '',
  initialized: false,

  async startup({ id, version, rootURI }) {
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;

    // Wait for Zotero to be ready
    await Zotero.initializationPromise;

    // Load core modules
    Services.scriptloader.loadSubScript(rootURI + 'shared/prompt-template.js');
    Services.scriptloader.loadSubScript(rootURI + 'chrome/content/errors.js');
    Services.scriptloader.loadSubScript(rootURI + 'chrome/content/summarycreator.js');

    // Load TTS modules
    Services.scriptloader.loadSubScript(rootURI + 'chrome/content/tts/WebSpeechProvider.js');
    Services.scriptloader.loadSubScript(rootURI + 'chrome/content/tts/TTSService.js');
    Services.scriptloader.loadSubScript(rootURI + 'chrome/content/tts/ContentFilterService.js');

    // Add UI elements
    this.addUI();

    // Register preferences
    this.registerPrefs();

    this.initialized = true;
    Zotero.debug('Zotero Summary Creator: Plugin initialized');
  },

  shutdown() {
    this.removeUI();
    this.initialized = false;
    Zotero.debug('Zotero Summary Creator: Plugin shutdown');
  },

  install() {
    Zotero.debug('Zotero Summary Creator: Plugin installed');
  },

  uninstall() {
    Zotero.debug('Zotero Summary Creator: Plugin uninstalled');
  },

  addUI() {
    // Add to Tools menu
    const menuitem = Zotero.getMainWindow().document.createXULElement('menuitem');
    menuitem.id = 'zotero-summarycreator-tools-menu';
    menuitem.setAttribute('label', 'Summary Creator Preferences...');
    menuitem.addEventListener('command', () => {
      this.openPreferences();
    });

    const toolsPopup = Zotero.getMainWindow().document.getElementById('menu_ToolsPopup');
    if (toolsPopup) {
      toolsPopup.appendChild(menuitem);
    }

    // Add context menu item
    const contextMenuItem = Zotero.getMainWindow().document.createXULElement('menuitem');
    contextMenuItem.id = 'zotero-summarycreator-context-menu';
    contextMenuItem.setAttribute('label', 'Generate Summary');
    contextMenuItem.addEventListener('command', () => {
      this.generateSummaryFromContext();
    });

    const itemPopup = Zotero.getMainWindow().document.getElementById('zotero-itemmenu');
    if (itemPopup) {
      itemPopup.appendChild(Zotero.getMainWindow().document.createXULElement('menuseparator'));
      itemPopup.appendChild(contextMenuItem);

      // Add TTS menu items
      const playMenuSummary = Zotero.getMainWindow().document.createXULElement('menuitem');
      playMenuSummary.id = 'zotero-summarycreator-play-summary';
      playMenuSummary.setAttribute('label', '\ud83d\udd0a Play Summary (TTS)');
      playMenuSummary.addEventListener('command', () => {
        this.playTTSFromContext('summary');
      });
      itemPopup.appendChild(playMenuSummary);

      const playMenuFull = Zotero.getMainWindow().document.createXULElement('menuitem');
      playMenuFull.id = 'zotero-summarycreator-play-full';
      playMenuFull.setAttribute('label', '\ud83d\udd0a Play Full Paper (TTS)');
      playMenuFull.addEventListener('command', () => {
        this.playTTSFromContext('full');
      });
      itemPopup.appendChild(playMenuFull);
    }
  },

  removeUI() {
    const doc = Zotero.getMainWindow().document;

    const toolsMenuItem = doc.getElementById('zotero-summarycreator-tools-menu');
    if (toolsMenuItem) toolsMenuItem.remove();

    const contextMenuItem = doc.getElementById('zotero-summarycreator-context-menu');
    if (contextMenuItem) contextMenuItem.remove();

    // Remove TTS menu items
    const playSummaryMenu = doc.getElementById('zotero-summarycreator-play-summary');
    if (playSummaryMenu) playSummaryMenu.remove();

    const playFullMenu = doc.getElementById('zotero-summarycreator-play-full');
    if (playFullMenu) playFullMenu.remove();
  },

  registerPrefs() {
    // Set default preferences if not already set
    const prefBranch = Services.prefs.getBranch('extensions.summarycreator.');

    if (!prefBranch.prefHasUserValue('ollamaUrl')) {
      prefBranch.setCharPref('ollamaUrl', 'http://localhost:11434');
    }
    if (!prefBranch.prefHasUserValue('ollamaModel')) {
      prefBranch.setCharPref('ollamaModel', 'llama2');
    }
    if (!prefBranch.prefHasUserValue('autoOpen')) {
      prefBranch.setBoolPref('autoOpen', true);
    }

    // TTS preferences
    const ttsPrefBranch = Services.prefs.getBranch('extensions.summarycreator.tts.');

    if (!ttsPrefBranch.prefHasUserValue('enabled')) {
      ttsPrefBranch.setBoolPref('enabled', true);
    }
    if (!ttsPrefBranch.prefHasUserValue('playbackSpeed')) {
      ttsPrefBranch.setCharPref('playbackSpeed', '1.0');
    }
    if (!ttsPrefBranch.prefHasUserValue('autoPlay')) {
      ttsPrefBranch.setBoolPref('autoPlay', false);
    }
    if (!ttsPrefBranch.prefHasUserValue('defaultVoice')) {
      ttsPrefBranch.setCharPref('defaultVoice', '');
    }
  },

  openPreferences() {
    const io = {
      dataIn: null,
      dataOut: null
    };

    Zotero.getMainWindow().openDialog(
      this.rootURI + 'chrome/content/preferences.xhtml',
      'summary-creator-prefs',
      'chrome,titlebar,toolbar,centerscreen,modal',
      io
    );
  },

  async generateSummaryFromContext() {
    const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();

    if (!selectedItems || selectedItems.length === 0) {
      Zotero.alert(
        Zotero.getMainWindow(),
        'No Selection',
        'Please select one or more items to generate summaries.'
      );
      return;
    }

    // Determine if this is batch mode (multiple items)
    const isBatchMode = selectedItems.length > 1;

    // Show progress window
    const progressWin = new Zotero.ProgressWindow({ closeOnClick: false });
    progressWin.changeHeadline(isBatchMode ? 'Generating Summaries (Batch Mode)' : 'Generating Summary');
    progressWin.show();

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];

      if (!item.isRegularItem()) {
        Zotero.debug('Summary Creator: Skipping non-regular item', 2);
        continue;
      }

      const title = item.getField('title').substring(0, 50);
      progressWin.addLines([`Processing: ${title}...`]);

      try {
        Zotero.debug(`Summary Creator: Starting generation for item ${item.id} (batch mode: ${isBatchMode})`);

        // Pass batch mode flag to prevent auto-opening multiple windows
        await Zotero.SummaryCreator.generateSummary(item, { batchMode: isBatchMode });

        progressWin.addLines([`✓ ${title}`], 'success');
        successCount++;
        Zotero.debug(`Summary Creator: Successfully completed item ${item.id}`);
      } catch (error) {
        Zotero.debug(`Summary Creator: Failed for item ${item.id}: ${error.message}`, 1);
        Zotero.debug(error.stack, 1);

        progressWin.addLines([`✗ ${title}: ${error.message}`], 'error');
        failCount++;

        // Show alert only for first error in batch mode to avoid spam
        if (failCount === 1 && isBatchMode) {
          Zotero.alert(
            Zotero.getMainWindow(),
            'Summary Generation Error',
            `Failed to generate summary for first item:\n\n${error.message}\n\nWill continue with remaining items.\nCheck Help → Debug Output Logging for details.`
          );
        } else if (!isBatchMode) {
          // For single item, always show the error
          Zotero.alert(
            Zotero.getMainWindow(),
            'Summary Generation Error',
            `Failed to generate summary:\n\n${error.message}\n\nCheck Help → Debug Output Logging for details.`
          );
        }
      }
    }

    if (failCount === 0) {
      progressWin.addLines([`Complete! Generated ${successCount} summaries.`], 'success');
      progressWin.startCloseTimer(3000);
    } else {
      progressWin.addLines([`Completed with errors. Success: ${successCount}, Failed: ${failCount}`], 'error');
      progressWin.startCloseTimer(8000);
    }
  },

  async playTTSFromContext(mode) {
    // mode: 'summary' or 'full'
    Zotero.debug(`TTS: playTTSFromContext called with mode: ${mode}`);

    // Check if TTS is enabled in preferences
    const prefs = Services.prefs.getBranch('extensions.summarycreator.tts.');
    if (!prefs.getBoolPref('enabled', true)) {
      Zotero.alert(
        Zotero.getMainWindow(),
        'TTS Disabled',
        'Text-to-Speech is disabled in preferences. Enable it in Tools → Summary Creator Preferences.'
      );
      return;
    }

    // Check if Web Speech API is available
    const win = Zotero.getMainWindow();
    if (!win.speechSynthesis) {
      Zotero.alert(
        win,
        'TTS Not Supported',
        'Text-to-Speech is not supported in this browser environment.'
      );
      return;
    }

    // Check if voices are available
    const voices = win.speechSynthesis.getVoices();
    if (voices.length === 0) {
      Zotero.alert(
        win,
        'No Voices Available',
        'No TTS voices available. Please install system voices:\n\n' +
        '• macOS: System Preferences → Accessibility → Spoken Content\n' +
        '• Windows: Settings → Time & Language → Speech'
      );
      return;
    }

    // Get selected items
    const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems || selectedItems.length === 0) {
      Zotero.alert(
        win,
        'No Selection',
        'Please select one or more items to play with TTS.'
      );
      return;
    }

    // For now, just play the first selected item
    // TODO: Implement queue for multiple items
    const item = selectedItems[0];

    try {
      // Initialize TTS service
      const webSpeechProvider = new WebSpeechProvider();
      const ttsService = new TTSService({ webSpeech: webSpeechProvider });
      await ttsService.initialize();

      // Get content to play
      let textToSpeak = '';

      if (mode === 'summary') {
        // Get generated summary from notes
        const notes = item.getNotes();
        let foundSummary = false;

        for (const noteID of notes) {
          const note = await Zotero.Items.getAsync(noteID);
          const content = note.getNote();

          if (content.includes('GENERATED SUMMARY')) {
            // Extract plain text from HTML
            const div = win.document.createElement('div');
            div.innerHTML = content;
            textToSpeak = div.textContent || div.innerText || '';
            foundSummary = true;
            break;
          }
        }

        if (!foundSummary) {
          Zotero.alert(
            win,
            'No Summary Found',
            'No summary found for this item. Generate a summary first using "Generate Summary".'
          );
          return;
        }
      } else {
        // mode === 'full'
        // Get full paper content and filter it
        const rawContent = await Zotero.SummaryCreator.extractContent(item);
        if (!rawContent) {
          Zotero.alert(
            win,
            'No Content',
            'No content available to read. The item may have no abstract or PDF.'
          );
          return;
        }

        // Filter content to remove figures, tables, footnotes, etc.
        const filterService = new ContentFilterService({ aggressiveness: 'medium' });
        textToSpeak = filterService.filterForTTS(rawContent);

        if (!textToSpeak || textToSpeak.trim().length < 100) {
          Zotero.alert(
            win,
            'Filtering Error',
            'Content filtering removed too much text. The PDF may have extraction issues.\n\n' +
            'Try using "Play Summary" instead, or check the PDF quality.'
          );
          return;
        }
      }

      // Open playback dialog
      Zotero.debug(`TTS: Opening playback dialog with ${textToSpeak.length} characters`);

      const io = {
        ttsService: ttsService,
        item: item,
        mode: mode,
        textContent: textToSpeak
      };

      win.openDialog(
        this.rootURI + 'chrome/content/tts-dialog.xhtml',
        'tts-playback',
        'chrome,titlebar,toolbar,centerscreen,resizable',
        io
      );

    } catch (error) {
      Zotero.debug(`TTS: Error in playTTSFromContext: ${error}`, 1);
      Zotero.debug(error.stack, 1);
      Zotero.alert(
        win,
        'TTS Error',
        `Failed to start TTS playback:\n\n${error.message}`
      );
    }
  }
};

// Plugin lifecycle hooks for Zotero 7
function startup(data) {
  ZoteroSummaryCreator.startup(data);
}

function shutdown() {
  ZoteroSummaryCreator.shutdown();
}

function install() {
  ZoteroSummaryCreator.install();
}

function uninstall() {
  ZoteroSummaryCreator.uninstall();
}
