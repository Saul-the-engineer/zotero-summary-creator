// Main Summary Creator Module
// Integrates our TDD-built services into Zotero

Zotero.SummaryCreator = {
  initialized: false,
  ollamaClient: null,
  summaryParser: null,
  ollamaServerManager: null,

  async init() {
    if (this.initialized) return;

    // Load our core modules
    await this.loadModules();

    this.initialized = true;
    Zotero.debug('Summary Creator: Core modules loaded');
  },

  async loadModules() {
    // In a real plugin, we'd bundle our src/ code
    // For now, we'll create inline versions adapted for Zotero
    this.ollamaClient = new OllamaClientAdapter();
    this.summaryParser = new SummaryParserAdapter();
    this.ollamaServerManager = new OllamaServerManager();
  },

  async generateSummary(item, options = {}) {
    await this.init();

    if (!item.isRegularItem()) {
      throw createError(ErrorType.INVALID_ITEM);
    }

    // Get preferences
    const prefs = Services.prefs.getBranch('extensions.summarycreator.');
    const ollamaUrl = prefs.getCharPref('ollamaUrl');
    const ollamaModel = prefs.getCharPref('ollamaModel');
    const autoOpen = prefs.getBoolPref('autoOpen');
    const autoManageServer = prefs.getBoolPref('autoManageServer');

    Zotero.debug(`Summary Creator: Using model '${ollamaModel}' at URL '${ollamaUrl}'`);
    Zotero.debug(`Summary Creator: Auto-manage server: ${autoManageServer}, Auto-open: ${autoOpen}`);

    // Check if this is batch mode (default: false for single item)
    const isBatchMode = options.batchMode || false;

    // Extract content
    Zotero.debug(`Summary Creator: Extracting content for item ${item.id}`);
    const content = await this.extractContent(item);

    if (!content) {
      // Provide more helpful error message based on what we found
      const attachments = item.getAttachments();
      if (attachments.length === 0) {
        throw createError(ErrorType.NO_CONTENT);
      }

      // Check if we have linked files (common issue with OpenReview, arXiv)
      let hasLinkedFiles = false;
      for (const attID of attachments) {
        const att = await Zotero.Items.getAsync(attID);
        if (att.attachmentContentType === 'application/pdf' && att.attachmentLinkMode === 1) {
          hasLinkedFiles = true;
          break;
        }
      }

      if (hasLinkedFiles) {
        throw createError(ErrorType.LINKED_FILES);
      } else {
        throw createError(ErrorType.PDF_EXTRACTION_FAILED);
      }
    }

    Zotero.debug(`Summary Creator: Extracted ${content.length} characters of content`);

    // Start Ollama server if auto-manage is enabled
    if (autoManageServer) {
      try {
        await this.ollamaServerManager.startServer(ollamaUrl);
      } catch (error) {
        Zotero.debug(`Summary Creator: Failed to start Ollama server: ${error.message}`, 1);
        throw new Error(`Failed to start Ollama server: ${error.message}`);
      }
    }

    let rawSummary;
    let parsedSummary;

    try {
      // Generate summary using Ollama
      Zotero.debug(`Summary Creator: Calling Ollama at ${ollamaUrl} with model ${ollamaModel}`);

      try {
        rawSummary = await this.ollamaClient.createSummary(
          content,
          ollamaUrl,
          ollamaModel
        );
        Zotero.debug(`Summary Creator: Received response from Ollama (${rawSummary.length} chars)`);
      } catch (error) {
        Zotero.debug(`Summary Creator: Ollama error: ${error.message}`, 1);
        throw createOllamaError(error.message);
      }

      // Parse summary
      Zotero.debug(`Summary Creator: Parsing summary`);
      parsedSummary = this.summaryParser.parse(rawSummary);
    } finally {
      // Stop the Ollama server if auto-manage is enabled
      if (autoManageServer) {
        try {
          await this.ollamaServerManager.stopServer(ollamaUrl);
        } catch (stopError) {
          Zotero.debug(`Summary Creator: Failed to stop Ollama server: ${stopError.message}`, 2);
          // Don't throw - we don't want to mask the original error
        }
      }
    }

    // Validate parsed summary
    if (!parsedSummary.executiveSummary || parsedSummary.executiveSummary.trim() === '') {
      Zotero.debug('Summary Creator: Warning - Empty executive summary', 2);
      Zotero.debug(`Summary Creator: Raw summary was: ${rawSummary.substring(0, 500)}`, 2);
      throw createError(ErrorType.EMPTY_SUMMARY);
    }

    // Warn if sections are missing but don't fail
    if (parsedSummary.keyContributions.length === 0) {
      Zotero.debug('Summary Creator: Warning - No key contributions extracted', 2);
    }
    if (parsedSummary.limitations.length === 0) {
      Zotero.debug('Summary Creator: Warning - No limitations extracted', 2);
    }
    if (parsedSummary.innovationOpportunities.length === 0) {
      Zotero.debug('Summary Creator: Warning - No innovation opportunities extracted', 2);
    }

    // Create formatted note
    const noteContent = this.formatAsNote(item, parsedSummary);

    // Add note to item
    const note = new Zotero.Item('note');
    note.setNote(noteContent);
    note.parentID = item.id;
    await note.saveTx();

    Zotero.debug(`Summary Creator: Note created for item ${item.id}`);

    // Open note if auto-open is enabled AND not in batch mode
    // In batch mode, we don't want to open multiple windows
    if (autoOpen && !isBatchMode) {
      Zotero.debug(`Summary Creator: Opening note window`);
      const noteEditor = Zotero.getActiveZoteroPane().openNoteWindow(note.id);
    } else if (isBatchMode) {
      Zotero.debug(`Summary Creator: Skipping auto-open (batch mode)`);
    }

    return note;
  },

  async extractContent(item) {
    // Try abstract first
    const abstract = item.getField('abstractNote');
    if (abstract && abstract.trim()) {
      Zotero.debug(`Summary Creator: Using abstract (${abstract.length} chars)`);
      return abstract;
    }

    Zotero.debug('Summary Creator: No abstract found, looking for PDF');

    // Try to find PDF attachment
    const attachments = item.getAttachments();
    Zotero.debug(`Summary Creator: Found ${attachments.length} attachments`);

    for (const attachmentID of attachments) {
      const attachment = await Zotero.Items.getAsync(attachmentID);
      const attTitle = attachment.getField('title');
      const linkMode = attachment.attachmentLinkMode;
      const linkModeNames = {
        0: 'imported/stored',
        1: 'linked file',
        2: 'embedded',
        3: 'linked URL'
      };

      Zotero.debug(`Summary Creator: Checking attachment ${attachmentID}: "${attTitle}" (${attachment.attachmentContentType}, link mode: ${linkMode} - ${linkModeNames[linkMode]})`);

      if (attachment.attachmentContentType === 'application/pdf') {
        try {
          // Verify this is actually an attachment item
          Zotero.debug(`Summary Creator: Verifying attachment ${attachmentID} is valid`);
          if (!attachment || typeof attachment !== 'object') {
            Zotero.debug(`Summary Creator: ERROR - attachment is not an object: ${typeof attachment}`, 2);
            continue;
          }

          // Check if this is a valid, accessible PDF file
          Zotero.debug(`Summary Creator: Getting file path for attachment ${attachmentID}`);
          const attachmentPath = attachment.getFilePath();
          if (!attachmentPath) {
            Zotero.debug(`Summary Creator: Attachment ${attachmentID} has no file path (might be linked URL or not downloaded)`, 2);
            continue;
          }

          Zotero.debug(`Summary Creator: PDF path: ${attachmentPath}`);

          // Check if file actually exists on disk
          Zotero.debug(`Summary Creator: Checking if file exists on disk`);
          const file = Zotero.File.pathToFile(attachmentPath);
          if (!file || !file.exists()) {
            Zotero.debug(`Summary Creator: PDF file doesn't exist on disk yet (might still be downloading)`, 2);
            continue;
          }

          const fileSize = file.fileSize;
          Zotero.debug(`Summary Creator: PDF file exists, size: ${fileSize} bytes`);

          // Special handling for linked files (linkMode === 1)
          // Zotero has bugs in getIndexedState() and indexItems() for linked files
          if (linkMode === 1) {
            Zotero.debug(`Summary Creator: WARNING - This is a LINKED file, not stored in Zotero.`, 2);
            Zotero.debug(`Summary Creator: Zotero has bugs with linked file indexing - using direct extraction.`, 2);

            // For linked files, skip the indexing check and try direct extraction
            // This works around Zotero's "item.isAttachment is not a function" bug
            Zotero.debug(`Summary Creator: Attempting direct PDF text extraction for linked file`);

            try {
              // Try to extract directly without indexing
              const pdfText = await Zotero.Fulltext.getItemContent(attachmentID);

              if (pdfText && pdfText.content && pdfText.content.trim()) {
                const content = pdfText.content.trim();
                Zotero.debug(`Summary Creator: Extracted ${content.length} chars from linked PDF`);

                if (content.length < 100) {
                  Zotero.debug(`Summary Creator: PDF text too short (${content.length} chars), might be scanned/image PDF`, 2);
                  continue;
                }

                return content.substring(0, 10000);
              } else {
                Zotero.debug(`Summary Creator: Linked file has no indexed content.`, 2);
                Zotero.debug(`Summary Creator: This is expected - Zotero doesn't index linked files by default.`, 2);
                Zotero.debug(`Summary Creator: Fix: Enable "Index linked files" in Preferences → Search, then Reindex Items.`, 2);
                continue;
              }
            } catch (directError) {
              Zotero.debug(`Summary Creator: Direct extraction failed: ${directError.message}`, 2);
              continue;
            }
          }

          // Check if PDF is indexed
          Zotero.debug(`Summary Creator: Calling Zotero.Fulltext.getIndexedState(${attachmentID})`);
          let indexedState;
          try {
            indexedState = await Zotero.Fulltext.getIndexedState(attachmentID);
            Zotero.debug(`Summary Creator: PDF indexed state: ${indexedState} (0=unindexed, 1=indexed, 2=partial)`);
          } catch (indexError) {
            Zotero.debug(`Summary Creator: ERROR getting indexed state: ${indexError.message}`, 2);
            Zotero.debug(`Summary Creator: Index error stack: ${indexError.stack}`, 2);

            // WORKAROUND: Zotero has a bug in getIndexedState() for linked files
            // If we get "item.isAttachment is not a function", assume it's unindexed
            if (indexError.message && indexError.message.includes('isAttachment')) {
              Zotero.debug(`Summary Creator: Detected Zotero bug with linked files - assuming unindexed`, 2);
              indexedState = 0; // Assume unindexed
            } else {
              throw indexError;
            }
          }

          // If not fully indexed, trigger indexing and wait
          if (indexedState !== Zotero.Fulltext.INDEX_STATE_INDEXED) {
            Zotero.debug('Summary Creator: PDF not fully indexed, triggering indexing...');

            // Clear any existing partial index
            if (indexedState === 2) { // PARTIAL
              Zotero.debug('Summary Creator: Clearing partial index first');
              try {
                await Zotero.Fulltext.clearItemContent(attachmentID);
              } catch (clearError) {
                Zotero.debug(`Summary Creator: ERROR clearing content: ${clearError.message}`, 2);
                throw clearError;
              }
            }

            // Trigger indexing
            Zotero.debug(`Summary Creator: Calling Zotero.Fulltext.indexItems([${attachmentID}])`);
            try {
              await Zotero.Fulltext.indexItems([attachmentID], { forceReindex: true });
            } catch (indexingError) {
              Zotero.debug(`Summary Creator: ERROR indexing items: ${indexingError.message}`, 2);
              Zotero.debug(`Summary Creator: Indexing error stack: ${indexingError.stack}`, 2);
              throw indexingError;
            }

            // Wait with exponential backoff for up to 30 seconds
            let totalWait = 0;
            const maxWait = 30000; // 30 seconds
            let waitTime = 2000; // Start with 2 seconds

            while (totalWait < maxWait) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              totalWait += waitTime;

              indexedState = await Zotero.Fulltext.getIndexedState(attachmentID);
              Zotero.debug(`Summary Creator: After ${totalWait}ms wait, index state: ${indexedState}`);

              if (indexedState === Zotero.Fulltext.INDEX_STATE_INDEXED) {
                Zotero.debug('Summary Creator: PDF successfully indexed');
                break;
              }

              // Exponential backoff: 2s, 4s, 8s, 16s
              waitTime = Math.min(waitTime * 2, 8000);
            }

            if (indexedState !== Zotero.Fulltext.INDEX_STATE_INDEXED) {
              Zotero.debug(`Summary Creator: PDF still not indexed after ${totalWait}ms. State: ${indexedState}`, 2);
              // Continue anyway - partial index might have some content
            }
          }

          // Get PDF text using Zotero's built-in PDF extraction
          Zotero.debug(`Summary Creator: Calling Zotero.Fulltext.getItemContent(${attachmentID})`);
          let pdfText;
          try {
            pdfText = await Zotero.Fulltext.getItemContent(attachmentID);
          } catch (contentError) {
            Zotero.debug(`Summary Creator: ERROR getting item content: ${contentError.message}`, 2);
            Zotero.debug(`Summary Creator: Content error stack: ${contentError.stack}`, 2);
            throw contentError;
          }

          if (pdfText && pdfText.content && pdfText.content.trim()) {
            const content = pdfText.content.trim();
            Zotero.debug(`Summary Creator: Extracted ${content.length} chars from PDF`);

            if (content.length < 100) {
              Zotero.debug(`Summary Creator: PDF text too short (${content.length} chars), might be scanned/image PDF`, 2);
              continue;
            }

            // Limit to first 10000 characters to avoid overwhelming the LLM
            return content.substring(0, 10000);
          } else {
            Zotero.debug('Summary Creator: PDF content empty or null after indexing attempts', 2);
            Zotero.debug('Summary Creator: This might be a scanned/image PDF with no extractable text', 2);
          }
        } catch (error) {
          Zotero.debug('Summary Creator: Error extracting PDF text: ' + error, 2);
          Zotero.debug('Summary Creator: Error stack: ' + error.stack, 2);
        }
      }
    }

    Zotero.debug('Summary Creator: No usable content found', 2);
    return null;
  },

  formatAsNote(item, summary) {
    const title = item.getField('title');
    const authors = item.getCreators().map(c => {
      return `${c.firstName || ''} ${c.lastName || ''}`.trim();
    }).join(', ');
    const year = item.getField('date').match(/\d{4}/)?.[0] || '';

    let html = '<div>';
    html += `<h1>GENERATED SUMMARY: ${this.escapeHtml(title)}</h1>`;

    if (authors) {
      html += `<p><strong>Authors:</strong> ${this.escapeHtml(authors)}</p>`;
    }
    if (year) {
      html += `<p><strong>Year:</strong> ${this.escapeHtml(year)}</p>`;
    }

    html += '<hr>';
    html += '<h2>Executive Summary</h2>';
    html += `<p>${this.escapeHtml(summary.executiveSummary)}</p>`;

    if (summary.keyContributions && summary.keyContributions.length > 0) {
      html += '<h2>Key Contributions</h2>';
      html += '<ul>';
      summary.keyContributions.forEach(contrib => {
        html += `<li>${this.escapeHtml(contrib)}</li>`;
      });
      html += '</ul>';
    }

    if (summary.limitations && summary.limitations.length > 0) {
      html += '<h2>Limitations</h2>';
      html += '<ul>';
      summary.limitations.forEach(limit => {
        html += `<li>${this.escapeHtml(limit)}</li>`;
      });
      html += '</ul>';
    }

    if (summary.innovationOpportunities && summary.innovationOpportunities.length > 0) {
      html += '<h2>Innovation Opportunities</h2>';
      html += '<ul>';
      summary.innovationOpportunities.forEach(idea => {
        html += `<li>${this.escapeHtml(idea)}</li>`;
      });
      html += '</ul>';
    }

    html += '<hr>';
    html += '<p><em>Generated by Zotero Summary Creator</em></p>';
    html += '</div>';

    return html;
  },

  escapeHtml(text) {
    const div = Zotero.getMainWindow().document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Ollama Server Manager
// Manages the lifecycle of the Ollama server process
class OllamaServerManager {
  constructor() {
    this.serverProcess = null;
    this.isServerRunning = false;
    this.wasStartedByUs = false;
  }

  async startServer(ollamaUrl) {
    if (this.isServerRunning) {
      Zotero.debug('Ollama Server Manager: Server already running');
      return;
    }

    Zotero.debug('Ollama Server Manager: Starting Ollama server...');

    try {
      // First check if server is already running (externally)
      Zotero.debug('Ollama Server Manager: Checking if server is already running...');
      const isAlreadyRunning = await this.checkServerHealth(ollamaUrl, 2, 1000);
      if (isAlreadyRunning) {
        Zotero.debug('Ollama Server Manager: ✓ Server already running externally - will use it');
        this.isServerRunning = true;
        this.wasStartedByUs = false; // Don't kill external servers
        return;
      }

      Zotero.debug('Ollama Server Manager: No running server detected, will start one');

      // Start Ollama server using nsIProcess
      const file = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsIFile);

      // On macOS, ollama is typically in /usr/local/bin or /opt/homebrew/bin
      // Try to find it
      const possiblePaths = [
        '/usr/local/bin/ollama',
        '/opt/homebrew/bin/ollama',
        '/usr/bin/ollama'
      ];

      let ollamaPath = null;
      for (const path of possiblePaths) {
        try {
          file.initWithPath(path);
          if (file.exists()) {
            ollamaPath = path;
            Zotero.debug(`Ollama Server Manager: Found ollama at ${path}`);
            break;
          }
        } catch (e) {
          // Path doesn't exist, try next one
        }
      }

      if (!ollamaPath) {
        throw new Error('Ollama executable not found. Please ensure Ollama is installed and in your PATH.');
      }

      // Use /bin/sh to launch ollama with proper environment
      // This ensures HOME, PATH, and other env vars are set correctly
      const shellFile = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsIFile);
      shellFile.initWithPath('/bin/sh');

      const process = Components.classes["@mozilla.org/process/util;1"]
        .createInstance(Components.interfaces.nsIProcess);
      process.init(shellFile);

      // Use shell to run ollama with proper environment and detach it
      const shellCmd = `nohup ${ollamaPath} serve > /tmp/ollama-zotero.log 2>&1 &`;
      const args = ['-c', shellCmd];

      Zotero.debug(`Ollama Server Manager: Executing via shell: ${shellCmd}`);
      Zotero.debug(`Ollama Server Manager: Current environment HOME: ${Services.env.get('HOME')}`);
      Zotero.debug(`Ollama Server Manager: Current environment PATH: ${Services.env.get('PATH')}`);

      // Run the shell command
      try {
        process.runAsync(args, args.length, {
          observe: (subject, topic, data) => {
            if (topic === 'process-finished') {
              Zotero.debug('Ollama Server Manager: Shell process finished (this is expected - ollama is backgrounded)');
            } else if (topic === 'process-failed') {
              Zotero.debug(`Ollama Server Manager: Shell process failed with code ${data}`, 2);
              this.isServerRunning = false;
            }
          }
        });
        Zotero.debug('Ollama Server Manager: Shell command executed');
      } catch (runError) {
        throw new Error(`Failed to execute ollama: ${runError.message}`);
      }

      // Store null for process since we're using nohup - we'll track it differently
      this.serverProcess = process;
      this.wasStartedByUs = true;

      Zotero.debug('Ollama Server Manager: Waiting for server to become responsive...');
      Zotero.debug(`Ollama Server Manager: Will check ${ollamaUrl}/api/tags for up to 60 seconds`);

      // Wait for server to be ready (up to 60 seconds for initial model loading)
      // Start checking immediately - Ollama may already be warming up
      const isReady = await this.checkServerHealth(ollamaUrl, 120, 500);

      if (!isReady) {
        throw new Error(
          `Ollama server failed to respond within 60 seconds.\n\n` +
          `Troubleshooting:\n` +
          `1. Check the log: cat /tmp/ollama-zotero.log\n` +
          `2. Try running "ollama serve" manually in Terminal\n` +
          `3. Check if port 11434 is already in use: lsof -i :11434\n` +
          `4. Verify model is downloaded: ollama list\n` +
          `5. Disable "Auto-manage server" in preferences and run Ollama manually`
        );
      }

      this.isServerRunning = true;
      Zotero.debug('Ollama Server Manager: Server is ready');

    } catch (error) {
      Zotero.debug(`Ollama Server Manager: Failed to start server: ${error.message}`, 2);
      throw error;
    }
  }

  async checkServerHealth(ollamaUrl, maxAttempts = 120, delayMs = 500) {
    Zotero.debug(`Ollama Server Manager: Checking server health at ${ollamaUrl}`);

    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Simple fetch without timeout - Zotero's Firefox doesn't support AbortController
        const response = await fetch(`${ollamaUrl}/api/tags`, {
          method: 'GET'
        });

        if (response.ok) {
          Zotero.debug(`Ollama Server Manager: Server is healthy (attempt ${i + 1})`);
          return true;
        } else {
          Zotero.debug(`Ollama Server Manager: Server responded with status ${response.status} (attempt ${i + 1})`);
        }
      } catch (error) {
        // Server not ready yet, continue waiting
        if (i % 10 === 0) {
          Zotero.debug(`Ollama Server Manager: Waiting for server... (attempt ${i + 1}/${maxAttempts}) - ${error.name}: ${error.message}`);
        }
      }

      // Only wait if we're going to try again
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    Zotero.debug('Ollama Server Manager: Health check timed out');
    return false;
  }

  async stopServer(ollamaUrl) {
    if (!this.isServerRunning) {
      Zotero.debug('Ollama Server Manager: No server to stop');
      return;
    }

    // Only kill the server if we started it
    if (!this.wasStartedByUs) {
      Zotero.debug('Ollama Server Manager: Server was running externally, not stopping it');
      this.isServerRunning = false;
      return;
    }

    Zotero.debug('Ollama Server Manager: Stopping Ollama server that we started...');

    try {
      // Use pkill to find and kill ollama serve process
      const killFile = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsIFile);
      killFile.initWithPath('/usr/bin/pkill');

      const killProcess = Components.classes["@mozilla.org/process/util;1"]
        .createInstance(Components.interfaces.nsIProcess);
      killProcess.init(killFile);

      // Kill ollama processes
      const args = ['-f', 'ollama serve'];

      Zotero.debug('Ollama Server Manager: Executing pkill -f "ollama serve"');

      killProcess.run(true, args, args.length);
      Zotero.debug('Ollama Server Manager: pkill completed');

      this.isServerRunning = false;
      this.serverProcess = null;
      this.wasStartedByUs = false;

    } catch (error) {
      Zotero.debug(`Ollama Server Manager: Error stopping server: ${error.message}`, 2);
      // Don't throw - we want to continue even if shutdown fails
      this.isServerRunning = false;
      this.wasStartedByUs = false;
    }
  }
}

// Ollama Client Adapter
class OllamaClientAdapter {
  async createSummary(content, ollamaUrl, model = 'qwen3:4b') {
    const prompt = this.buildPrompt(content);

    Zotero.debug(`Ollama Client: Requesting model '${model}' at ${ollamaUrl}/api/generate`);

    const requestBody = {
      model: model,
      prompt: prompt,
      stream: false
    };

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      Zotero.debug(`Ollama Client: Request failed with status ${response.status}`, 1);
      Zotero.debug(`Ollama Client: Error body: ${errorText}`, 1);
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}\nModel requested: ${model}\nError: ${errorText}`);
    }

    const data = await response.json();
    return data.response;
  }

  buildPrompt(content) {
    // Use shared prompt template to avoid duplication
    return buildPromptFromTemplate(content);
  }
}

// Summary Parser Adapter
class SummaryParserAdapter {
  parse(rawSummary) {
    Zotero.debug(`Summary Creator Parser: Parsing ${rawSummary.length} chars`);

    const summary = {
      executiveSummary: '',
      keyContributions: [],
      limitations: [],
      innovationOpportunities: []
    };

    // Try multiple heading formats for executive summary
    let execMatch = rawSummary.match(
      /\*\*Executive Summary\*\*\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
    );
    if (!execMatch) {
      execMatch = rawSummary.match(
        /##?\s*Executive Summary\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
      );
    }
    // Fallback: just take first paragraph if no heading found
    if (!execMatch && rawSummary.trim()) {
      const firstPara = rawSummary.trim().split('\n\n')[0];
      if (firstPara && firstPara.length > 20) {
        summary.executiveSummary = firstPara.trim();
        Zotero.debug('Summary Creator Parser: Used first paragraph as executive summary');
      }
    } else if (execMatch) {
      summary.executiveSummary = execMatch[1].trim();
      Zotero.debug(`Summary Creator Parser: Extracted executive summary (${summary.executiveSummary.length} chars)`);
    }

    // Extract key contributions - try multiple formats
    let contribMatch = rawSummary.match(
      /\*\*Key Contributions\*\*\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
    );
    if (!contribMatch) {
      contribMatch = rawSummary.match(
        /##?\s*Key Contributions\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
      );
    }
    if (!contribMatch) {
      contribMatch = rawSummary.match(
        /\*\*Contributions\*\*\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
      );
    }
    if (contribMatch) {
      summary.keyContributions = this.extractBullets(contribMatch[1]);
      Zotero.debug(`Summary Creator Parser: Extracted ${summary.keyContributions.length} contributions`);
    } else {
      Zotero.debug('Summary Creator Parser: No contributions section found', 2);
    }

    // Extract limitations - try multiple formats
    let limitMatch = rawSummary.match(
      /\*\*Limitations\*\*\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
    );
    if (!limitMatch) {
      limitMatch = rawSummary.match(
        /##?\s*Limitations\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
      );
    }
    if (limitMatch) {
      summary.limitations = this.extractBullets(limitMatch[1]);
      Zotero.debug(`Summary Creator Parser: Extracted ${summary.limitations.length} limitations`);
    } else {
      Zotero.debug('Summary Creator Parser: No limitations section found', 2);
    }

    // Extract innovation opportunities
    let innovMatch = rawSummary.match(
      /\*\*Innovation Opportunities\*\*\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
    );
    if (!innovMatch) {
      innovMatch = rawSummary.match(
        /##?\s*Innovation Opportunities\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
      );
    }
    if (!innovMatch) {
      innovMatch = rawSummary.match(
        /\*\*Future Work\*\*\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
      );
    }
    if (innovMatch) {
      summary.innovationOpportunities = this.extractBullets(innovMatch[1]);
      Zotero.debug(`Summary Creator Parser: Extracted ${summary.innovationOpportunities.length} innovation opportunities`);
    } else {
      Zotero.debug('Summary Creator Parser: No innovation opportunities section found', 2);
    }

    return summary;
  }

  extractBullets(text) {
    const lines = text.split('\n');
    const bullets = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Match various bullet formats: -, *, •, numbered lists
      const match = trimmed.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
      if (match) {
        bullets.push(match[1].trim());
      }
    }

    return bullets;
  }
}

// Initialize on load
Zotero.SummaryCreator.init();
