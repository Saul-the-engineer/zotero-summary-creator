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
      playMenuSummary.addEventListener('command', async () => {
        try {
          Zotero.debug('TTS: Play Summary menu clicked');
          await this.playTTSFromContext('summary');
        } catch (e) {
          Zotero.debug(`TTS: Error in Play Summary handler: ${e}`, 1);
          Zotero.debug(`TTS: Stack: ${e.stack}`, 1);
        }
      });
      itemPopup.appendChild(playMenuSummary);

      const playMenuAbstract = Zotero.getMainWindow().document.createXULElement('menuitem');
      playMenuAbstract.id = 'zotero-summarycreator-play-abstract';
      playMenuAbstract.setAttribute('label', '\ud83d\udd0a Play Abstract (TTS)');
      playMenuAbstract.addEventListener('command', async () => {
        try {
          Zotero.debug('TTS: Play Abstract menu clicked');
          await this.playTTSFromContext('abstract');
        } catch (e) {
          Zotero.debug(`TTS: Error in Play Abstract handler: ${e}`, 1);
          Zotero.debug(`TTS: Stack: ${e.stack}`, 1);
        }
      });
      itemPopup.appendChild(playMenuAbstract);

      const playMenuFull = Zotero.getMainWindow().document.createXULElement('menuitem');
      playMenuFull.id = 'zotero-summarycreator-play-full';
      playMenuFull.setAttribute('label', '\ud83d\udd0a Play Full Paper (TTS)');
      playMenuFull.addEventListener('command', async () => {
        try {
          Zotero.debug('TTS: Play Full Paper menu clicked');
          await this.playTTSFromContext('full');
        } catch (e) {
          Zotero.debug(`TTS: Error in Play Full Paper handler: ${e}`, 1);
          Zotero.debug(`TTS: Stack: ${e.stack}`, 1);
        }
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

    const playAbstractMenu = doc.getElementById('zotero-summarycreator-play-abstract');
    if (playAbstractMenu) playAbstractMenu.remove();

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
    if (!prefBranch.prefHasUserValue('autoManageServer')) {
      prefBranch.setBoolPref('autoManageServer', true);
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

  // Helper function to extract clean text from HTML
  htmlToPlainText(html) {
    if (!html || typeof html !== 'string') {
      Zotero.debug('TTS: htmlToPlainText received invalid input', 2);
      return '';
    }

    const win = Zotero.getMainWindow();
    let text = '';

    try {
      // Try using DOMParser for safer HTML parsing
      const parser = new win.DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      if (doc.body) {
        text = doc.body.textContent || doc.body.innerText || '';
      } else {
        // Fallback: try plain div approach
        const div = win.document.createElement('div');
        div.innerHTML = html;
        text = div.textContent || div.innerText || '';
      }
    } catch (e) {
      Zotero.debug(`TTS: Error parsing HTML: ${e}`, 1);

      // Last resort: strip HTML tags with regex (not perfect but safe)
      text = html.replace(/<[^>]*>/g, ' ');
    }

    // Aggressive cleaning for TTS compatibility
    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters
    text = text.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
    text = text.replace(/[\u2018\u2019]/g, "'"); // Replace smart quotes with regular quotes
    text = text.replace(/[\u201C\u201D]/g, '"'); // Replace smart double quotes
    text = text.replace(/[\u2013\u2014]/g, '-'); // Replace en/em dashes
    text = text.replace(/\u2026/g, '...'); // Replace ellipsis
    text = text.replace(/&nbsp;/g, ' '); // Replace HTML entities
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/[^\x20-\x7E\n\r\t]/g, ''); // Keep only printable ASCII + newlines/tabs
    text = text.replace(/\s+/g, ' ').trim(); // Normalize whitespace

    return text;
  },

  // Clean text for TTS - even more aggressive
  cleanTextForTTS(text) {
    if (!text || typeof text !== 'string') {
      Zotero.debug('TTS: cleanTextForTTS received invalid input', 2);
      return '';
    }

    Zotero.debug(`TTS: Cleaning ${text.length} chars for TTS`);

    // Start with basic cleaning
    let cleaned = text;

    // Remove control characters and special unicode
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
    cleaned = cleaned.replace(/[\uFFF0-\uFFFF]/g, '');

    // Replace unicode punctuation with ASCII equivalents
    cleaned = cleaned.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
    cleaned = cleaned.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
    cleaned = cleaned.replace(/[\u2013\u2014]/g, '-');
    cleaned = cleaned.replace(/\u2026/g, '...');
    cleaned = cleaned.replace(/[\u2022\u2023\u2043]/g, '*');

    // Remove emojis and symbols (they can cause issues)
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Misc Symbols
    cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport
    cleaned = cleaned.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ''); // Flags
    cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');   // Misc symbols
    cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');   // Dingbats

    // Keep only safe printable characters
    cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t]/g, '');

    // Normalize whitespace
    cleaned = cleaned.replace(/\t/g, ' ');
    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/\r/g, '\n');
    cleaned = cleaned.replace(/ +/g, ' ');
    cleaned = cleaned.replace(/\n+/g, '\n');
    cleaned = cleaned.trim();

    Zotero.debug(`TTS: Cleaned to ${cleaned.length} chars`);

    // Log first 200 chars for debugging
    if (cleaned.length > 0) {
      Zotero.debug(`TTS: First 200 chars: "${cleaned.substring(0, 200)}"`);
    }

    return cleaned;
  },

  async playTTSFromContext(mode) {
    // mode: 'summary', 'abstract', or 'full'
    Zotero.debug(`TTS: ===== playTTSFromContext CALLED with mode: ${mode} =====`);

    const win = Zotero.getMainWindow();

    try {
      Zotero.debug(`TTS: Inside try block, checking prerequisites...`);
      // Check if TTS is enabled in preferences
      const prefs = Services.prefs.getBranch('extensions.summarycreator.tts.');
      if (!prefs.getBoolPref('enabled', true)) {
        Zotero.alert(
          win,
          'TTS Disabled',
          'Text-to-Speech is disabled in preferences. Enable it in Tools → Summary Creator Preferences.'
        );
        return;
      }

      // Check if Web Speech API is available
      if (!win.speechSynthesis) {
        Zotero.alert(
          win,
          'TTS Not Supported',
          'Text-to-Speech is not supported in this browser environment.'
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
      let item = selectedItems[0];

      // Check if the selected item is an attachment instead of a regular item
      if (!item.isRegularItem()) {
        Zotero.debug(`TTS: Selected item ${item.id} is not a regular item (it's an attachment or note)`, 2);

        // Try to get the parent item
        if (item.parentID) {
          const parentItem = await Zotero.Items.getAsync(item.parentID);
          if (parentItem && parentItem.isRegularItem()) {
            Zotero.debug(`TTS: Using parent item ${parentItem.id} instead`);
            item = parentItem;
          } else {
            Zotero.alert(
              win,
              'Invalid Selection',
              'Please select a regular item (not an attachment or note).'
            );
            return;
          }
        } else {
          Zotero.alert(
            win,
            'Invalid Selection',
            'Please select a regular item (not an attachment or note).'
          );
          return;
        }
      }

      Zotero.debug(`TTS: Processing item ${item.id} (${item.getField('title').substring(0, 50)})`);

      // Initialize TTS service and wait for voices to load
      const webSpeechProvider = new WebSpeechProvider();

      // Wait for voices to be available (async loading in Firefox)
      const voicesLoaded = await webSpeechProvider.waitForVoices(5000);

      if (!voicesLoaded) {
        Zotero.alert(
          win,
          'No Voices Available',
          'No TTS voices available. Please install system voices:\n\n' +
          '• macOS: System Preferences → Accessibility → Spoken Content\n' +
          '• Windows: Settings → Time & Language → Speech\n\n' +
          'After installing voices, restart Zotero.'
        );
        return;
      }

      const ttsService = new TTSService({ webSpeech: webSpeechProvider });
      await ttsService.initialize();
      Zotero.debug('TTS: Service initialized');

      // Get content to play
      let textToSpeak = '';

      if (mode === 'summary') {
        Zotero.debug('TTS: Extracting summary from notes');

        // Get generated summary from notes
        const notes = item.getNotes();
        Zotero.debug(`TTS: Found ${notes.length} notes`);

        let foundSummary = false;

        for (const noteID of notes) {
          const note = await Zotero.Items.getAsync(noteID);
          const content = note.getNote();

          Zotero.debug(`TTS: Checking note ${noteID}, length: ${content.length}`);

          if (content.includes('GENERATED SUMMARY')) {
            Zotero.debug('TTS: Found summary note');

            // Extract plain text from HTML
            const rawText = this.htmlToPlainText(content);
            Zotero.debug(`TTS: Extracted ${rawText.length} chars from HTML`);

            // Apply aggressive TTS cleaning
            textToSpeak = this.cleanTextForTTS(rawText);

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
      } else if (mode === 'abstract') {
        Zotero.debug('TTS: Extracting abstract');

        // Get abstract from item
        const abstract = item.getField('abstractNote');

        if (!abstract || abstract.trim() === '') {
          Zotero.alert(
            win,
            'No Abstract',
            'This item has no abstract available.'
          );
          return;
        }

        Zotero.debug(`TTS: Found abstract (${abstract.length} chars)`);

        // Apply aggressive TTS cleaning
        textToSpeak = this.cleanTextForTTS(abstract);
      } else {
        // mode === 'full'
        Zotero.debug('TTS: Extracting full paper content');

        // Get full paper content and filter it
        const rawContent = await Zotero.SummaryCreator.extractContent(item);

        Zotero.debug(`TTS: Extracted raw content: ${rawContent ? rawContent.length : 0} chars`);

        if (!rawContent) {
          Zotero.alert(
            win,
            'No Content',
            'No content available to read. The item may have no abstract or PDF.'
          );
          return;
        }

        // Filter content to remove figures, tables, footnotes, etc.
        Zotero.debug('TTS: Filtering content');
        const filterService = new ContentFilterService({ aggressiveness: 'medium' });
        const filteredText = filterService.filterForTTS(rawContent);

        Zotero.debug(`TTS: Filtered to ${filteredText.length} chars`);

        if (!filteredText || filteredText.trim().length < 100) {
          Zotero.alert(
            win,
            'Filtering Error',
            'Content filtering removed too much text. The PDF may have extraction issues.\n\n' +
            'Try using "Play Summary" instead, or check the PDF quality.'
          );
          return;
        }

        // Apply aggressive TTS cleaning
        textToSpeak = this.cleanTextForTTS(filteredText);
      }

      // Validate text content
      if (!textToSpeak || textToSpeak.trim() === '') {
        throw new Error('Text content is empty after extraction and cleaning');
      }

      // Additional validation - check for problematic characters
      if (textToSpeak.length < 10) {
        throw new Error(`Text too short for TTS: ${textToSpeak.length} characters`);
      }

      // Open playback dialog
      Zotero.debug(`TTS: Opening playback dialog with ${textToSpeak.length} characters`);
      Zotero.debug(`TTS: Dialog URL: ${this.rootURI}chrome/content/tts-dialog.xhtml`);

      const io = {
        ttsService: ttsService,
        item: item,
        mode: mode,
        textContent: textToSpeak
      };

      Zotero.debug(`TTS: IO object keys: ${Object.keys(io).join(', ')}`);

      // Use chrome:// protocol for better compatibility
      const dialogURL = this.rootURI + 'chrome/content/tts-dialog.xhtml';
      Zotero.debug(`TTS: Full dialog URL: ${dialogURL}`);

      const dialog = win.openDialog(
        dialogURL,
        'tts-playback',
        'chrome,titlebar,toolbar,centerscreen,resizable,dialog=yes,alwaysRaised=yes',
        io
      );

      Zotero.debug(`TTS: Dialog object: ${dialog ? 'created' : 'null'}`);

      if (dialog) {
        Zotero.debug(`TTS: Dialog document state: ${dialog.document ? dialog.document.readyState : 'no document'}`);
        Zotero.debug(`TTS: Dialog location: ${dialog.location ? dialog.location.href : 'no location'}`);
      }

      Zotero.debug('TTS: Dialog opened successfully');

    } catch (error) {
      Zotero.debug(`TTS: Error in playTTSFromContext: ${error}`, 1);
      Zotero.debug(`TTS: Error stack: ${error.stack}`, 1);
      Zotero.alert(
        win,
        'TTS Error',
        `Failed to start TTS playback:\n\n${error.message}\n\nCheck Help → Debug Output Logging for details.`
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
