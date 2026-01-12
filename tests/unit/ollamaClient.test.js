import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaClient } from '../../src/services/OllamaClient.js';

describe('OllamaClient', () => {
  let client;
  const mockBaseUrl = 'http://localhost:11434';

  beforeEach(() => {
    client = new OllamaClient(mockBaseUrl);
    global.fetch = vi.fn();
  });

  describe('constructor', () => {
    it('should create instance with base URL', () => {
      expect(client).toBeDefined();
      expect(client.baseUrl).toBe(mockBaseUrl);
    });

    it('should use default URL if not provided', () => {
      const defaultClient = new OllamaClient();
      expect(defaultClient.baseUrl).toBe('http://localhost:11434');
    });
  });

  describe('generate', () => {
    it('should generate response with valid prompt', async () => {
      const mockResponse = {
        model: 'llama2',
        response: 'Generated text',
        done: true,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.generate({
        model: 'llama2',
        prompt: 'Test prompt',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/generate`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('llama2'),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error if prompt is empty', async () => {
      await expect(client.generate({
        model: 'llama2',
        prompt: '',
      })).rejects.toThrow('Prompt is required');
    });

    it('should throw error if model is not specified', async () => {
      await expect(client.generate({
        prompt: 'Test prompt',
      })).rejects.toThrow('Model is required');
    });

    it('should handle streaming mode', async () => {
      const mockStreamResponse = {
        model: 'llama2',
        response: 'Chunk 1',
        done: false,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStreamResponse,
      });

      const result = await client.generate({
        model: 'llama2',
        prompt: 'Test',
        stream: true,
      });

      expect(result.done).toBe(false);
    });

    it('should handle API errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.generate({
        model: 'llama2',
        prompt: 'Test',
      })).rejects.toThrow();
    });
  });

  describe('listModels', () => {
    it('should fetch available models', async () => {
      const mockModels = {
        models: [
          { name: 'llama2:latest', size: 3826793787 },
          { name: 'mistral:latest', size: 4109865159 },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      });

      const result = await client.listModels();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/tags`,
        expect.any(Object)
      );
      expect(result).toEqual(mockModels);
    });
  });

  describe('checkModelExists', () => {
    it('should return true if model exists', async () => {
      const mockModels = {
        models: [
          { name: 'llama2:latest' },
          { name: 'mistral:latest' },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      });

      const result = await client.checkModelExists('llama2');

      expect(result).toBe(true);
    });

    it('should return false if model does not exist', async () => {
      const mockModels = {
        models: [
          { name: 'llama2:latest' },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      });

      const result = await client.checkModelExists('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('createSummary', () => {
    it('should create summary with paper content', async () => {
      const mockResponse = {
        model: 'llama2',
        response: '**Executive Summary**\nTest summary',
        done: true,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const paperContent = 'This is a research paper about transformers.';
      const result = await client.createSummary(paperContent);

      expect(global.fetch).toHaveBeenCalled();
      expect(result.response).toContain('Executive Summary');
    });

    it('should use custom summary style', async () => {
      const mockResponse = {
        model: 'llama2',
        response: 'Summary',
        done: true,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const style = {
        executiveSummaryLength: '1 sentence',
        includeContributions: true,
        includeLimitations: false,
      };

      await client.createSummary('Paper content', style);

      const callArgs = global.fetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.prompt).toContain('1 sentence');
      expect(body.prompt).toContain('Key Contributions');
      expect(body.prompt).not.toContain('Limitations');
    });

    it('should throw error if paper content is empty', async () => {
      await expect(client.createSummary('')).rejects.toThrow('Paper content is required');
    });

    it('should allow specifying model', async () => {
      const mockResponse = {
        model: 'mistral',
        response: 'Summary',
        done: true,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.createSummary('Content', null, 'mistral');

      const callArgs = global.fetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.model).toBe('mistral');
    });
  });

  describe('buildPrompt', () => {
    it('should build prompt with default style', () => {
      const prompt = client.buildPrompt('Paper content');

      expect(prompt).toContain('Paper content');
      expect(prompt).toContain('Executive Summary');
      expect(prompt).toContain('Key Contributions');
      expect(prompt).toContain('Limitations');
    });

    it('should build prompt with custom executive summary length', () => {
      const style = { executiveSummaryLength: '1 sentence' };
      const prompt = client.buildPrompt('Content', style);

      expect(prompt).toContain('1 sentence');
    });

    it('should exclude contributions if specified', () => {
      const style = { includeContributions: false };
      const prompt = client.buildPrompt('Content', style);

      expect(prompt).not.toContain('Key Contributions');
    });

    it('should exclude limitations if specified', () => {
      const style = { includeLimitations: false };
      const prompt = client.buildPrompt('Content', style);

      expect(prompt).not.toContain('Limitations');
    });
  });
});
