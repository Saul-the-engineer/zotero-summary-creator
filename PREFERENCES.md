# Changing Preferences

Since the preferences dialog causes freezing issues, use Zotero's Config Editor instead.

## Quick Guide

### View Current Settings

In Zotero:
- Go to **Tools → Summary Creator: Show Current Settings**

### Change Settings

1. **Open Config Editor**
   - Go to: **Edit → Settings → Advanced → Config Editor**
   - Click **"I accept the risk!"**

2. **Find the setting**
   - Search for: `extensions.summarycreator`
   - You'll see:
     - `extensions.summarycreator.ollamaUrl` - Server URL
     - `extensions.summarycreator.ollamaModel` - Model name
     - `extensions.summarycreator.autoOpen` - Auto-open notes (true/false)
     - `extensions.summarycreator.autoManageServer` - Auto-manage Ollama (true/false)

3. **Change the value**
   - **Double-click** the preference you want to change
   - Enter the new value
   - Click **OK**

4. **Restart Zotero**

## Common Changes

### Switch to Faster Model (qwen3:0.6b)

```
Setting: extensions.summarycreator.ollamaModel
New Value: qwen3:0.6b
```

First make sure you have it:
```bash
ollama pull qwen3:0.6b
```

### Switch to Balanced Model (qwen3:4b) - Default

```
Setting: extensions.summarycreator.ollamaModel
New Value: qwen3:4b
```

### Disable Auto-open Notes

```
Setting: extensions.summarycreator.autoOpen
New Value: false
```

### Disable Auto-manage Server

If you prefer to manage Ollama yourself:

```
Setting: extensions.summarycreator.autoManageServer
New Value: false
```

Then run `ollama serve` in a terminal before generating summaries.

## Available Models

Run `ollama list` to see installed models:

```bash
$ ollama list
NAME            ID              SIZE
qwen3:0.6b      ...             512 MB     # Ultra-fast
qwen3:4b        ...             2.5 GB     # Default, balanced
llama2          ...             4.0 GB     # Alternative
mistral         ...             4.0 GB     # Higher quality
```

## Troubleshooting

### Can't find the setting?

Make sure you're searching for the exact string:
- `extensions.summarycreator.ollamaModel` (not just "model")
- Copy-paste to avoid typos

### Changes not taking effect?

1. Make sure you clicked **OK** after changing the value
2. **Restart Zotero** - this is required for changes to apply
3. Check current settings: **Tools → Summary Creator: Show Current Settings**

### Model not found error?

1. Check what models you have: `ollama list`
2. Make sure the preference exactly matches: `qwen3:4b` (not `qwen3:4B` or `qwen3 4b`)
3. If needed, pull the model: `ollama pull qwen3:4b`
