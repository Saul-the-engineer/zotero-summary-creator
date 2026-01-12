/**
 * ContentFilterService - Filters PDF text for clean TTS reading
 * Removes figures, tables, footnotes, references, and other non-body content
 */

class ContentFilterService {
  constructor(options = {}) {
    this.aggressiveness = options.aggressiveness || 'medium'; // low, medium, high
    Zotero.debug(`TTS ContentFilter: Initialized with aggressiveness: ${this.aggressiveness}`);
  }

  /**
   * Main filtering method - applies all filters
   * @param {string} rawText - Raw PDF text
   * @returns {string} - Filtered, clean text
   */
  filterForTTS(rawText) {
    if (!rawText || rawText.trim() === '') {
      return '';
    }

    Zotero.debug(`TTS ContentFilter: Filtering ${rawText.length} characters`);
    let text = rawText;

    // Apply filtering passes
    text = this.removeReferencesSection(text);
    text = this.removeAcknowledgments(text);
    text = this.removeFiguresAndTables(text);
    text = this.removeFootnotes(text);
    text = this.removePageNumbers(text);
    text = this.removeURLsAndEmails(text);
    text = this.filterParagraphsByQuality(text);
    text = this.normalizeWhitespace(text);
    text = this.fixCommonOCRErrors(text);

    const originalLength = rawText.length;
    const filteredLength = text.length;
    const percentRemoved = Math.round(((originalLength - filteredLength) / originalLength) * 100);

    Zotero.debug(`TTS ContentFilter: Filtered to ${filteredLength} chars (${percentRemoved}% removed)`);

    // Check if filtering was too aggressive
    if (percentRemoved > 70) {
      Zotero.debug('TTS ContentFilter: Warning - Removed >70% of content, may be too aggressive', 2);
    }

    return text;
  }

  /**
   * Remove references/bibliography section
   * Typically appears at end of paper after "References" heading
   */
  removeReferencesSection(text) {
    // Match various reference section headings
    const refPatterns = [
      /\n\s*References\s*\n/i,
      /\n\s*Bibliography\s*\n/i,
      /\n\s*Works\s+Cited\s*\n/i,
      /\n\s*Literature\s+Cited\s*\n/i
    ];

    for (const pattern of refPatterns) {
      const match = text.search(pattern);
      if (match > 0 && match > text.length * 0.5) {
        // Only remove if found in second half of document
        Zotero.debug(`TTS ContentFilter: Found references section at position ${match}`);
        return text.substring(0, match);
      }
    }

    return text;
  }

  /**
   * Remove acknowledgments section
   */
  removeAcknowledgments(text) {
    const ackPattern = /\n\s*Acknowledgments?\s*\n[\s\S]*?(?=\n\s*\n|$)/i;
    return text.replace(ackPattern, '\n');
  }

  /**
   * Remove figure captions and table markers
   */
  removeFiguresAndTables(text) {
    // Figure captions: "Figure 1: Caption text" or "Fig. 1. Caption"
    const figurePatterns = [
      /Figure\s+\d+[:.]\s*[^\n]+/gi,
      /Fig\.\s+\d+[:.]\s*[^\n]+/gi,
      /\(Figure\s+\d+\)/gi,
      /\(Fig\.\s+\d+\)/gi
    ];

    // Table markers: "Table 1: Description" or "Tab. 1."
    const tablePatterns = [
      /Table\s+\d+[:.]\s*[^\n]+/gi,
      /Tab\.\s+\d+[:.]\s*[^\n]+/gi,
      /\(Table\s+\d+\)/gi,
      /\(Tab\.\s+\d+\)/gi
    ];

    let filtered = text;

    for (const pattern of [...figurePatterns, ...tablePatterns]) {
      filtered = filtered.replace(pattern, '');
    }

    return filtered;
  }

  /**
   * Remove footnote markers and content
   */
  removeFootnotes(text) {
    // Remove inline footnote markers: [1], (1), ¹, etc.
    const inlineMarkers = [
      /\[\d+\]/g,           // [1]
      /\(\d+\)/g,           // (1) - but be careful with year citations
      /[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g     // Superscript numbers
    ];

    let filtered = text;

    for (const pattern of inlineMarkers) {
      filtered = filtered.replace(pattern, '');
    }

    return filtered;
  }

  /**
   * Remove isolated page numbers
   */
  removePageNumbers(text) {
    // Match lines that are just a number (page numbers)
    return text.replace(/^\s*\d+\s*$/gm, '');
  }

  /**
   * Remove URLs and email addresses
   */
  removeURLsAndEmails(text) {
    // Remove URLs
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    text = text.replace(/www\.[^\s]+/g, '');

    // Remove email addresses
    text = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, '');

    return text;
  }

  /**
   * Filter paragraphs by quality - remove low-quality text blocks
   */
  filterParagraphsByQuality(text) {
    const paragraphs = text.split(/\n\n+/);
    const filtered = [];

    for (const para of paragraphs) {
      if (this.isParagraphQuality(para)) {
        filtered.push(para);
      }
    }

    return filtered.join('\n\n');
  }

  /**
   * Check if paragraph is quality content worth reading
   * Made more lenient to preserve body paragraphs
   */
  isParagraphQuality(para) {
    const trimmed = para.trim();

    // Too short - but be lenient
    if (trimmed.length < 30) {
      return false;
    }

    // All caps SHORT text (likely a heading or section marker)
    // But allow longer all-caps paragraphs (might be acronym-heavy technical text)
    if (trimmed === trimmed.toUpperCase() && trimmed.length < 50) {
      return false;
    }

    // Too many numbers (likely a table or data) - but be more lenient
    const numberCount = (trimmed.match(/\d/g) || []).length;
    if (numberCount / trimmed.length > 0.5) {  // Changed from 0.3 to 0.5
      return false;
    }

    // Too many citation markers (citation-heavy line)
    const citationCount = (trimmed.match(/\[\d+\]/g) || []).length;
    if (citationCount > 8) {  // Changed from 5 to 8
      return false;
    }

    // Check for common words (indicates prose) - expanded list
    const commonWords = ['the', 'a', 'an', 'this', 'these', 'that', 'those', 'we', 'our', 'is', 'are', 'was', 'were',
                         'in', 'on', 'at', 'by', 'for', 'with', 'from', 'to', 'of', 'and', 'or', 'but',
                         'can', 'will', 'may', 'has', 'have', 'had', 'do', 'does', 'did'];
    const lowerPara = trimmed.toLowerCase();
    const hasCommonWords = commonWords.some(word => lowerPara.includes(` ${word} `));

    // REMOVED strict requirement - now just a bonus if present
    // Don't reject paragraphs just because they lack common words

    // Has text-like structure (contains letters and spaces)
    const hasLetters = /[a-zA-Z]/.test(trimmed);
    const hasSpaces = trimmed.includes(' ');

    if (!hasLetters || !hasSpaces) {
      return false;
    }

    // If we got here, it's probably readable text - accept it!
    return true;
  }

  /**
   * Normalize whitespace - collapse multiple spaces/newlines
   */
  normalizeWhitespace(text) {
    // Replace multiple spaces with single space
    text = text.replace(/ {2,}/g, ' ');

    // Replace more than 2 newlines with just 2
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim each line
    text = text.split('\n').map(line => line.trim()).join('\n');

    return text.trim();
  }

  /**
   * Fix common OCR errors
   */
  fixCommonOCRErrors(text) {
    // Fix common ligature errors
    text = text.replace(/ﬁ/g, 'fi');
    text = text.replace(/ﬂ/g, 'fl');
    text = text.replace(/ﬀ/g, 'ff');
    text = text.replace(/ﬃ/g, 'ffi');
    text = text.replace(/ﬄ/g, 'ffl');

    // Fix hyphenated words across line breaks
    text = text.replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2');

    // Remove orphaned parentheses/brackets
    text = text.replace(/\(\s*\)/g, '');
    text = text.replace(/\[\s*\]/g, '');

    return text;
  }

  /**
   * Get aggressiveness level
   */
  getAggressiveness() {
    return this.aggressiveness;
  }

  /**
   * Set aggressiveness level
   */
  setAggressiveness(level) {
    if (['low', 'medium', 'high'].includes(level)) {
      this.aggressiveness = level;
      Zotero.debug(`TTS ContentFilter: Aggressiveness set to ${level}`);
    } else {
      Zotero.debug(`TTS ContentFilter: Invalid aggressiveness level: ${level}`, 2);
    }
  }
}
