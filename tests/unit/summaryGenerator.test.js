import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SummaryGenerator } from '../../src/services/SummaryGenerator.js';
import { MockZoteroClient } from '../../mocks/zotero/mockClient.js';
import { MockOllamaClient } from '../../mocks/ollama/mockClient.js';

describe('SummaryGenerator', () => {
  let generator;
  let mockZoteroClient;
  let mockOllamaClient;

  beforeEach(() => {
    mockZoteroClient = new MockZoteroClient();
    mockOllamaClient = new MockOllamaClient();
    generator = new SummaryGenerator(mockZoteroClient, mockOllamaClient);
  });

  describe('constructor', () => {
    it('should create instance with clients', () => {
      expect(generator).toBeDefined();
      expect(generator.zoteroClient).toBe(mockZoteroClient);
      expect(generator.ollamaClient).toBe(mockOllamaClient);
    });

    it('should throw error if zotero client is missing', () => {
      expect(() => new SummaryGenerator(null, mockOllamaClient)).toThrow('ZoteroClient is required');
    });

    it('should throw error if ollama client is missing', () => {
      expect(() => new SummaryGenerator(mockZoteroClient, null)).toThrow('OllamaClient is required');
    });
  });

  describe('generateFromItem', () => {
    it('should generate summary from Zotero item with abstract', async () => {
      const result = await generator.generateFromItem('ABC123');

      expect(result).toBeDefined();
      expect(result.executiveSummary).toBeDefined();
      expect(result.keyContributions).toBeDefined();
      expect(result.limitations).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.itemKey).toBe('ABC123');
      expect(result.metadata.title).toBe('Attention Is All You Need');
    });

    it('should use PDF content when abstract is missing', async () => {
      const getPDFContentSpy = vi.spyOn(mockZoteroClient, 'getPDFContent');

      await generator.generateFromItem('XYZ789');

      // Should try to get PDF content as fallback
      expect(getPDFContentSpy).toHaveBeenCalled();
    });

    it('should throw error if item not found', async () => {
      await expect(generator.generateFromItem('INVALID')).rejects.toThrow('Item not found');
    });

    it('should throw error if no content available', async () => {
      vi.spyOn(mockZoteroClient, 'getItem').mockResolvedValue({
        key: 'TEST',
        data: { title: 'No Content Paper' },
      });
      vi.spyOn(mockZoteroClient, 'getPDFContent').mockRejectedValue(new Error('No PDF'));

      await expect(generator.generateFromItem('TEST')).rejects.toThrow('No content available');
    });

    it('should use custom summary style', async () => {
      const customStyle = {
        executiveSummaryLength: '1 sentence',
        includeContributions: false,
        includeLimitations: true,
      };

      const result = await generator.generateFromItem('ABC123', customStyle);

      expect(result).toBeDefined();
    });

    it('should include source type in metadata', async () => {
      const result = await generator.generateFromItem('ABC123');

      expect(result.metadata.sourceType).toBeDefined();
      expect(['abstract', 'pdf']).toContain(result.metadata.sourceType);
    });
  });

  describe('generateFromCollection', () => {
    it('should generate summaries for all items in collection', async () => {
      const results = await generator.generateFromCollection('COLL001');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.executiveSummary).toBeDefined();
        expect(result.metadata).toBeDefined();
      });
    });

    it('should handle empty collection', async () => {
      vi.spyOn(mockZoteroClient, 'getCollectionItems').mockResolvedValue([]);

      const results = await generator.generateFromCollection('EMPTY');

      expect(results).toEqual([]);
    });

    it('should skip items that fail to generate', async () => {
      const generateSpy = vi.spyOn(generator, 'generateFromItem');
      generateSpy
        .mockResolvedValueOnce({ executiveSummary: 'Summary 1', keyContributions: [], limitations: [] })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ executiveSummary: 'Summary 2', keyContributions: [], limitations: [] });

      vi.spyOn(mockZoteroClient, 'getCollectionItems').mockResolvedValue([
        { key: 'ITEM1' },
        { key: 'ITEM2' },
        { key: 'ITEM3' },
      ]);

      const results = await generator.generateFromCollection('COLL001');

      expect(results).toHaveLength(2);
    });
  });

  describe('generateBatch', () => {
    it('should generate summaries for multiple item keys', async () => {
      const itemKeys = ['ABC123', 'XYZ789'];
      const results = await generator.generateBatch(itemKeys);

      expect(results).toHaveLength(2);
      expect(results[0].metadata.itemKey).toBe('ABC123');
      expect(results[1].metadata.itemKey).toBe('XYZ789');
    });

    it('should handle empty array', async () => {
      const results = await generator.generateBatch([]);

      expect(results).toEqual([]);
    });

    it('should process items in parallel', async () => {
      const startTime = Date.now();
      await generator.generateBatch(['ABC123', 'XYZ789']);
      const duration = Date.now() - startTime;

      // Should complete faster than sequential processing
      // This is a simple heuristic test
      expect(duration).toBeLessThan(1000);
    });

    it('should collect errors and continue processing', async () => {
      const generateSpy = vi.spyOn(generator, 'generateFromItem');
      generateSpy
        .mockResolvedValueOnce({ executiveSummary: 'Summary', keyContributions: [], limitations: [] })
        .mockRejectedValueOnce(new Error('Failed'));

      const results = await generator.generateBatch(['ABC123', 'INVALID']);

      expect(results).toHaveLength(1);
    });
  });

  describe('extractContent', () => {
    it('should extract abstract when available', async () => {
      const item = {
        data: {
          abstractNote: 'This is the abstract',
          title: 'Test Paper',
        },
      };

      const content = await generator.extractContent(item);

      expect(content.text).toBe('This is the abstract');
      expect(content.source).toBe('abstract');
    });

    it('should fall back to PDF when abstract is missing', async () => {
      const item = {
        key: 'ABC123',
        data: {
          title: 'Test Paper',
        },
      };

      const content = await generator.extractContent(item);

      expect(content.text).toBeDefined();
      expect(content.source).toBe('pdf');
    });

    it('should prefer abstract over PDF', async () => {
      const item = {
        key: 'ABC123',
        data: {
          abstractNote: 'This is the abstract',
          title: 'Test Paper',
        },
      };

      const content = await generator.extractContent(item);

      expect(content.source).toBe('abstract');
    });

    it('should throw error if no content available', async () => {
      const item = {
        key: 'NODATA',
        data: {
          title: 'No Content',
        },
      };

      vi.spyOn(mockZoteroClient, 'getPDFContent').mockRejectedValue(new Error('No PDF'));

      await expect(generator.extractContent(item)).rejects.toThrow();
    });
  });

  describe('formatOutput', () => {
    it('should format summary as JSON by default', () => {
      const summary = {
        executiveSummary: 'Summary',
        keyContributions: ['Contribution'],
        limitations: ['Limitation'],
        metadata: { itemKey: 'ABC123' },
      };

      const output = generator.formatOutput(summary);

      expect(typeof output).toBe('string');
      const parsed = JSON.parse(output);
      expect(parsed.executiveSummary).toBe('Summary');
    });

    it('should format summary as markdown when specified', () => {
      const summary = {
        executiveSummary: 'Summary',
        keyContributions: ['Contribution'],
        limitations: ['Limitation'],
        metadata: { itemKey: 'ABC123', title: 'Test' },
      };

      const output = generator.formatOutput(summary, 'markdown');

      expect(output).toContain('## Executive Summary');
      expect(output).toContain('Summary');
      expect(output).toContain('## Key Contributions');
      expect(output).toContain('- Contribution');
    });

    it('should include metadata in formatted output', () => {
      const summary = {
        executiveSummary: 'Summary',
        keyContributions: [],
        limitations: [],
        metadata: {
          itemKey: 'ABC123',
          title: 'Test Paper',
          authors: 'Smith et al.',
          year: '2024',
        },
      };

      const output = generator.formatOutput(summary, 'markdown');

      expect(output).toContain('Test Paper');
      expect(output).toContain('Smith et al.');
      expect(output).toContain('2024');
    });
  });
});
