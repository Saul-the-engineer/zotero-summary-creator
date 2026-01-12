// Mock Ollama API responses

export const mockSummaryResponse = {
  model: 'llama2',
  created_at: '2024-01-10T12:00:00Z',
  response: `**Executive Summary**
This paper introduces the Transformer architecture, a novel neural network design based entirely on attention mechanisms that revolutionizes sequence-to-sequence modeling. The model achieves state-of-the-art results on machine translation tasks while being more parallelizable and requiring significantly less training time than previous recurrent architectures.

**Key Contributions**
- Introduced the Transformer architecture achieving a BLEU score of 28.4 on WMT 2014 English-to-German translation, surpassing previous best results
- Reduced training time to 3.5 days on 8 P100 GPUs compared to weeks required by previous state-of-the-art models
- Achieved 41.8 BLEU score on WMT 2014 English-to-French translation, establishing new benchmark
- Demonstrated that self-attention mechanisms can completely replace recurrence and convolution in sequence modeling

**Limitations**
- Model is constrained to processing sequences with a fixed maximum length
- Computational and memory complexity grows quadratically with sequence length due to self-attention mechanism
- Requires substantial amounts of training data to achieve optimal performance and generalization`,
  done: true,
};

export const mockStreamingResponse = [
  { model: 'llama2', created_at: '2024-01-10T12:00:00Z', response: '**Executive', done: false },
  { model: 'llama2', created_at: '2024-01-10T12:00:01Z', response: ' Summary**\n', done: false },
  { model: 'llama2', created_at: '2024-01-10T12:00:02Z', response: 'This paper introduces', done: false },
  { model: 'llama2', created_at: '2024-01-10T12:00:03Z', response: '...', done: true },
];

export const mockModelList = {
  models: [
    {
      name: 'llama2:latest',
      modified_at: '2024-01-01T00:00:00Z',
      size: 3826793787,
      digest: 'sha256:abc123',
    },
    {
      name: 'mistral:latest',
      modified_at: '2024-01-05T00:00:00Z',
      size: 4109865159,
      digest: 'sha256:def456',
    },
  ],
};

export const mockErrorResponse = {
  error: 'model not found',
};
