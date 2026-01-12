// Mock Ollama API client for testing

import { mockSummaryResponse, mockModelList, mockErrorResponse } from './mockData.js';

export class MockOllamaClient {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.availableModels = ['llama2', 'mistral', 'codellama'];
  }

  async generate(options) {
    const { model, prompt, stream = false } = options;

    if (!this.availableModels.includes(model)) {
      throw new Error(`Model ${model} not found`);
    }

    if (!prompt || prompt.trim() === '') {
      throw new Error('Prompt is required');
    }

    if (stream) {
      // For streaming, we would return an async iterator
      // For simplicity in mocks, return the full response
      return mockSummaryResponse;
    }

    return mockSummaryResponse;
  }

  async listModels() {
    return mockModelList;
  }

  async checkModelExists(modelName) {
    return this.availableModels.includes(modelName);
  }

  async createSummary(paperContent, summaryStyle) {
    if (!paperContent) {
      throw new Error('Paper content is required');
    }

    const prompt = this._buildPrompt(paperContent, summaryStyle);
    return this.generate({ model: 'llama2', prompt });
  }

  _buildPrompt(paperContent, style) {
    const {
      executiveSummaryLength = '2-3 sentences',
      includeContributions = true,
      includeLimitations = true
    } = style || {};

    let prompt = `Please create a structured summary of the following research paper:\n\n${paperContent}\n\n`;
    prompt += `Format your response as follows:\n\n`;
    prompt += `**Executive Summary**\n${executiveSummaryLength} summarizing the main contribution and findings.\n\n`;

    if (includeContributions) {
      prompt += `**Key Contributions**\nBulleted list with specific metrics and quantifiable results where available.\n\n`;
    }

    if (includeLimitations) {
      prompt += `**Limitations**\nBulleted list of acknowledged limitations or constraints of the work.\n`;
    }

    return prompt;
  }
}
