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

  async extractPDFContent(item) {
    // Extract PDF content (skip abstract, go straight to PDF)
    Zotero.debug('TTS: Looking for PDF attachment');

    const attachments = item.getAttachments();
    Zotero.debug(`TTS: Found ${attachments.length} attachments`);

    for (const attachmentID of attachments) {
      const attachment = await Zotero.Items.getAsync(attachmentID);

      if (attachment.attachmentContentType === 'application/pdf') {
        try {
          Zotero.debug(`TTS: Found PDF attachment ${attachmentID}`);

          // Get PDF text using Zotero's fulltext extraction
          const indexedState = await Zotero.Fulltext.getIndexedState(attachmentID);
          Zotero.debug(`TTS: PDF indexed state: ${indexedState}`);

          // If not indexed, trigger indexing
          if (indexedState !== Zotero.Fulltext.INDEX_STATE_INDEXED) {
            Zotero.debug('TTS: PDF not indexed, triggering indexing...');
            await Zotero.Fulltext.indexItems([attachmentID]);

            // Wait briefly for indexing
            let attempts = 0;
            while (attempts < 10) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              const state = await Zotero.Fulltext.getIndexedState(attachmentID);
              if (state === Zotero.Fulltext.INDEX_STATE_INDEXED) {
                Zotero.debug('TTS: PDF indexed successfully');
                break;
              }
              attempts++;
            }
          }

          const pdfText = await Zotero.Fulltext.getItemContent(attachmentID);

          if (pdfText && pdfText.content && pdfText.content.trim()) {
            const content = pdfText.content.trim();
            Zotero.debug(`TTS: Extracted ${content.length} chars from PDF`);
            return content;
          }
        } catch (error) {
          Zotero.debug(`TTS: Error extracting PDF: ${error}`, 2);
        }
      }
    }

    Zotero.debug('TTS: No PDF content found', 2);
    return null;
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

            // Skip to Executive Summary section to avoid reading title/authors
            let contentToSpeak = rawText;
            const execSummaryMatch = rawText.match(/Executive Summary\s*(.*)/is);
            if (execSummaryMatch) {
              contentToSpeak = 'Executive Summary. ' + execSummaryMatch[1];
              Zotero.debug(`TTS: Skipped to Executive Summary, now ${contentToSpeak.length} chars`);
            }

            // Apply aggressive TTS cleaning
            textToSpeak = this.cleanTextForTTS(contentToSpeak);

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
        Zotero.debug('TTS: Extracting full paper content from PDF');

        // Get full paper content from PDF (skip abstract)
        const rawContent = await this.extractPDFContent(item);

        Zotero.debug(`TTS: Extracted raw PDF content: ${rawContent ? rawContent.length : 0} chars`);

        if (!rawContent) {
          // Fallback to abstract if PDF extraction failed
          Zotero.debug('TTS: PDF extraction failed, trying abstract as fallback');
          const abstract = item.getField('abstractNote');
          if (abstract && abstract.trim()) {
            Zotero.debug(`TTS: Using abstract as fallback (${abstract.length} chars)`);
            textToSpeak = this.cleanTextForTTS(abstract);
          } else {
            Zotero.alert(
              win,
              'No Content',
              'No PDF content available to read. The PDF may not be indexed yet.\n\n' +
              'Try:\n' +
              '1. Right-click the PDF → "Reindex Item"\n' +
              '2. Wait a moment for indexing to complete\n' +
              '3. Try "Play Full Paper" again\n\n' +
              'Or use "Play Abstract" instead.'
            );
            return;
          }
        } else {
          // Filter content to remove figures, tables, footnotes, etc.
          Zotero.debug(`TTS: Starting with ${rawContent.length} chars of raw PDF text`);
          Zotero.debug(`TTS: First 500 chars: "${rawContent.substring(0, 500)}"`);

          const filterService = new ContentFilterService({ aggressiveness: 'medium' });
          const filteredText = filterService.filterForTTS(rawContent);

          Zotero.debug(`TTS: After filtering: ${filteredText.length} chars`);

          if (!filteredText || filteredText.trim().length < 50) {
            const percentRemoved = ((rawContent.length - filteredText.length) / rawContent.length * 100).toFixed(0);
            Zotero.alert(
              win,
              'Filtering Error',
              `Content filtering removed too much text (${percentRemoved}% removed, ${filteredText.length} chars remaining).\n\n` +
              'The PDF text may have formatting issues. Try:\n' +
              '1. Use "Play Abstract" instead\n' +
              '2. Right-click PDF → "Reindex Item"\n' +
              '3. Check debug output for what was extracted'
            );
            return;
          }

          // Apply aggressive TTS cleaning
          textToSpeak = this.cleanTextForTTS(filteredText);
        }
      }

      // Validate text content
      if (!textToSpeak || textToSpeak.trim() === '') {
        throw new Error('Text content is empty after extraction and cleaning');
      }

      // Additional validation - check for problematic characters
      if (textToSpeak.length < 10) {
        throw new Error(`Text too short for TTS: ${textToSpeak.length} characters`);
      }

      // Open control window with inline HTML
      Zotero.debug(`TTS: Opening control window for ${textToSpeak.length} characters`);

      const controlWindow = win.open('about:blank', 'ttsControls',
        'chrome,titlebar,centerscreen,resizable,width=500,height=450');

      if (!controlWindow) {
        Zotero.alert(win, 'TTS Error', 'Failed to open control window');
        return;
      }

      // Wait for window to load then build UI
      controlWindow.addEventListener('load', () => {
        Zotero.debug('TTS: Control window loaded, building UI with DOM');

        const doc = controlWindow.document;
        doc.title = `TTS: ${item.getField('title').substring(0, 50)}...`;

        // Add styles
        const style = doc.createElement('style');
        style.textContent = `
          body { font-family: -apple-system, system-ui, sans-serif; padding: 20px; margin: 0; background: #f5f5f5; }
          .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          h2 { margin-top: 0; color: #333; font-size: 18px; }
          .info { margin-bottom: 20px; padding: 10px; background: #f9f9f9; border-radius: 4px; font-size: 14px; }
          .controls { display: flex; gap: 10px; margin-bottom: 20px; justify-content: center; }
          button { padding: 10px 20px; font-size: 14px; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
          button:hover { opacity: 0.9; }
          button:disabled { opacity: 0.5; cursor: not-allowed; }
          .btn-play { background: #4CAF50; color: white; }
          .btn-pause { background: #FF9800; color: white; }
          .btn-stop { background: #f44336; color: white; }
          .btn-skip { background: #2196F3; color: white; padding: 10px 15px; }
          .slider-group { margin-bottom: 15px; }
          .slider-group label { display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px; color: #666; }
          input[type="range"] { width: 100%; }
          .status { text-align: center; padding: 10px; background: #e3f2fd; border-radius: 4px; font-size: 14px; color: #1976d2; margin-bottom: 15px; }
          .progress-bar { width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 5px; }
          .progress-fill { height: 100%; background: #4CAF50; width: 0%; transition: width 0.3s; }
          .progress-text { text-align: center; font-size: 12px; color: #666; }
        `;
        doc.head.appendChild(style);

        // Create container
        const container = doc.createElement('div');
        container.className = 'container';

        // Title
        const title = doc.createElement('h2');
        title.textContent = 'TTS Playback';
        container.appendChild(title);

        // Info
        const info = doc.createElement('div');
        info.className = 'info';
        info.innerHTML = `<strong>Mode:</strong> ${mode}<br><strong>Length:</strong> ${textToSpeak.length} characters`;
        container.appendChild(info);

        // Status
        const status = doc.createElement('div');
        status.className = 'status';
        status.id = 'status';
        status.textContent = 'Ready to play';
        container.appendChild(status);

        // Progress bar
        const progressBar = doc.createElement('div');
        progressBar.className = 'progress-bar';
        const progressFill = doc.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.id = 'progressFill';
        progressBar.appendChild(progressFill);
        container.appendChild(progressBar);

        const progressText = doc.createElement('div');
        progressText.className = 'progress-text';
        progressText.id = 'progressText';
        progressText.textContent = '0%';
        container.appendChild(progressText);

        // Controls
        const controls = doc.createElement('div');
        controls.className = 'controls';

        const btnRewind = doc.createElement('button');
        btnRewind.className = 'btn-skip';
        btnRewind.id = 'btnRewind';
        btnRewind.textContent = '⏪';
        btnRewind.title = 'Rewind';
        controls.appendChild(btnRewind);

        const btnPlay = doc.createElement('button');
        btnPlay.className = 'btn-play';
        btnPlay.id = 'btnPlay';
        btnPlay.textContent = '▶ Play';
        controls.appendChild(btnPlay);

        const btnPause = doc.createElement('button');
        btnPause.className = 'btn-pause';
        btnPause.id = 'btnPause';
        btnPause.textContent = '⏸ Pause';
        btnPause.disabled = true;
        controls.appendChild(btnPause);

        const btnStop = doc.createElement('button');
        btnStop.className = 'btn-stop';
        btnStop.id = 'btnStop';
        btnStop.textContent = '⏹ Stop';
        btnStop.disabled = true;
        controls.appendChild(btnStop);

        const btnForward = doc.createElement('button');
        btnForward.className = 'btn-skip';
        btnForward.id = 'btnForward';
        btnForward.textContent = '⏩';
        btnForward.title = 'Forward';
        controls.appendChild(btnForward);

        container.appendChild(controls);

        // Speed slider
        const speedGroup = doc.createElement('div');
        speedGroup.className = 'slider-group';
        const speedLabel = doc.createElement('label');
        speedLabel.innerHTML = 'Speed: <span id="speedValue">1.0x</span>';
        speedGroup.appendChild(speedLabel);
        const speedSlider = doc.createElement('input');
        speedSlider.type = 'range';
        speedSlider.id = 'speedSlider';
        speedSlider.min = '0.5';
        speedSlider.max = '2.0';
        speedSlider.step = '0.1';
        speedSlider.value = '1.0';
        speedGroup.appendChild(speedSlider);
        container.appendChild(speedGroup);

        // Volume slider
        const volumeGroup = doc.createElement('div');
        volumeGroup.className = 'slider-group';
        const volumeLabel = doc.createElement('label');
        volumeLabel.innerHTML = 'Volume: <span id="volumeValue">100%</span>';
        volumeGroup.appendChild(volumeLabel);
        const volumeSlider = doc.createElement('input');
        volumeSlider.type = 'range';
        volumeSlider.id = 'volumeSlider';
        volumeSlider.min = '0';
        volumeSlider.max = '100';
        volumeSlider.step = '5';
        volumeSlider.value = '100';
        volumeGroup.appendChild(volumeSlider);
        container.appendChild(volumeGroup);

        doc.body.appendChild(container);

        Zotero.debug('TTS: DOM structure created');

        const synth = win.speechSynthesis;
        Zotero.debug(`TTS: speechSynthesis available: ${synth ? 'yes' : 'no'}`);

        Zotero.debug(`TTS: Elements found - Play: ${!!btnPlay}, Pause: ${!!btnPause}, Stop: ${!!btnStop}`);

        if (!btnPlay) {
          Zotero.debug('TTS: ERROR - Play button not found!', 1);
          return;
        }

        // Split text into chunks for better control (max 200 chars per chunk)
        const chunkSize = 200;
        const chunks = [];
        for (let i = 0; i < textToSpeak.length; i += chunkSize) {
          chunks.push(textToSpeak.substring(i, i + chunkSize));
        }

        Zotero.debug(`TTS: Split into ${chunks.length} chunks`);

        let currentChunk = 0;
        let isPlaying = false;
        let isPaused = false;

        const updateProgress = () => {
          const progress = ((currentChunk / chunks.length) * 100).toFixed(0);
          const fillEl = doc.getElementById('progressFill');
          const textEl = doc.getElementById('progressText');
          if (fillEl) fillEl.style.width = progress + '%';
          if (textEl) textEl.textContent = progress + '%';
        };

        const updateStatus = (msg) => {
          const statusEl = doc.getElementById('status');
          if (statusEl) statusEl.textContent = msg;
          Zotero.debug(`TTS: Status - ${msg}`);
        };

        const speakChunk = () => {
          Zotero.debug(`TTS: speakChunk called - chunk ${currentChunk}/${chunks.length}`);

          if (currentChunk >= chunks.length) {
            updateStatus('Playback complete');
            btnPlay.disabled = true;
            btnPause.disabled = true;
            btnStop.disabled = true;
            isPlaying = false;
            return;
          }

          const utterance = new win.SpeechSynthesisUtterance(chunks[currentChunk]);
          const speedSlider = doc.getElementById('speedSlider');
          const volumeSlider = doc.getElementById('volumeSlider');

          utterance.rate = speedSlider ? parseFloat(speedSlider.value) : 1.0;
          utterance.volume = volumeSlider ? parseInt(volumeSlider.value) / 100 : 1.0;

          Zotero.debug(`TTS: Speaking chunk ${currentChunk} - rate: ${utterance.rate}, volume: ${utterance.volume}`);

          utterance.onstart = () => {
            Zotero.debug(`TTS: Utterance started for chunk ${currentChunk}`);
          };

          utterance.onend = () => {
            Zotero.debug(`TTS: Utterance ended for chunk ${currentChunk}`);
            if (!isPaused && isPlaying) {
              currentChunk++;
              updateProgress();
              speakChunk();
            }
          };

          utterance.onerror = (e) => {
            Zotero.debug(`TTS: Utterance error: ${e.error}`, 1);
            updateStatus(`Error: ${e.error}`);
          };

          synth.speak(utterance);
          Zotero.debug(`TTS: Utterance queued`);
        };

        // Play button
        Zotero.debug('TTS: Attaching Play button listener');
        btnPlay.addEventListener('click', () => {
          Zotero.debug('TTS: Play button clicked!');
          synth.cancel();
          isPlaying = true;
          isPaused = false;
          btnPlay.disabled = true;
          btnPause.disabled = false;
          btnStop.disabled = false;
          updateStatus('Playing...');
          speakChunk();
        });

        // Pause button
        Zotero.debug('TTS: Attaching Pause button listener');
        btnPause.addEventListener('click', () => {
          Zotero.debug('TTS: Pause button clicked!');
          if (synth.speaking) {
            synth.cancel();
            isPaused = true;
            isPlaying = false;
            btnPlay.disabled = false;
            btnPause.disabled = true;
            updateStatus('Paused');
          }
        });

        // Stop button
        Zotero.debug('TTS: Attaching Stop button listener');
        btnStop.addEventListener('click', () => {
          Zotero.debug('TTS: Stop button clicked!');
          synth.cancel();
          isPlaying = false;
          isPaused = false;
          currentChunk = 0;
          updateProgress();
          btnPlay.disabled = false;
          btnPause.disabled = true;
          btnStop.disabled = true;
          updateStatus('Stopped');
        });

        // Rewind button
        Zotero.debug('TTS: Attaching Rewind button listener');
        btnRewind.addEventListener('click', () => {
          Zotero.debug('TTS: Rewind button clicked!');
          currentChunk = Math.max(0, currentChunk - 5);
          updateProgress();
          if (isPlaying) {
            synth.cancel();
            speakChunk();
          }
        });

        // Forward button
        Zotero.debug('TTS: Attaching Forward button listener');
        btnForward.addEventListener('click', () => {
          Zotero.debug('TTS: Forward button clicked!');
          currentChunk = Math.min(chunks.length - 1, currentChunk + 5);
          updateProgress();
          if (isPlaying) {
            synth.cancel();
            speakChunk();
          }
        });

        // Speed slider
        doc.getElementById('speedSlider').addEventListener('input', (e) => {
          doc.getElementById('speedValue').textContent = e.target.value + 'x';
        });

        // Volume slider
        doc.getElementById('volumeSlider').addEventListener('input', (e) => {
          doc.getElementById('volumeValue').textContent = e.target.value + '%';
        });

        updateProgress();

        // Stop speech when window closes
        controlWindow.addEventListener('unload', () => {
          Zotero.debug('TTS: Window closing, stopping speech');
          synth.cancel();
          isPlaying = false;
          isPaused = false;
        });
      });

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
