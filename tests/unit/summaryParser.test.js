import { describe, it, expect } from 'vitest';
import { SummaryParser } from '../../src/models/SummaryParser.js';

describe('SummaryParser', () => {
  let parser;

  beforeEach(() => {
    parser = new SummaryParser();
  });

  describe('parse', () => {
    it('should parse complete summary with all sections', () => {
      const rawSummary = `**Executive Summary**
This paper introduces the Transformer architecture, a novel neural network design based entirely on attention mechanisms.

**Key Contributions**
- Introduced the Transformer architecture achieving a BLEU score of 28.4 on WMT 2014 English-to-German translation
- Reduced training time to 3.5 days on 8 P100 GPUs compared to weeks required by previous models
- Achieved 41.8 BLEU score on WMT 2014 English-to-French translation

**Limitations**
- Model is constrained to processing sequences with a fixed maximum length
- Computational complexity grows quadratically with sequence length
- Requires substantial amounts of training data`;

      const result = parser.parse(rawSummary);

      expect(result.executiveSummary).toContain('Transformer architecture');
      expect(result.keyContributions).toHaveLength(3);
      expect(result.keyContributions[0]).toContain('28.4');
      expect(result.limitations).toHaveLength(3);
      expect(result.limitations[0]).toContain('fixed maximum length');
    });

    it('should handle summary without limitations section', () => {
      const rawSummary = `**Executive Summary**
This is a test summary.

**Key Contributions**
- First contribution
- Second contribution`;

      const result = parser.parse(rawSummary);

      expect(result.executiveSummary).toBe('This is a test summary.');
      expect(result.keyContributions).toHaveLength(2);
      expect(result.limitations).toEqual([]);
    });

    it('should handle summary without contributions section', () => {
      const rawSummary = `**Executive Summary**
This is a test summary.

**Limitations**
- First limitation`;

      const result = parser.parse(rawSummary);

      expect(result.executiveSummary).toBe('This is a test summary.');
      expect(result.keyContributions).toEqual([]);
      expect(result.limitations).toHaveLength(1);
    });

    it('should handle multi-line executive summary', () => {
      const rawSummary = `**Executive Summary**
This paper introduces a new approach.
It demonstrates significant improvements.
The results are promising.

**Key Contributions**
- Contribution one`;

      const result = parser.parse(rawSummary);

      expect(result.executiveSummary).toContain('new approach');
      expect(result.executiveSummary).toContain('improvements');
      expect(result.executiveSummary).toContain('promising');
    });

    it('should trim whitespace from all sections', () => {
      const rawSummary = `**Executive Summary**
  This has extra spaces.

**Key Contributions**
  - Contribution with spaces
  - Another one

**Limitations**
  - Limitation with spaces  `;

      const result = parser.parse(rawSummary);

      expect(result.executiveSummary).toBe('This has extra spaces.');
      expect(result.keyContributions[0]).toBe('Contribution with spaces');
      expect(result.limitations[0]).toBe('Limitation with spaces');
    });

    it('should handle bullet points with different formats', () => {
      const rawSummary = `**Executive Summary**
Summary text.

**Key Contributions**
- Dash bullet point
* Asterisk bullet point
• Unicode bullet point
  - Indented bullet point

**Limitations**
- Standard limitation`;

      const result = parser.parse(rawSummary);

      expect(result.keyContributions).toHaveLength(4);
      expect(result.keyContributions[1]).toBe('Asterisk bullet point');
      expect(result.keyContributions[2]).toBe('Unicode bullet point');
    });

    it('should throw error if executive summary is missing', () => {
      const rawSummary = `**Key Contributions**
- Some contribution`;

      expect(() => parser.parse(rawSummary)).toThrow('Executive summary not found');
    });

    it('should handle empty input', () => {
      expect(() => parser.parse('')).toThrow('Summary text is required');
    });

    it('should handle null input', () => {
      expect(() => parser.parse(null)).toThrow('Summary text is required');
    });

    it('should preserve metrics and numbers in contributions', () => {
      const rawSummary = `**Executive Summary**
Test summary.

**Key Contributions**
- Achieved 95.5% accuracy on MNIST dataset
- Reduced latency by 3.2x compared to baseline
- Trained on 1.5 million samples in 12 hours`;

      const result = parser.parse(rawSummary);

      expect(result.keyContributions[0]).toContain('95.5%');
      expect(result.keyContributions[1]).toContain('3.2x');
      expect(result.keyContributions[2]).toContain('1.5 million');
    });

    it('should handle alternative heading formats', () => {
      const rawSummary = `## Executive Summary
Test summary.

## Key Contributions
- Contribution

## Limitations
- Limitation`;

      const result = parser.parse(rawSummary);

      expect(result.executiveSummary).toBe('Test summary.');
      expect(result.keyContributions).toHaveLength(1);
      expect(result.limitations).toHaveLength(1);
    });
  });

  describe('validate', () => {
    it('should validate correct summary structure', () => {
      const validSummary = {
        executiveSummary: 'This is a valid summary.',
        keyContributions: ['Contribution 1', 'Contribution 2'],
        limitations: ['Limitation 1'],
      };

      expect(() => parser.validate(validSummary)).not.toThrow();
    });

    it('should throw error if executiveSummary is missing', () => {
      const invalidSummary = {
        keyContributions: ['Contribution'],
        limitations: ['Limitation'],
      };

      expect(() => parser.validate(invalidSummary)).toThrow('executiveSummary is required');
    });

    it('should throw error if executiveSummary is empty', () => {
      const invalidSummary = {
        executiveSummary: '',
        keyContributions: ['Contribution'],
        limitations: ['Limitation'],
      };

      expect(() => parser.validate(invalidSummary)).toThrow('executiveSummary cannot be empty');
    });

    it('should throw error if keyContributions is not an array', () => {
      const invalidSummary = {
        executiveSummary: 'Summary',
        keyContributions: 'Not an array',
        limitations: [],
      };

      expect(() => parser.validate(invalidSummary)).toThrow('keyContributions must be an array');
    });

    it('should throw error if limitations is not an array', () => {
      const invalidSummary = {
        executiveSummary: 'Summary',
        keyContributions: [],
        limitations: 'Not an array',
      };

      expect(() => parser.validate(invalidSummary)).toThrow('limitations must be an array');
    });
  });

  describe('formatAsMarkdown', () => {
    it('should format summary as markdown', () => {
      const summary = {
        executiveSummary: 'This is the executive summary.',
        keyContributions: ['First contribution', 'Second contribution'],
        limitations: ['First limitation', 'Second limitation'],
      };

      const markdown = parser.formatAsMarkdown(summary);

      expect(markdown).toContain('## Executive Summary');
      expect(markdown).toContain('This is the executive summary.');
      expect(markdown).toContain('## Key Contributions');
      expect(markdown).toContain('- First contribution');
      expect(markdown).toContain('## Limitations');
      expect(markdown).toContain('- First limitation');
    });

    it('should handle summary without contributions', () => {
      const summary = {
        executiveSummary: 'Summary',
        keyContributions: [],
        limitations: ['Limitation'],
      };

      const markdown = parser.formatAsMarkdown(summary);

      expect(markdown).toContain('## Executive Summary');
      expect(markdown).not.toContain('## Key Contributions');
      expect(markdown).toContain('## Limitations');
    });

    it('should handle summary without limitations', () => {
      const summary = {
        executiveSummary: 'Summary',
        keyContributions: ['Contribution'],
        limitations: [],
      };

      const markdown = parser.formatAsMarkdown(summary);

      expect(markdown).toContain('## Key Contributions');
      expect(markdown).not.toContain('## Limitations');
    });
  });
});
