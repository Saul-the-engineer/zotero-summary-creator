/**
 * Shared prompt template configuration
 * This file can be used by both the plugin and Node.js code
 *
 * Usage (Node.js):
 *   import { buildPromptFromTemplate } from './shared/prompt-template.js';
 *
 * Usage (Plugin):
 *   Services.scriptloader.loadSubScript(rootURI + 'shared/prompt-template.js');
 */

// Export for Node.js (if using ES modules)
const buildPromptFromTemplate = (content, options = {}) => {
  // Handle null or undefined options
  const opts = options || {};

  const {
    executiveSummaryLength = '2-3 sentences',
    includeContributions = true,
    includeLimitations = true,
    includeInnovations = true,
  } = opts;

  let prompt = `Analyze the following research paper and provide a structured summary with specific sections.

PAPER CONTENT:
${content}

REQUIRED FORMAT - You MUST use these exact headings and format:

`;

  prompt += `**Executive Summary**
Write ${executiveSummaryLength} summarizing the main contribution and findings.

`;

  if (includeContributions) {
    prompt += `**Key Contributions**
List the specific contributions as bullets. Include metrics and quantifiable results where available.
- First contribution (with numbers/metrics if available)
- Second contribution (with numbers/metrics if available)
- Continue as needed

`;
  }

  if (includeLimitations) {
    prompt += `**Limitations**
List the acknowledged limitations or constraints:
- First limitation
- Second limitation
- Continue as needed

`;
  }

  if (includeInnovations) {
    prompt += `**Innovation Opportunities**
Based on the paper, suggest 3-5 ways to extend or innovate on this work using these frameworks:
- Xd (Add a dimension): What dimension could be added to extend this work?
- X + Y (Combine): What could this be combined with for novel applications?
- X|^ (Given a hammer, find nails): What new problems could this solution address?
- X|v (Given a nail, find hammers): What alternative solutions could address this problem?
- X++ (Improve): How could this approach be incrementally improved?
- Opposite of X (Invert): What would the opposite approach look like?

`;
  }

  prompt += `IMPORTANT:
- Use the exact heading format shown above (with ** markers)
- Always include ALL sections, even if some are brief
- For contributions and limitations, use bullet points starting with -
- Be specific and include numbers/metrics when available`;

  return prompt;
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  // CommonJS
  module.exports = { buildPromptFromTemplate };
}

if (typeof exports !== 'undefined') {
  // ES modules
  exports.buildPromptFromTemplate = buildPromptFromTemplate;
}

// For browser/plugin context (global scope)
if (typeof globalThis !== 'undefined') {
  globalThis.buildPromptFromTemplate = buildPromptFromTemplate;
}
