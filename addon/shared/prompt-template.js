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

IMPORTANT FORMATTING RULES:
- Clean up LaTeX artifacts: Convert $\\ell$ to "ℓ" or "l", $1$-step to "1-step", $\\alpha$ to "alpha", etc.
- Use plain text for mathematical symbols where possible (e.g., "≤" instead of "$\\leq$")
- Write clear prose without LaTeX delimiters ($, $$, \\, {}, etc.)
- If a mathematical concept is complex, describe it in words

REQUIRED FORMAT - You MUST use these exact headings and format:

`;

  prompt += `**Executive Summary**
Write a comprehensive, self-contained technical summary (${executiveSummaryLength}) for a reader with a master's degree and 1 year of industry experience. Cover:
1. WHAT: Define the novel contribution - the specific model variant, technique, or approach introduced (e.g., "Sparse Mixture of Experts (MoE) architecture" not just "transformer", or "Constitutional AI (CAI) training method" not just "RLHF"). Expand specialized/novel acronyms but assume familiarity with common ML terms.
2. HOW: Explain the methodology - key implementation details, datasets, architecture choices, or experimental design
3. WHY: State the motivation - what limitation or problem they're addressing and its significance
4. RESULTS: Provide specific quantitative findings with numbers, benchmarks, and comparisons to baselines (e.g., "15% improvement over GPT-3 on MMLU", "reduced training cost by 40%")
5. LIMITATIONS: Note explicitly stated constraints, failure modes, or scope limitations

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
