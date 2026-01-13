#!/usr/bin/env node

/**
 * Display current Zotero Summary Creator preferences
 * Usage: node scripts/show-preferences.js
 */

console.log(`
╔════════════════════════════════════════════════════════════════╗
║         Zotero Summary Creator - Current Preferences          ║
╚════════════════════════════════════════════════════════════════╝

To view or change preferences:

1. Open Zotero
2. Go to: Edit → Settings → Advanced → Config Editor
3. Search for: extensions.summarycreator

Available preferences:
  • extensions.summarycreator.ollamaUrl          - Ollama server URL
  • extensions.summarycreator.ollamaModel        - Model name (e.g., qwen3:4b)
  • extensions.summarycreator.autoOpen           - Auto-open notes (true/false)
  • extensions.summarycreator.autoManageServer   - Auto-manage server (true/false)

To change a preference:
  1. Double-click the preference name
  2. Enter the new value
  3. Click OK
  4. Restart Zotero

Quick Model Switch:
  1. Search for: extensions.summarycreator.ollamaModel
  2. Double-click it
  3. Change to: qwen3:0.6b (fast) or qwen3:4b (balanced)
  4. Click OK
  5. Restart Zotero

Available models (after running 'ollama list'):
`);

try {
  const { execSync } = require('child_process');
  const output = execSync('ollama list', { encoding: 'utf-8' });
  console.log(output);
} catch (error) {
  console.log('  (Run "ollama list" to see installed models)\n');
}

console.log(`
Need help? Check the README or run:
  node scripts/set-preferences.js
`);
