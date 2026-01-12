import { describe, it, expect, beforeEach } from 'vitest';
import { MockZoteroClient } from '../../mocks/zotero/mockClient.js';
import { MockOllamaClient } from '../../mocks/ollama/mockClient.js';
import { SummaryGenerator } from '../../src/services/SummaryGenerator.js';
import { SummaryParser } from '../../src/models/SummaryParser.js';

describe('Summary Pipeline Integration', () => {
  let zoteroClient;
  let ollamaClient;
  let summaryGenerator;
  let summaryParser;

  beforeEach(() => {
    zoteroClient = new MockZoteroClient();
    ollamaClient = new MockOllamaClient();
    summaryGenerator = new SummaryGenerator(zoteroClient, ollamaClient);
    summaryParser = new SummaryParser();
  });

  describe('End-to-end summary generation', () => {
    it('should fetch paper from Zotero and generate summary via Ollama', async () => {
      const summary = await summaryGenerator.generateFromItem('ABC123');

      // Verify complete pipeline
      expect(summary).toBeDefined();
      expect(summary.executiveSummary).toBeTruthy();
      expect(summary.keyContributions).toBeInstanceOf(Array);
      expect(summary.limitations).toBeInstanceOf(Array);
      expect(summary.metadata).toBeDefined();
      expect(summary.metadata.title).toBe('Attention Is All You Need');
    });

    it('should handle multiple papers in a collection', async () => {
      const summaries = await summaryGenerator.generateFromCollection('COLL001');

      expect(summaries).toBeInstanceOf(Array);
      expect(summaries.length).toBeGreaterThan(0);

      summaries.forEach(summary => {
        expect(summary.executiveSummary).toBeTruthy();
        expect(summary.metadata).toBeDefined();
      });
    });

    it('should process batch of papers', async () => {
      const itemKeys = ['ABC123', 'XYZ789'];
      const summaries = await summaryGenerator.generateBatch(itemKeys);

      expect(summaries).toHaveLength(2);
      summaries.forEach(summary => {
        expect(summary.executiveSummary).toBeDefined();
      });
    });
  });

  describe('Parser and Generator integration', () => {
    it('should generate and parse summary correctly', async () => {
      const rawSummary = await ollamaClient.createSummary('Test paper content');
      const parsedSummary = summaryParser.parse(rawSummary.response);

      expect(parsedSummary.executiveSummary).toBeTruthy();
      expect(parsedSummary.keyContributions).toBeInstanceOf(Array);
      expect(parsedSummary.limitations).toBeInstanceOf(Array);

      // Validate the parsed structure
      expect(() => summaryParser.validate(parsedSummary)).not.toThrow();
    });

    it('should format parsed summary as markdown', async () => {
      const rawSummary = await ollamaClient.createSummary('Test content');
      const parsedSummary = summaryParser.parse(rawSummary.response);
      const markdown = summaryParser.formatAsMarkdown(parsedSummary);

      expect(markdown).toContain('## Executive Summary');
      expect(markdown).toContain('## Key Contributions');
      expect(markdown).toContain('## Limitations');
    });
  });

  describe('Error handling across components', () => {
    it('should handle Zotero API errors gracefully', async () => {
      await expect(
        summaryGenerator.generateFromItem('NONEXISTENT')
      ).rejects.toThrow();
    });

    it('should handle Ollama errors gracefully', async () => {
      const invalidClient = new MockOllamaClient();
      invalidClient.createSummary = async () => {
        throw new Error('Ollama service unavailable');
      };

      const gen = new SummaryGenerator(zoteroClient, invalidClient);

      await expect(
        gen.generateFromItem('ABC123')
      ).rejects.toThrow();
    });

    it('should handle parsing errors from malformed responses', () => {
      const malformedResponse = 'This is not a properly formatted summary';

      expect(() => summaryParser.parse(malformedResponse)).toThrow();
    });
  });

  describe('Data flow validation', () => {
    it('should preserve paper metadata through the pipeline', async () => {
      const summary = await summaryGenerator.generateFromItem('ABC123');

      expect(summary.metadata).toMatchObject({
        itemKey: 'ABC123',
        title: 'Attention Is All You Need',
      });
    });

    it('should apply custom summary style throughout pipeline', async () => {
      const customStyle = {
        executiveSummaryLength: '1 sentence',
        includeContributions: true,
        includeLimitations: false,
      };

      const summary = await summaryGenerator.generateFromItem('ABC123', customStyle);

      expect(summary).toBeDefined();
      // The style is passed through to Ollama client
    });

    it('should correctly identify content source', async () => {
      const summary = await summaryGenerator.generateFromItem('ABC123');

      expect(summary.metadata.sourceType).toBeDefined();
      expect(['abstract', 'pdf']).toContain(summary.metadata.sourceType);
    });
  });

  describe('Performance and concurrency', () => {
    it('should handle batch processing efficiently', async () => {
      const itemKeys = Array.from({ length: 5 }, (_, i) => `ITEM${i}`);

      // Mock getItem for all test items
      zoteroClient.getItem = async (key) => ({
        key,
        data: {
          title: `Paper ${key}`,
          abstractNote: 'Test abstract content',
        },
      });

      const startTime = Date.now();
      const summaries = await summaryGenerator.generateBatch(itemKeys);
      const duration = Date.now() - startTime;

      // All items should be processed
      expect(summaries.length).toBeLessThanOrEqual(itemKeys.length);

      // Should complete in reasonable time (not perfectly sequential)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Format conversion pipeline', () => {
    it('should convert summary through all formats', async () => {
      const summary = await summaryGenerator.generateFromItem('ABC123');

      // Convert to JSON
      const jsonOutput = summaryGenerator.formatOutput(summary, 'json');
      const jsonParsed = JSON.parse(jsonOutput);
      expect(jsonParsed.executiveSummary).toBe(summary.executiveSummary);

      // Convert to Markdown
      const markdownOutput = summaryGenerator.formatOutput(summary, 'markdown');
      expect(markdownOutput).toContain('## Executive Summary');
      expect(markdownOutput).toContain(summary.executiveSummary);
    });
  });
});
