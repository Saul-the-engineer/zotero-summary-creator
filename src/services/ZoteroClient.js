export class ZoteroClient {
  constructor(apiKey, userId) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    this.apiKey = apiKey;
    this.userId = userId;
    this.baseUrl = 'https://api.zotero.org';
  }

  async getItem(itemKey) {
    const url = `${this.baseUrl}/users/${this.userId}/items/${itemKey}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Zotero-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Item not found');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.message === 'Item not found') {
        throw error;
      }
      throw new Error(error.message || 'Network error');
    }
  }

  async getItems(options = {}) {
    const { limit = 25, start = 0, itemType } = options;

    let url = `${this.baseUrl}/users/${this.userId}/items?limit=${limit}&start=${start}`;

    if (itemType) {
      url += `&itemType=${itemType}`;
    }

    const response = await fetch(url, {
      headers: {
        'Zotero-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async getCollections() {
    const url = `${this.baseUrl}/users/${this.userId}/collections`;

    const response = await fetch(url, {
      headers: {
        'Zotero-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async getCollectionItems(collectionKey) {
    const url = `${this.baseUrl}/users/${this.userId}/collections/${collectionKey}/items`;

    const response = await fetch(url, {
      headers: {
        'Zotero-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async getPDFContent(itemKey) {
    // First, get the item's children (attachments)
    const url = `${this.baseUrl}/users/${this.userId}/items/${itemKey}/children`;

    const response = await fetch(url, {
      headers: {
        'Zotero-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const children = await response.json();

    // Find PDF attachment
    const pdfAttachment = children.find(
      child => child.data.itemType === 'attachment' &&
               child.data.contentType === 'application/pdf'
    );

    if (!pdfAttachment) {
      throw new Error('No PDF attachment found');
    }

    // Get PDF content
    const pdfUrl = `${this.baseUrl}/users/${this.userId}/items/${pdfAttachment.key}/file`;

    const pdfResponse = await fetch(pdfUrl, {
      headers: {
        'Zotero-API-Key': this.apiKey,
      },
    });

    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    }

    return await pdfResponse.text();
  }

  async searchItems(query) {
    const encodedQuery = encodeURIComponent(query);
    const url = `${this.baseUrl}/users/${this.userId}/items?q=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        'Zotero-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }
}
