# Contributing to Zotero Summary Creator

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

**Good bug reports include:**
- Clear, descriptive title
- Zotero version
- Plugin version (Tools → Add-ons)
- Ollama model used
- Steps to reproduce the issue
- Expected vs actual behavior
- Debug output (Help → Debug Output Logging → View Output)
- Screenshots if relevant

### Suggesting Features

Feature requests are welcome! Please:
- Check existing issues first
- Describe the feature clearly
- Explain the use case and benefits
- Consider implementation complexity

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch** from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Write or update tests** (especially for TTS features!)
5. **Test thoroughly**
   - Build the plugin: `npm run build`
   - Install in Zotero and test manually
   - Run existing tests: `npm test`
6. **Commit with clear messages**
   ```bash
   git commit -m "Add feature: description"
   ```
7. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Open a Pull Request** with:
   - Clear description of changes
   - Why the change is needed
   - Any breaking changes
   - Screenshots/demo if relevant

## Development Setup

### Prerequisites

- Node.js (v16+)
- Zotero 6 or 7
- Ollama installed and running
- Git

### Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/zotero-summary-creator.git
cd zotero-summary-creator

# Install dependencies
npm install

# Build the plugin
npm run build

# Install in Zotero
# Tools → Add-ons → gear icon → Install Add-on From File
# Select build/zotero-summary-creator.xpi
```

### Testing

```bash
# Run tests
npm test

# Watch mode (re-runs on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Debugging

Enable debug logging in Zotero:
1. **Help → Debug Output Logging → View Output**
2. Click **Enable**
3. Click **Clear Output**
4. Perform the action you're debugging
5. Review output for errors

Look for messages starting with:
- `Summary Creator:` - Summary generation
- `TTS:` - Text-to-Speech
- `Ollama Server Manager:` - Ollama lifecycle

## Code Style

### JavaScript

- Use ES6+ features (arrow functions, const/let, template literals)
- Use descriptive variable names
- Add comments for complex logic
- Use Zotero.debug() for logging (not console.log)

**Example:**
```javascript
async function extractPDFContent(item) {
  Zotero.debug('TTS: Looking for PDF attachment');

  const attachments = item.getAttachments();
  for (const attachmentID of attachments) {
    const attachment = await Zotero.Items.getAsync(attachmentID);

    if (attachment.attachmentContentType === 'application/pdf') {
      // Extract content...
    }
  }
}
```

### Error Handling

Always handle errors gracefully:
```javascript
try {
  await riskyOperation();
} catch (error) {
  Zotero.debug(`Operation failed: ${error.message}`, 1);
  Zotero.alert(win, 'Error Title', 'User-friendly error message');
  return;
}
```

### Testing

Write tests for new features using Vitest:
```javascript
import { describe, it, expect } from 'vitest';

describe('MyNewFeature', () => {
  it('should do something', () => {
    const result = myNewFeature('input');
    expect(result).toBe('expected output');
  });
});
```

## Project Structure

```
addon/
├── bootstrap.js              # Plugin lifecycle & UI
├── manifest.json             # Plugin metadata
├── shared/
│   └── prompt-template.js    # Prompt customization
└── chrome/content/
    ├── summarycreator.js     # Summary generation
    ├── preferences.xhtml      # Settings UI
    ├── preferences.js         # Settings logic
    └── tts/                   # TTS modules
        ├── ContentFilterService.js
        ├── TTSService.js
        └── WebSpeechProvider.js
```

## Areas Needing Contribution

### High Priority

1. **TTS Test Coverage** - The TTS features lack comprehensive tests
   - Test ContentFilterService filters
   - Test playback control logic
   - Test error handling
   - Mock Web Speech API

2. **Windows/Linux Testing** - Currently tested only on macOS
   - Test Ollama auto-management on different platforms
   - Test TTS on different platforms
   - Fix platform-specific issues

3. **Better Error Messages** - Improve user-facing error messages
   - More specific PDF indexing errors
   - Better Ollama connection diagnostics
   - Clearer TTS failure messages

### Medium Priority

4. **TTS Keyboard Shortcuts** - Add keyboard controls
   - Space = play/pause
   - Esc = stop
   - Arrow keys = rewind/forward

5. **TTS Preferences Panel** - Move TTS settings to preferences UI
   - Default speed/volume
   - Preferred voice
   - Filter aggressiveness

6. **Better Progress Indicators** - Real-time feedback during operations
   - Show PDF indexing progress
   - Show Ollama model loading status
   - Better batch processing progress

### Low Priority

7. **Multiple Voice Support** - Allow voice selection in TTS
8. **Export to Audio** - Save TTS to MP3/audio file
9. **Custom Pronunciation Dictionary** - Fix mispronounced technical terms
10. **Cloud TTS Providers** - Support Google/Azure/AWS TTS APIs

## Testing Checklist

Before submitting a PR, test:

- [ ] Plugin builds without errors: `npm run build`
- [ ] Plugin installs in Zotero without errors
- [ ] Existing tests pass: `npm test`
- [ ] Summary generation works (single item)
- [ ] Summary generation works (batch mode)
- [ ] TTS plays summaries
- [ ] TTS plays abstracts
- [ ] TTS plays full papers
- [ ] Ollama auto-management works
- [ ] Preferences save correctly
- [ ] No errors in debug output

## Questions?

- Open an issue for questions
- Check existing issues and PRs
- Review the README for documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
