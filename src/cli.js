#!/usr/bin/env node

import { ZoteroClient } from './services/ZoteroClient.js';
import { OllamaClient } from './services/OllamaClient.js';
import { SummaryGenerator } from './services/SummaryGenerator.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Configuration
const CONFIG_DIR = join(homedir(), '.zotero-summary-creator');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function loadConfig() {
  if (existsSync(CONFIG_FILE)) {
    try {
      const configData = readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('Error reading config file:', error.message);
    }
  }

  // Check environment variables
  const envConfig = {
    zoteroApiKey: process.env.ZOTERO_API_KEY,
    zoteroUserId: process.env.ZOTERO_USER_ID,
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama2',
  };

  if (envConfig.zoteroApiKey && envConfig.zoteroUserId) {
    return envConfig;
  }

  return null;
}

function showHelp() {
  console.log(`
Zotero Summary Creator - Generate AI summaries from Zotero papers

USAGE:
  npm run cli -- <command> [options]

COMMANDS:
  item <itemKey>              Generate summary for a single paper
  collection <collectionKey>  Generate summaries for all papers in a collection
  batch <key1,key2,...>       Generate summaries for multiple papers
  search <query>              Search and summarize papers
  config                      Show current configuration
  help                        Show this help message

OPTIONS:
  --format <json|markdown>    Output format (default: markdown)
  --output <file>             Save to file instead of stdout
  --model <name>              Ollama model to use (default: llama2)

EXAMPLES:
  npm run cli -- item ABC123
  npm run cli -- item ABC123 --format json --output summary.json
  npm run cli -- collection MYCOLL --output summaries.md
  npm run cli -- search "machine learning" --format markdown
  npm run cli -- batch ABC123,DEF456,GHI789

CONFIGURATION:
  Set via environment variables:
    export ZOTERO_API_KEY="your-api-key"
    export ZOTERO_USER_ID="your-user-id"
    export OLLAMA_URL="http://localhost:11434"  # optional
    export OLLAMA_MODEL="llama2"                # optional

  Or create ~/.zotero-summary-creator/config.json:
    {
      "zoteroApiKey": "your-api-key",
      "zoteroUserId": "your-user-id",
      "ollamaUrl": "http://localhost:11434",
      "ollamaModel": "llama2"
    }

SETUP:
  1. Install and start Ollama: https://ollama.ai
  2. Pull a model: ollama pull llama2
  3. Get Zotero API credentials: https://www.zotero.org/settings/keys
  4. Set environment variables or create config file
`);
}

function showConfig() {
  const config = loadConfig();
  if (!config) {
    console.log('No configuration found.');
    console.log('Please set ZOTERO_API_KEY and ZOTERO_USER_ID environment variables.');
    return;
  }

  console.log('Current Configuration:');
  console.log('  Zotero API Key:', config.zoteroApiKey ? '***' + config.zoteroApiKey.slice(-4) : 'Not set');
  console.log('  Zotero User ID:', config.zoteroUserId || 'Not set');
  console.log('  Ollama URL:', config.ollamaUrl);
  console.log('  Ollama Model:', config.ollamaModel);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }

  const command = args[0];

  if (command === 'config') {
    showConfig();
    return;
  }

  const config = loadConfig();
  if (!config || !config.zoteroApiKey || !config.zoteroUserId) {
    console.error('Error: Zotero API credentials not configured.');
    console.error('Please set ZOTERO_API_KEY and ZOTERO_USER_ID environment variables.');
    console.error('Run "npm run cli -- help" for more information.');
    process.exit(1);
  }

  // Parse options
  const options = {
    format: 'markdown',
    output: null,
    model: config.ollamaModel,
  };

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      options.format = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    } else if (args[i] === '--model' && args[i + 1]) {
      options.model = args[i + 1];
      i++;
    }
  }

  // Initialize clients
  const zoteroClient = new ZoteroClient(config.zoteroApiKey, config.zoteroUserId);
  const ollamaClient = new OllamaClient(config.ollamaUrl);
  const generator = new SummaryGenerator(zoteroClient, ollamaClient);

  try {
    let summaries = [];

    switch (command) {
      case 'item': {
        const itemKey = args[1];
        if (!itemKey) {
          console.error('Error: Item key required');
          process.exit(1);
        }
        console.error(`Generating summary for item: ${itemKey}...`);
        const summary = await generator.generateFromItem(itemKey);
        summaries = [summary];
        break;
      }

      case 'collection': {
        const collectionKey = args[1];
        if (!collectionKey) {
          console.error('Error: Collection key required');
          process.exit(1);
        }
        console.error(`Generating summaries for collection: ${collectionKey}...`);
        summaries = await generator.generateFromCollection(collectionKey);
        console.error(`Generated ${summaries.length} summaries`);
        break;
      }

      case 'batch': {
        const keys = args[1];
        if (!keys) {
          console.error('Error: Item keys required (comma-separated)');
          process.exit(1);
        }
        const itemKeys = keys.split(',').map(k => k.trim());
        console.error(`Generating summaries for ${itemKeys.length} items...`);
        summaries = await generator.generateBatch(itemKeys);
        console.error(`Generated ${summaries.length} summaries`);
        break;
      }

      case 'search': {
        const query = args[1];
        if (!query) {
          console.error('Error: Search query required');
          process.exit(1);
        }
        console.error(`Searching for: "${query}"...`);
        const items = await zoteroClient.searchItems(query);
        console.error(`Found ${items.length} items`);
        if (items.length > 0) {
          const itemKeys = items.map(item => item.key);
          summaries = await generator.generateBatch(itemKeys.slice(0, 5)); // Limit to 5
          console.error(`Generated ${summaries.length} summaries`);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "npm run cli -- help" for usage information.');
        process.exit(1);
    }

    // Format output
    let output = '';
    if (options.format === 'json') {
      output = JSON.stringify(summaries, null, 2);
    } else {
      output = summaries.map(s => {
        const formatted = generator.formatOutput(s, 'markdown');
        return formatted + '\n\n---\n\n';
      }).join('');
    }

    // Write output
    if (options.output) {
      writeFileSync(options.output, output, 'utf-8');
      console.error(`Output saved to: ${options.output}`);
    } else {
      console.log(output);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
