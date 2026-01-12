/**
 * Centralized error messages and error types for Zotero Summary Creator Plugin
 * Browser-compatible version (no ES6 exports)
 */

const ErrorType = {
  INVALID_ITEM: 'INVALID_ITEM',
  NO_CONTENT: 'NO_CONTENT',
  LINKED_FILES: 'LINKED_FILES',
  PDF_EXTRACTION_FAILED: 'PDF_EXTRACTION_FAILED',
  OLLAMA_FAILED: 'OLLAMA_FAILED',
  EMPTY_SUMMARY: 'EMPTY_SUMMARY',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
};

const ErrorMessages = {
  [ErrorType.INVALID_ITEM]: 'Item must be a regular item (not a note or attachment)',

  [ErrorType.NO_CONTENT]: 'No content available. This item has no abstract and no PDF attachments. Please add a PDF or abstract.',

  [ErrorType.LINKED_FILES]: `No content available. Item has linked PDF files that may not be indexed.

Fix:
1. Zotero → Preferences → Search → Enable "Index linked files"
2. OR right-click PDF → "Store Copy of File"
3. Then right-click PDF → "Reindex Item"
4. Try again

See README.md Advanced Troubleshooting section for batch conversion script.`,

  [ErrorType.PDF_EXTRACTION_FAILED]: `No content available. Item has no abstract and PDF extraction failed. The PDF may be:
• Still downloading
• Not indexed (right-click PDF → Reindex Item)
• A scanned/image PDF with no text
• Corrupted

See Help → Debug Output Logging for details.`,

  [ErrorType.EMPTY_SUMMARY]: 'Generated summary was empty. Check Ollama logs for details.',
};

/**
 * Create a formatted error with a specific type
 * @param {string} errorType - One of ErrorType values
 * @param {string} additionalInfo - Optional additional context
 * @returns {Error}
 */
function createError(errorType, additionalInfo = '') {
  const message = ErrorMessages[errorType];
  if (!message) {
    throw new Error(`Unknown error type: ${errorType}`);
  }

  const fullMessage = additionalInfo ? `${message}\n\n${additionalInfo}` : message;
  const error = new Error(fullMessage);
  error.type = errorType;
  return error;
}

/**
 * Create an Ollama-specific error
 * @param {string} originalMessage - The original error message from Ollama
 * @returns {Error}
 */
function createOllamaError(originalMessage) {
  const error = new Error(`Failed to generate summary: ${originalMessage}`);
  error.type = ErrorType.OLLAMA_FAILED;
  return error;
}

/**
 * Check if error is a specific type
 * @param {Error} error - The error to check
 * @param {string} errorType - The ErrorType to check against
 * @returns {boolean}
 */
function isErrorType(error, errorType) {
  return error && error.type === errorType;
}
