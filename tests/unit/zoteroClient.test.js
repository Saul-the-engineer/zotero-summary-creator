import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZoteroClient } from '../../src/services/ZoteroClient.js';

describe('ZoteroClient', () => {
  let client;
  const mockApiKey = 'test-api-key';
  const mockUserId = '12345';

  beforeEach(() => {
    client = new ZoteroClient(mockApiKey, mockUserId);
    global.fetch = vi.fn();
  });

  describe('constructor', () => {
    it('should create instance with API key and user ID', () => {
      expect(client).toBeDefined();
      expect(client.apiKey).toBe(mockApiKey);
      expect(client.userId).toBe(mockUserId);
    });

    it('should set correct base URL', () => {
      expect(client.baseUrl).toBe('https://api.zotero.org');
    });

    it('should throw error if API key is missing', () => {
      expect(() => new ZoteroClient()).toThrow('API key is required');
    });

    it('should throw error if user ID is missing', () => {
      expect(() => new ZoteroClient(mockApiKey)).toThrow('User ID is required');
    });
  });

  describe('getItem', () => {
    it('should fetch a single item by key', async () => {
      const mockItem = {
        key: 'ABC123',
        data: { title: 'Test Paper' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItem,
      });

      const result = await client.getItem('ABC123');

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.zotero.org/users/${mockUserId}/items/ABC123`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Zotero-API-Key': mockApiKey,
          }),
        })
      );
      expect(result).toEqual(mockItem);
    });

    it('should throw error if item not found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(client.getItem('INVALID')).rejects.toThrow('Item not found');
    });

    it('should throw error on network failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getItem('ABC123')).rejects.toThrow('Network error');
    });
  });

  describe('getItems', () => {
    it('should fetch multiple items with default options', async () => {
      const mockItems = [
        { key: 'ABC123', data: { title: 'Paper 1' } },
        { key: 'DEF456', data: { title: 'Paper 2' } },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      });

      const result = await client.getItems();

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.zotero.org/users/${mockUserId}/items?limit=25&start=0`,
        expect.any(Object)
      );
      expect(result).toEqual(mockItems);
    });

    it('should respect limit and start options', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await client.getItems({ limit: 10, start: 5 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10&start=5'),
        expect.any(Object)
      );
    });

    it('should filter by item type', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await client.getItems({ itemType: 'journalArticle' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('itemType=journalArticle'),
        expect.any(Object)
      );
    });
  });

  describe('getCollections', () => {
    it('should fetch all collections', async () => {
      const mockCollections = [
        { key: 'COLL001', data: { name: 'Collection 1' } },
        { key: 'COLL002', data: { name: 'Collection 2' } },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCollections,
      });

      const result = await client.getCollections();

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.zotero.org/users/${mockUserId}/collections`,
        expect.any(Object)
      );
      expect(result).toEqual(mockCollections);
    });
  });

  describe('getCollectionItems', () => {
    it('should fetch items from specific collection', async () => {
      const mockItems = [
        { key: 'ABC123', data: { title: 'Paper in Collection' } },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems,
      });

      const result = await client.getCollectionItems('COLL001');

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.zotero.org/users/${mockUserId}/collections/COLL001/items`,
        expect.any(Object)
      );
      expect(result).toEqual(mockItems);
    });
  });

  describe('getPDFContent', () => {
    it('should extract text content from PDF attachment', async () => {
      const mockPDFText = 'This is the PDF content';

      // Mock getting item children (attachments)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            key: 'ATTACH001',
            data: {
              itemType: 'attachment',
              contentType: 'application/pdf',
            },
          },
        ],
      });

      // Mock getting PDF content
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockPDFText,
      });

      const result = await client.getPDFContent('ABC123');

      expect(result).toBe(mockPDFText);
    });

    it('should throw error if no PDF attachment found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await expect(client.getPDFContent('ABC123')).rejects.toThrow('No PDF attachment found');
    });
  });

  describe('searchItems', () => {
    it('should search items by query', async () => {
      const mockResults = [
        { key: 'ABC123', data: { title: 'Matching Paper' } },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
      });

      const result = await client.searchItems('transformer');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=transformer'),
        expect.any(Object)
      );
      expect(result).toEqual(mockResults);
    });

    it('should URL encode search query', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await client.searchItems('attention is all you need');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('attention%20is%20all%20you%20need'),
        expect.any(Object)
      );
    });
  });
});
