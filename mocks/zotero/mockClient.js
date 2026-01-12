// Mock Zotero API client for testing

import { mockPaper, mockPaperWithoutAbstract, mockPDFContent, mockCollections, mockItems } from './mockData.js';

export class MockZoteroClient {
  constructor(apiKey = 'mock-api-key', userId = '12345') {
    this.apiKey = apiKey;
    this.userId = userId;
    this.baseUrl = 'https://api.zotero.org';
  }

  async getItem(itemKey) {
    if (itemKey === 'ABC123') {
      return mockPaper;
    }
    if (itemKey === 'XYZ789') {
      return mockPaperWithoutAbstract;
    }
    throw new Error('Item not found');
  }

  async getItems(options = {}) {
    const { limit = 25, start = 0 } = options;
    return mockItems.slice(start, start + limit);
  }

  async getCollections() {
    return mockCollections;
  }

  async getCollectionItems(collectionKey) {
    if (collectionKey === 'COLL001' || collectionKey === 'COLL002') {
      return [mockPaper];
    }
    return [];
  }

  async getPDFContent(itemKey) {
    if (itemKey === 'ABC123' || itemKey === 'XYZ789') {
      return mockPDFContent;
    }
    throw new Error('PDF not found');
  }

  async searchItems(query) {
    return mockItems.filter(item =>
      item.data.title.toLowerCase().includes(query.toLowerCase())
    );
  }
}
