import { ZoteroClient } from './services/ZoteroClient.js';
import { OllamaClient } from './services/OllamaClient.js';
import { SummaryGenerator } from './services/SummaryGenerator.js';
import { SummaryParser } from './models/SummaryParser.js';

export {
  ZoteroClient,
  OllamaClient,
  SummaryGenerator,
  SummaryParser,
};

// Main application entry point
export async function main() {
  console.log('Zotero Summary Creator - TDD Edition');
  console.log('=====================================\n');

  // Example usage (requires real API keys and Ollama running)
  // const zoteroClient = new ZoteroClient(process.env.ZOTERO_API_KEY, process.env.ZOTERO_USER_ID);
  // const ollamaClient = new OllamaClient('http://localhost:11434');
  // const generator = new SummaryGenerator(zoteroClient, ollamaClient);

  // const summary = await generator.generateFromItem('ITEM_KEY');
  // console.log(generator.formatOutput(summary, 'markdown'));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
