#!/usr/bin/env node

/**
 * Simple CLI tool to set Zotero Summary Creator preferences
 * Usage: node scripts/set-preferences.js <setting> <value>
 *
 * Examples:
 *   node scripts/set-preferences.js model qwen3:0.6b
 *   node scripts/set-preferences.js url http://localhost:11434
 *   node scripts/set-preferences.js auto-manage true
 *   node scripts/set-preferences.js auto-open false
 */

import { execSync } from 'child_process';

const setting = process.argv[2];
const value = process.argv[3];

const PREF_BASE = 'extensions.summarycreator';

const settingMap = {
  'model': 'ollamaModel',
  'url': 'ollamaUrl',
  'auto-manage': 'autoManageServer',
  'auto-open': 'autoOpen'
};

function showUsage() {
  console.log(`
Zotero Summary Creator - Preference Editor

Usage: node scripts/set-preferences.js <setting> <value>

Settings:
  model         Model name (e.g., qwen3:0.6b, qwen3:4b, llama2)
  url           Ollama URL (e.g., http://localhost:11434)
  auto-manage   Auto-manage server (true/false)
  auto-open     Auto-open notes (true/false)

Examples:
  node scripts/set-preferences.js model qwen3:0.6b
  node scripts/set-preferences.js model qwen3:4b
  node scripts/set-preferences.js url http://localhost:11434
  node scripts/set-preferences.js auto-manage false
  node scripts/set-preferences.js auto-open true

Current Settings:
  To view current settings, use: node scripts/show-preferences.js
`);
}

if (!setting || !value) {
  showUsage();
  process.exit(1);
}

if (!settingMap[setting]) {
  console.error(`❌ Unknown setting: ${setting}`);
  console.error(`   Valid settings: ${Object.keys(settingMap).join(', ')}`);
  showUsage();
  process.exit(1);
}

const prefName = settingMap[setting];
const prefKey = `${PREF_BASE}.${prefName}`;

console.log(`\n🔧 Setting preference: ${setting}`);
console.log(`   Preference key: ${prefKey}`);
console.log(`   New value: ${value}\n`);

try {
  // Determine if this is a boolean preference
  const isBoolPref = setting === 'auto-manage' || setting === 'auto-open';

  if (isBoolPref) {
    const boolValue = value.toLowerCase() === 'true' || value === '1';
    console.log(`   (interpreted as boolean: ${boolValue})\n`);
  }

  console.log(`⚠️  This script modifies Zotero preferences directly.`);
  console.log(`   Make sure Zotero is CLOSED before running this.\n`);
  console.log(`📝 Instructions to update manually:`);
  console.log(`   1. Open Zotero`);
  console.log(`   2. Go to: Edit → Settings → Advanced → Config Editor`);
  console.log(`   3. Search for: ${prefKey}`);
  console.log(`   4. Double-click and change value to: ${value}`);
  console.log(`   5. Restart Zotero\n`);

  console.log(`✅ Done! Restart Zotero for changes to take effect.\n`);

} catch (error) {
  console.error(`\n❌ Error: ${error.message}\n`);
  process.exit(1);
}
