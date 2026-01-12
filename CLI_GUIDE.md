# CLI Tool Usage Guide

This guide covers using Zotero Summary Creator as a **standalone command-line tool**.

> **Note:** If you want to use this inside the Zotero app, see [ZOTERO_PLUGIN_GUIDE.md](ZOTERO_PLUGIN_GUIDE.md) instead.

---

## Prerequisites

1. Zotero account with papers
2. Ollama installed locally
3. Node.js 18+

---

## Setup

### 1. Install Ollama

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama2
```

### 2. Get Zotero API Credentials

1. Visit https://www.zotero.org/settings/keys
2. Note your **User ID** (shown at top)
3. Click **"Create new private key"**
   - Name: "Summary Creator"
   - Permissions: Read Only + Notes + File access
4. Copy the API key

### 3. Configure

```bash
export ZOTERO_API_KEY="your-key-here"
export ZOTERO_USER_ID="your-user-id"
```

Or create `~/.zotero-summary-creator/config.json`:

```json
{
  "zoteroApiKey": "your-key",
  "zoteroUserId": "your-id",
  "ollamaUrl": "http://localhost:11434",
  "ollamaModel": "llama2"
}
```

---

## Usage

### Check Configuration

```bash
npm run cli -- config
```

### Single Paper

```bash
npm run cli -- item ABC123
npm run cli -- item ABC123 --output summary.md
npm run cli -- item ABC123 --format json --output summary.json
```

### Collection

```bash
npm run cli -- collection COLL123 --output summaries.md
```

### Batch

```bash
npm run cli -- batch ABC123,DEF456,GHI789
```

### Search

```bash
npm run cli -- search "machine learning"
```

### Different Model

```bash
npm run cli -- item ABC123 --model mistral
```

---

## Finding Item Keys

**Zotero Desktop/Web:**
1. Right-click paper → "Copy Zotero URI"
2. URI: `http://zotero.org/users/12345/items/ABC123`
3. Key: `ABC123` (last part)

**Or via API:**
```bash
curl -H "Zotero-API-Key: YOUR_KEY" \
  "https://api.zotero.org/users/YOUR_ID/items?limit=10"
```

---

## Full Command Reference

See the original CLI sections in [README.md](README.md) for complete details.

---

## Differences from Plugin

| Feature | CLI | Plugin |
|---------|-----|--------|
| Installation | None (standalone) | Installs in Zotero |
| API Keys | Required | Not needed |
| Output | Files (MD/JSON) | Zotero notes |
| Batch Processing | Excellent | Basic |
| Integration | None | Native Zotero |

---

Use the plugin if you work primarily in Zotero. Use the CLI for automation and batch exports.
