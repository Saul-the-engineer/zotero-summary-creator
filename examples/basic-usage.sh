#!/bin/bash
# Example: Basic usage of Zotero Summary Creator

# This script demonstrates common usage patterns
# Make sure you've set ZOTERO_API_KEY and ZOTERO_USER_ID first!

# Check configuration
echo "=== Checking Configuration ==="
npm run cli -- config
echo ""

# Example 1: Generate summary for a single paper
echo "=== Example 1: Single Paper Summary ==="
echo "Usage: npm run cli -- item ITEMKEY"
echo "Replace ITEMKEY with your actual Zotero item key"
echo ""

# Example 2: Save to file
echo "=== Example 2: Save to File ==="
echo "npm run cli -- item ITEMKEY --output summary.md"
echo ""

# Example 3: Generate JSON output
echo "=== Example 3: JSON Output ==="
echo "npm run cli -- item ITEMKEY --format json --output summary.json"
echo ""

# Example 4: Process a collection
echo "=== Example 4: Collection Summary ==="
echo "npm run cli -- collection COLLECTIONKEY --output collection-summaries.md"
echo ""

# Example 5: Batch processing
echo "=== Example 5: Batch Processing ==="
echo "npm run cli -- batch ITEM1,ITEM2,ITEM3 --output batch.md"
echo ""

# Example 6: Search and summarize
echo "=== Example 6: Search and Summarize ==="
echo "npm run cli -- search 'machine learning' --format markdown"
echo ""

# Example 7: Use different model
echo "=== Example 7: Different Model ==="
echo "npm run cli -- item ITEMKEY --model mistral"
echo ""

echo "To run any example, copy the command and replace ITEMKEY/COLLECTIONKEY with your actual keys"
echo ""
echo "To find item keys:"
echo "  1. Open Zotero"
echo "  2. Right-click a paper → Copy Zotero URI"
echo "  3. Extract the key from: http://zotero.org/users/12345/items/ITEMKEY"
