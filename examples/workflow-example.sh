#!/bin/bash
# Example workflow: Summarize recent papers in a collection

set -e  # Exit on error

# Configuration
COLLECTION_KEY="${1:-YOUR_COLLECTION_KEY}"
OUTPUT_DIR="summaries_$(date +%Y%m%d)"
FORMAT="markdown"

echo "Zotero Summary Creator - Workflow Example"
echo "=========================================="
echo ""
echo "This example demonstrates a complete workflow:"
echo "1. Fetch papers from a collection"
echo "2. Generate summaries for each"
echo "3. Save to organized directory"
echo ""

if [ "$COLLECTION_KEY" = "YOUR_COLLECTION_KEY" ]; then
    echo "Usage: $0 <collection-key>"
    echo ""
    echo "Example: $0 ABC123XYZ"
    echo ""
    echo "To find your collection key:"
    echo "  1. Open Zotero"
    echo "  2. Right-click a collection → Copy Zotero URI"
    echo "  3. Extract key from: http://zotero.org/users/12345/collections/KEY"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Generate summaries for the collection
echo "Generating summaries for collection: $COLLECTION_KEY"
npm run cli -- collection "$COLLECTION_KEY" \
    --format "$FORMAT" \
    --output "$OUTPUT_DIR/collection-summaries.md"

echo ""
echo "✓ Summaries generated successfully!"
echo "✓ Output saved to: $OUTPUT_DIR/collection-summaries.md"
echo ""
echo "Next steps:"
echo "  - Review the summaries: cat $OUTPUT_DIR/collection-summaries.md"
echo "  - Share with colleagues: open $OUTPUT_DIR/"
echo "  - Process individual papers for detailed analysis"
