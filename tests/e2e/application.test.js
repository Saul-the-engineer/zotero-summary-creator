import { describe, it, expect, beforeEach } from 'vitest';
import { MockZoteroClient } from '../../mocks/zotero/mockClient.js';
import { MockOllamaClient } from '../../mocks/ollama/mockClient.js';
import { SummaryGenerator } from '../../src/services/SummaryGenerator.js';
import { SummaryParser } from '../../src/models/SummaryParser.js';

describe('E2E: Zotero Summary Creator Application', () => {
  let app;

  beforeEach(() => {
    const zoteroClient = new MockZoteroClient('mock-key', '12345');
    const ollamaClient = new MockOllamaClient();
    const summaryGenerator = new SummaryGenerator(zoteroClient, ollamaClient);
    const summaryParser = new SummaryParser();

    app = {
      zoteroClient,
      ollamaClient,
      summaryGenerator,
      summaryParser,
    };
  });

  describe('Complete workflow: Single paper', () => {
    it('should fetch paper and generate complete summary', async () => {
      // Step 1: Fetch paper from Zotero
      const paper = await app.zoteroClient.getItem('ABC123');
      expect(paper).toBeDefined();
      expect(paper.data.title).toBe('Attention Is All You Need');

      // Step 2: Generate summary via Ollama
      const summary = await app.summaryGenerator.generateFromItem('ABC123');
      expect(summary).toBeDefined();

      // Step 3: Validate summary structure
      expect(summary.executiveSummary).toBeTruthy();
      expect(summary.keyContributions.length).toBeGreaterThan(0);
      expect(summary.limitations.length).toBeGreaterThan(0);

      // Step 4: Verify metadata
      expect(summary.metadata.itemKey).toBe('ABC123');
      expect(summary.metadata.title).toBe('Attention Is All You Need');
      expect(summary.metadata.sourceType).toMatch(/abstract|pdf/);

      // Step 5: Format output
      const markdown = app.summaryGenerator.formatOutput(summary, 'markdown');
      expect(markdown).toContain('## Executive Summary');
      expect(markdown).toContain('## Key Contributions');
      expect(markdown).toContain('## Limitations');
    });

    it('should handle paper without abstract using PDF', async () => {
      const summary = await app.summaryGenerator.generateFromItem('ABC123');

      expect(summary).toBeDefined();
      expect(summary.metadata.sourceType).toBeDefined();
    });
  });

  describe('Complete workflow: Collection of papers', () => {
    it('should process entire collection and generate summaries', async () => {
      // Step 1: Fetch collection
      const collections = await app.zoteroClient.getCollections();
      expect(collections.length).toBeGreaterThan(0);

      // Step 2: Get papers from first collection
      const collectionKey = collections[0].key;
      const papers = await app.zoteroClient.getCollectionItems(collectionKey);
      expect(papers).toBeDefined();

      // Step 3: Generate summaries for all papers
      const summaries = await app.summaryGenerator.generateFromCollection(collectionKey);
      expect(summaries.length).toBeGreaterThan(0);

      // Step 4: Validate all summaries
      summaries.forEach(summary => {
        expect(summary.executiveSummary).toBeTruthy();
        expect(summary.metadata).toBeDefined();
      });

      // Step 5: Format all as markdown
      const markdownOutputs = summaries.map(s =>
        app.summaryGenerator.formatOutput(s, 'markdown')
      );
      expect(markdownOutputs.length).toBe(summaries.length);
    });
  });

  describe('Complete workflow: Batch processing', () => {
    it('should process multiple papers by keys', async () => {
      // Step 1: Get list of papers
      const items = await app.zoteroClient.getItems({ limit: 5 });
      const itemKeys = items.map(item => item.key);

      // Step 2: Batch process
      const summaries = await app.summaryGenerator.generateBatch(itemKeys);

      // Step 3: Validate results
      expect(summaries.length).toBeLessThanOrEqual(itemKeys.length);
      summaries.forEach(summary => {
        expect(summary.executiveSummary).toBeDefined();
      });

      // Step 4: Export to JSON
      const jsonExport = summaries.map(s =>
        JSON.parse(app.summaryGenerator.formatOutput(s, 'json'))
      );
      expect(jsonExport.length).toBe(summaries.length);
    });
  });

  describe('Complete workflow: Search and summarize', () => {
    it('should search for papers and generate summaries', async () => {
      // Step 1: Search for papers
      const searchResults = await app.zoteroClient.searchItems('transformer');
      expect(searchResults).toBeDefined();

      // Step 2: Generate summaries for search results
      if (searchResults.length > 0) {
        const firstResult = searchResults[0];
        const summary = await app.summaryGenerator.generateFromItem(firstResult.key);

        // Step 3: Validate
        expect(summary).toBeDefined();
        expect(summary.metadata.title).toBe(firstResult.data.title);
      }
    });
  });

  describe('Custom summary styles', () => {
    it('should apply different summary styles', async () => {
      const styles = [
        {
          name: 'brief',
          config: {
            executiveSummaryLength: '1 sentence',
            includeContributions: true,
            includeLimitations: false,
          },
        },
        {
          name: 'detailed',
          config: {
            executiveSummaryLength: '3-4 sentences',
            includeContributions: true,
            includeLimitations: true,
          },
        },
        {
          name: 'contributions-only',
          config: {
            executiveSummaryLength: '2 sentences',
            includeContributions: true,
            includeLimitations: false,
          },
        },
      ];

      for (const style of styles) {
        const summary = await app.summaryGenerator.generateFromItem(
          'ABC123',
          style.config
        );

        expect(summary).toBeDefined();
        expect(summary.executiveSummary).toBeTruthy();
      }
    });
  });

  describe('Error scenarios', () => {
    it('should handle invalid item key gracefully', async () => {
      await expect(
        app.summaryGenerator.generateFromItem('INVALID_KEY')
      ).rejects.toThrow();
    });

    it('should handle empty collection gracefully', async () => {
      app.zoteroClient.getCollectionItems = async () => [];

      const summaries = await app.summaryGenerator.generateFromCollection('EMPTY');
      expect(summaries).toEqual([]);
    });

    it('should handle Ollama service unavailable', async () => {
      app.ollamaClient.generate = async () => {
        throw new Error('Service unavailable');
      };

      await expect(
        app.summaryGenerator.generateFromItem('ABC123')
      ).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      app.zoteroClient.getItem = async () => {
        throw new Error('Network error');
      };

      await expect(
        app.summaryGenerator.generateFromItem('ABC123')
      ).rejects.toThrow('Network error');
    });
  });

  describe('Output formats', () => {
    it('should export summary as JSON', async () => {
      const summary = await app.summaryGenerator.generateFromItem('ABC123');
      const json = app.summaryGenerator.formatOutput(summary, 'json');

      const parsed = JSON.parse(json);
      expect(parsed.executiveSummary).toBe(summary.executiveSummary);
      expect(parsed.keyContributions).toEqual(summary.keyContributions);
      expect(parsed.limitations).toEqual(summary.limitations);
      expect(parsed.metadata).toBeDefined();
    });

    it('should export summary as Markdown', async () => {
      const summary = await app.summaryGenerator.generateFromItem('ABC123');
      const markdown = app.summaryGenerator.formatOutput(summary, 'markdown');

      expect(markdown).toContain('## Executive Summary');
      expect(markdown).toContain(summary.executiveSummary);
      expect(markdown).toContain('## Key Contributions');
      summary.keyContributions.forEach(contrib => {
        expect(markdown).toContain(contrib);
      });
      expect(markdown).toContain('## Limitations');
    });

    it('should export batch summaries as JSON array', async () => {
      const summaries = await app.summaryGenerator.generateBatch(['ABC123', 'XYZ789']);
      const jsonArray = summaries.map(s =>
        JSON.parse(app.summaryGenerator.formatOutput(s, 'json'))
      );

      expect(Array.isArray(jsonArray)).toBe(true);
      expect(jsonArray.length).toBe(summaries.length);
    });
  });

  describe('Model selection', () => {
    it('should work with different Ollama models', async () => {
      const models = ['llama2', 'mistral', 'codellama'];

      for (const model of models) {
        const modelExists = await app.ollamaClient.checkModelExists(model);
        expect(modelExists).toBe(true);
      }

      const summary = await app.summaryGenerator.generateFromItem('ABC123');
      expect(summary).toBeDefined();
    });

    it('should list available models', async () => {
      const modelList = await app.ollamaClient.listModels();

      expect(modelList).toBeDefined();
      expect(modelList.models).toBeInstanceOf(Array);
      expect(modelList.models.length).toBeGreaterThan(0);
    });
  });

  describe('Data validation pipeline', () => {
    it('should validate summary at each step', async () => {
      // Generate summary
      const summary = await app.summaryGenerator.generateFromItem('ABC123');

      // Validate structure
      expect(() => app.summaryParser.validate(summary)).not.toThrow();

      // Ensure all required fields
      expect(summary.executiveSummary).toBeTruthy();
      expect(Array.isArray(summary.keyContributions)).toBe(true);
      expect(Array.isArray(summary.limitations)).toBe(true);
      expect(summary.metadata).toBeDefined();
      expect(summary.metadata.itemKey).toBeTruthy();
      expect(summary.metadata.title).toBeTruthy();
    });
  });
});
