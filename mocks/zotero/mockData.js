// Mock Zotero API responses

export const mockPaper = {
  key: 'ABC123',
  version: 1,
  library: {
    type: 'user',
    id: 12345,
  },
  data: {
    key: 'ABC123',
    version: 1,
    itemType: 'journalArticle',
    title: 'Attention Is All You Need',
    creators: [
      { creatorType: 'author', firstName: 'Ashish', lastName: 'Vaswani' },
      { creatorType: 'author', firstName: 'Noam', lastName: 'Shazeer' },
    ],
    abstractNote: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.',
    publicationTitle: 'Advances in Neural Information Processing Systems',
    date: '2017',
    pages: '5998-6008',
    DOI: '10.48550/arXiv.1706.03762',
    url: 'https://arxiv.org/abs/1706.03762',
  },
};

export const mockPaperWithoutAbstract = {
  key: 'XYZ789',
  version: 1,
  library: {
    type: 'user',
    id: 12345,
  },
  data: {
    key: 'XYZ789',
    version: 1,
    itemType: 'journalArticle',
    title: 'Deep Learning Survey',
    creators: [
      { creatorType: 'author', firstName: 'John', lastName: 'Doe' },
    ],
    publicationTitle: 'Journal of AI',
    date: '2020',
  },
};

export const mockPDFContent = `
Attention Is All You Need

Abstract
The dominant sequence transduction models are based on complex recurrent or
convolutional neural networks that include an encoder and a decoder. The best
performing models also connect the encoder and decoder through an attention
mechanism. We propose a new simple network architecture, the Transformer,
based solely on attention mechanisms, dispensing with recurrence and convolutions
entirely.

1. Introduction
Recurrent neural networks, long short-term memory and gated recurrent neural
networks in particular, have been firmly established as state of the art approaches
in sequence modeling and transduction problems.

2. Model Architecture
The Transformer follows the overall architecture using stacked self-attention and
point-wise, fully connected layers for both the encoder and decoder.

Key Contributions:
- Introduced the Transformer architecture achieving BLEU score of 28.4 on WMT 2014 English-to-German
- Training time reduced to 3.5 days on 8 P100 GPUs vs weeks for previous models
- Model performance: 41.8 BLEU on English-to-French translation

Limitations:
- Limited to text sequences with fixed maximum length
- Computational complexity grows quadratically with sequence length
- Requires large amounts of training data for optimal performance
`;

export const mockCollections = [
  {
    key: 'COLL001',
    version: 1,
    data: {
      key: 'COLL001',
      name: 'Machine Learning Papers',
      parentCollection: false,
    },
  },
  {
    key: 'COLL002',
    version: 1,
    data: {
      key: 'COLL002',
      name: 'NLP Research',
      parentCollection: 'COLL001',
    },
  },
];

export const mockItems = [mockPaper, mockPaperWithoutAbstract];
