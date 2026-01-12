import { SummaryParser } from '../models/SummaryParser.js';

export class SummaryGenerator {
  constructor(zoteroClient, ollamaClient) {
    if (!zoteroClient) {
      throw new Error('ZoteroClient is required');
    }
    if (!ollamaClient) {
      throw new Error('OllamaClient is required');
    }

    this.zoteroClient = zoteroClient;
    this.ollamaClient = ollamaClient;
    this.parser = new SummaryParser();
  }

  async generateFromItem(itemKey, summaryStyle = null) {
    // Fetch the item from Zotero
    const item = await this.zoteroClient.getItem(itemKey);

    // Extract content (abstract or PDF)
    const content = await this.extractContent(item);

    // Generate summary using Ollama
    const rawSummary = await this.ollamaClient.createSummary(content.text, summaryStyle);

    // Parse the summary
    const parsedSummary = this.parser.parse(rawSummary.response);

    // Add metadata
    parsedSummary.metadata = {
      itemKey: item.key,
      title: item.data.title,
      sourceType: content.source,
    };

    // Add authors if available
    if (item.data.creators && item.data.creators.length > 0) {
      const authors = item.data.creators
        .map(c => `${c.firstName || ''} ${c.lastName || ''}`.trim())
        .join(', ');
      parsedSummary.metadata.authors = authors;
    }

    // Add year if available
    if (item.data.date) {
      parsedSummary.metadata.year = item.data.date;
    }

    return parsedSummary;
  }

  async generateFromCollection(collectionKey) {
    const items = await this.zoteroClient.getCollectionItems(collectionKey);

    if (items.length === 0) {
      return [];
    }

    const summaries = [];

    for (const item of items) {
      try {
        const summary = await this.generateFromItem(item.key);
        summaries.push(summary);
      } catch (error) {
        // Skip items that fail
        continue;
      }
    }

    return summaries;
  }

  async generateBatch(itemKeys) {
    if (!itemKeys || itemKeys.length === 0) {
      return [];
    }

    // Process in parallel
    const promises = itemKeys.map(key =>
      this.generateFromItem(key).catch(() => null)
    );

    const results = await Promise.all(promises);

    // Filter out null results (failed items)
    return results.filter(result => result !== null);
  }

  async extractContent(item) {
    // Prefer abstract if available
    if (item.data.abstractNote && item.data.abstractNote.trim()) {
      return {
        text: item.data.abstractNote,
        source: 'abstract',
      };
    }

    // Fall back to PDF
    try {
      const pdfContent = await this.zoteroClient.getPDFContent(item.key);
      return {
        text: pdfContent,
        source: 'pdf',
      };
    } catch (error) {
      throw new Error('No content available for this item');
    }
  }

  formatOutput(summary, format = 'json') {
    if (format === 'markdown') {
      let markdown = '';

      // Add metadata header
      if (summary.metadata) {
        markdown += `# ${summary.metadata.title}\n\n`;

        if (summary.metadata.authors) {
          markdown += `**Authors:** ${summary.metadata.authors}\n\n`;
        }

        if (summary.metadata.year) {
          markdown += `**Year:** ${summary.metadata.year}\n\n`;
        }

        markdown += '---\n\n';
      }

      // Add formatted summary
      markdown += this.parser.formatAsMarkdown(summary);

      return markdown;
    }

    // Default to JSON
    return JSON.stringify(summary, null, 2);
  }
}
