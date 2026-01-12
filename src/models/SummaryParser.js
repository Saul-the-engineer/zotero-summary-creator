export class SummaryParser {
  constructor() {}

  parse(rawSummary) {
    if (!rawSummary || typeof rawSummary !== 'string') {
      throw new Error('Summary text is required');
    }

    const summary = {
      executiveSummary: '',
      keyContributions: [],
      limitations: [],
      innovationOpportunities: [],
    };

    // Extract executive summary
    const execSummaryMatch = rawSummary.match(
      /(?:\*\*Executive Summary\*\*|## Executive Summary)\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|\n-|\n\*|\n•|$)/i
    );

    if (!execSummaryMatch) {
      throw new Error('Executive summary not found');
    }

    summary.executiveSummary = execSummaryMatch[1].trim();

    // Extract key contributions
    const contributionsMatch = rawSummary.match(
      /(?:\*\*Key Contributions\*\*|## Key Contributions)\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
    );

    if (contributionsMatch) {
      summary.keyContributions = this._extractBulletPoints(contributionsMatch[1]);
    }

    // Extract limitations
    const limitationsMatch = rawSummary.match(
      /(?:\*\*Limitations\*\*|## Limitations)\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
    );

    if (limitationsMatch) {
      summary.limitations = this._extractBulletPoints(limitationsMatch[1]);
    }

    // Extract innovation opportunities
    const innovationMatch = rawSummary.match(
      /(?:\*\*Innovation Opportunities\*\*|## Innovation Opportunities)\s*:?\s*\n([\s\S]*?)(?=\n\*\*|##|$)/i
    );

    if (innovationMatch) {
      summary.innovationOpportunities = this._extractBulletPoints(innovationMatch[1]);
    }

    return summary;
  }

  _extractBulletPoints(text) {
    if (!text) return [];

    const lines = text.split('\n');
    const bulletPoints = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Match various bullet point formats: -, *, •
      const bulletMatch = trimmedLine.match(/^[-*•]\s+(.+)$/);

      if (bulletMatch) {
        bulletPoints.push(bulletMatch[1].trim());
      }
    }

    return bulletPoints;
  }

  validate(summary) {
    if (summary.executiveSummary === undefined || summary.executiveSummary === null) {
      throw new Error('executiveSummary is required');
    }

    if (summary.executiveSummary === '') {
      throw new Error('executiveSummary cannot be empty');
    }

    if (!Array.isArray(summary.keyContributions)) {
      throw new Error('keyContributions must be an array');
    }

    if (!Array.isArray(summary.limitations)) {
      throw new Error('limitations must be an array');
    }

    if (summary.innovationOpportunities !== undefined && !Array.isArray(summary.innovationOpportunities)) {
      throw new Error('innovationOpportunities must be an array');
    }
  }

  formatAsMarkdown(summary, paperTitle = null) {
    let markdown = '';

    // Add title if provided
    if (paperTitle) {
      markdown += `# GENERATED SUMMARY: ${paperTitle}\n\n`;
    }

    // Executive Summary
    markdown += '## Executive Summary\n\n';
    markdown += `${summary.executiveSummary}\n\n`;

    // Key Contributions
    if (summary.keyContributions && summary.keyContributions.length > 0) {
      markdown += '## Key Contributions\n\n';
      summary.keyContributions.forEach(contribution => {
        markdown += `- ${contribution}\n`;
      });
      markdown += '\n';
    }

    // Limitations
    if (summary.limitations && summary.limitations.length > 0) {
      markdown += '## Limitations\n\n';
      summary.limitations.forEach(limitation => {
        markdown += `- ${limitation}\n`;
      });
      markdown += '\n';
    }

    // Innovation Opportunities
    if (summary.innovationOpportunities && summary.innovationOpportunities.length > 0) {
      markdown += '## Innovation Opportunities\n\n';
      summary.innovationOpportunities.forEach(idea => {
        markdown += `- ${idea}\n`;
      });
    }

    return markdown.trim();
  }
}
