import { buildPromptFromTemplate } from '../../shared/prompt-template.js';

export class OllamaClient {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generate(options) {
    const { model, prompt, stream = false } = options;

    if (!model) {
      throw new Error('Model is required');
    }

    if (!prompt || prompt.trim() === '') {
      throw new Error('Prompt is required');
    }

    const url = `${this.baseUrl}/api/generate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async listModels() {
    const url = `${this.baseUrl}/api/tags`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async checkModelExists(modelName) {
    const modelList = await this.listModels();

    return modelList.models.some(model =>
      model.name.startsWith(modelName)
    );
  }

  async createSummary(paperContent, summaryStyle = null, model = 'llama2') {
    if (!paperContent || paperContent.trim() === '') {
      throw new Error('Paper content is required');
    }

    const prompt = this.buildPrompt(paperContent, summaryStyle);

    return await this.generate({
      model,
      prompt,
      stream: false,
    });
  }

  buildPrompt(paperContent, style = null) {
    // Use shared prompt template to avoid duplication
    return buildPromptFromTemplate(paperContent, style);
  }
}
