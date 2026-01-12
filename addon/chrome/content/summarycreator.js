// Main Summary Creator Module
// Integrates our TDD-built services into Zotero

Zotero.SummaryCreator = {
  initialized: false,
  ollamaClient: null,
  summaryParser: null,

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

    // Generate summary using Ollama
    Zotero.debug(`Summary Creator: Calling Ollama at ${ollamaUrl} with model ${ollamaModel}`);

    let rawSummary;
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
    const parsedSummary = this.summaryParser.parse(rawSummary);

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
          // Warn about linked files (common issue)
          if (linkMode === 1) {
            Zotero.debug(`Summary Creator: WARNING - This is a LINKED file, not stored in Zotero. Linked files may not be indexed.`, 2);
            Zotero.debug(`Summary Creator: If extraction fails, enable "Index linked files" in Preferences → Search, or convert to stored file.`, 2);
          }

          // Check if this is a valid, accessible PDF file
          const attachmentPath = attachment.getFilePath();
          if (!attachmentPath) {
            Zotero.debug(`Summary Creator: Attachment ${attachmentID} has no file path (might be linked URL or not downloaded)`, 2);
            continue;
          }

          Zotero.debug(`Summary Creator: PDF path: ${attachmentPath}`);

          // Check if file actually exists on disk
          const file = Zotero.File.pathToFile(attachmentPath);
          if (!file || !file.exists()) {
            Zotero.debug(`Summary Creator: PDF file doesn't exist on disk yet (might still be downloading)`, 2);
            continue;
          }

          const fileSize = file.fileSize;
          Zotero.debug(`Summary Creator: PDF file exists, size: ${fileSize} bytes`);

          // Check if PDF is indexed
          let indexedState = await Zotero.Fulltext.getIndexedState(attachmentID);
          Zotero.debug(`Summary Creator: PDF indexed state: ${indexedState} (0=unindexed, 1=indexed, 2=partial)`);

          // If not fully indexed, trigger indexing and wait
          if (indexedState !== Zotero.Fulltext.INDEX_STATE_INDEXED) {
            Zotero.debug('Summary Creator: PDF not fully indexed, triggering indexing...');

            // Clear any existing partial index
            if (indexedState === 2) { // PARTIAL
              Zotero.debug('Summary Creator: Clearing partial index first');
              await Zotero.Fulltext.clearItemContent(attachmentID);
            }

            // Trigger indexing
            await Zotero.Fulltext.indexItems([attachmentID], { forceReindex: true });

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
          const pdfText = await Zotero.Fulltext.getItemContent(attachmentID);

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

// Ollama Client Adapter
class OllamaClientAdapter {
  async createSummary(content, ollamaUrl, model = 'llama2') {
    const prompt = this.buildPrompt(content);

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
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
