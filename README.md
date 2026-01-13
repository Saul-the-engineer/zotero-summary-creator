# Zotero Summary Creator

> Generate AI-powered academic paper summaries with Text-to-Speech playback using local LLM (Ollama)

**Features:**
- 🤖 Generate structured summaries with executive summary, contributions, limitations, and innovation opportunities
- 🔊 Text-to-Speech (TTS) playback for summaries, abstracts, and full papers
- 🏠 100% local processing - no cloud services, no tracking
- ⚡ Automatic Ollama server management (starts/stops as needed)
- 📚 Batch processing for multiple papers
- 🎨 Customizable prompts and models

---

## Quick Start

### 1. Install Prerequisites

**Install Ollama:**
```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Or download from https://ollama.ai

# Pull a model (choose based on your available VRAM)
ollama pull qwen3:0.6b   # Fastest, ~512MB VRAM (recommended for laptops)
ollama pull qwen3:4b     # Good quality, ~2.5GB VRAM (default)
ollama pull llama2       # Alternative, ~4GB VRAM
```

**Requirements:**
- macOS (recommended), Linux, or Windows
- Zotero 6 or 7
- Node.js (for building the plugin)
- Ollama with sufficient VRAM for your chosen model

### 2. Build & Install Plugin

```bash
# Clone the repository
git clone https://github.com/yourusername/zotero-summary-creator.git
cd zotero-summary-creator

# Install dependencies
npm install

# Build the plugin
npm run build
```

**Install in Zotero:**
1. Open Zotero
2. Go to **Tools → Add-ons** (or ⌘⇧A / Ctrl+Shift+A)
3. Click the **gear icon** (⚙️) → **Install Add-on From File...**
4. Select `build/zotero-summary-creator.xpi`
5. Click **Install Now** and restart Zotero

### 3. Configure

**View Current Settings:**
- Go to **Tools → Summary Creator: Show Current Settings**

**Change Settings** (using Zotero Config Editor):
1. Go to **Edit → Settings → Advanced → Config Editor**
2. Click **"I accept the risk!"**
3. Search for: `extensions.summarycreator.ollamaModel`
4. Double-click it and change to: `qwen3:4b` (default) or `qwen3:0.6b` (faster)
5. Click **OK** and restart Zotero

**Default Settings:**
- **Ollama URL**: `http://localhost:11434`
- **Model Name**: `qwen3:4b` (or `qwen3:0.6b` for faster/lighter)
- **Auto-manage server**: ✅ Enabled (automatically starts/stops Ollama)
- **Auto-open notes**: ✅ Enabled (opens summaries after generation)

> **Note:** The preferences dialog is disabled due to freezing issues. Use the Config Editor instead. See [PREFERENCES.md](PREFERENCES.md) for detailed instructions.

### 4. Use It

**Generate Summary:**
- Right-click any paper → **"Generate Summary"**
- Wait 10-30 seconds (varies by model and paper length)
- Summary appears as a note attached to the paper

**Text-to-Speech:**
- Right-click any paper → **"🔊 Play Summary (TTS)"** - Read the generated summary
- Right-click any paper → **"🔊 Play Abstract (TTS)"** - Read the paper's abstract
- Right-click any paper → **"🔊 Play Full Paper (TTS)"** - Read the full PDF (figures/tables/citations removed)

---

## 🎯 Automatic Ollama Management

The plugin automatically manages Ollama for you when **"Auto-manage server"** is enabled:

**What it does:**
1. ✅ **Checks if Ollama is already running** (uses existing instance if available)
2. ✅ **Starts Ollama only if needed** (won't interfere with your existing processes)
3. ✅ **Waits for server to be ready** (handles model loading time)
4. ✅ **Stops Ollama after generation** (frees up VRAM automatically)
5. ✅ **Never stops externally-started servers** (only stops servers it started)

**Benefits:**
- **No manual Ollama management** - just right-click and generate
- **Automatic VRAM cleanup** - frees resources after each use
- **Works with existing Ollama** - detects and uses already-running instances
- **Safe and reliable** - extensive error handling and logging

**Manual control (if preferred):**
- Disable "Auto-manage server" in preferences
- Run `ollama serve` in a terminal yourself
- Plugin will use your running Ollama instance

**Troubleshooting auto-management:**
- Check debug log: **Help → Debug Output Logging → View Output**
- Look for "Ollama Server Manager" messages
- Common issue: Ollama not in PATH → Install via official installer
- Manual fallback: Disable auto-manage and run `ollama serve` yourself

---

## 🔊 Text-to-Speech Features

**Playback Controls:**
- ▶️ Play / ⏸️ Pause / ⏹️ Stop
- ⏪ Rewind / ⏩ Fast Forward (skip by 5 chunks)
- 🐢 Speed control (0.5x - 2.0x)
- 🔊 Volume control (0% - 100%)
- 📊 Progress bar with percentage

**Content Filtering (Full Paper mode):**
- ✅ Removes figures and figure captions
- ✅ Removes tables and table markers
- ✅ Removes footnotes and citation numbers
- ✅ Removes references section
- ✅ Removes page numbers, URLs, emails
- ✅ Filters low-quality paragraphs (data tables, etc.)
- ✅ Fixes common OCR errors

**Three Reading Modes:**
1. **Play Summary** - Reads your generated summary (skips to "Executive Summary" section)
2. **Play Abstract** - Reads the paper's abstract
3. **Play Full Paper** - Reads the entire PDF body text (filtered for clean listening)

---

## 📝 Summary Format

Each generated summary includes:

```
GENERATED SUMMARY: [Paper Title]

Authors: [Author List]
Year: [Publication Year]

───────────────

Executive Summary
[Comprehensive 2-3 sentence summary covering WHAT, HOW, WHY, RESULTS, and LIMITATIONS]

Key Contributions
• [Specific contribution with metrics]
• [Quantifiable result with numbers]
• [Additional contributions...]

Limitations
• [Acknowledged limitation 1]
• [Constraint or failure mode 2]
• [Additional limitations...]

Innovation Opportunities
• Xd (Add a dimension): [Extend by adding a dimension - e.g., 2D→3D, single→multimodal]
• X + Y (Combine): [Combine with other tech - e.g., method + quantum computing]
• X|^ (Given a hammer, find nails): [Apply to new domains - e.g., vision→audio→proteins]
• X|v (Given a nail, find hammers): [Alternative solutions - e.g., different architectures]
• X++ (Improve): [Incremental improvements - e.g., faster, more accurate, more robust]
• Opposite of X (Invert): [Inverse approach - e.g., supervised→unsupervised, encode→decode]

───────────────
Generated by Zotero Summary Creator
```

---

## 🎨 Customization

### Change the LLM Model

**Using Config Editor:**
1. Go to **Edit → Settings → Advanced → Config Editor**
2. Search for: `extensions.summarycreator.ollamaModel`
3. Double-click it and change to your desired model (e.g., `qwen3:0.6b`, `qwen3:4b`, `llama2`)
4. Click OK and restart Zotero
5. Make sure the model is downloaded: `ollama pull qwen3:0.6b`

See [PREFERENCES.md](PREFERENCES.md) for more details.

**Recommended Models:**
- `qwen3:0.6b` - Fastest, lowest VRAM (~512MB) - ideal for laptops or quick summaries
- `qwen3:4b` - **Default** - Good balance of speed/quality (~2.5GB VRAM)
- `llama2` (7B) - Proven quality, ~4GB VRAM
- `mistral` (7B) - Better quality, slightly slower, ~4GB VRAM
- `llama2:13b` - Higher quality, requires ~8GB VRAM
- `codellama` (7B) - Optimized for technical/code-heavy papers

**Qwen3 Models (Recommended for 2024+):**
The Qwen3 series offers excellent performance with lower VRAM requirements:
- `qwen3:0.6b` - Ultra-fast, runs on any laptop
- `qwen3:4b` - Best balance for most users
- `qwen3:7b` - Higher quality for desktop machines
- `qwen3:14b` - Best quality, requires ~8GB+ VRAM

**Install Additional Models:**
```bash
# List available models
ollama list

# Pull Qwen3 models (recommended)
ollama pull qwen3:0.6b    # Fastest, great for laptops
ollama pull qwen3:4b      # Default, good balance
ollama pull qwen3:7b      # Higher quality
ollama pull qwen3:14b     # Best quality

# Pull other models
ollama pull mistral
ollama pull llama2:13b
ollama pull codellama

# Remove models you don't use
ollama rm llama2:13b
```

### Customize the Summary Prompt

The prompt template is in [shared/prompt-template.js](shared/prompt-template.js).

**To modify:**
1. Edit `shared/prompt-template.js`
2. Modify the `buildPromptFromTemplate()` function
3. Rebuild: `npm run build`
4. Reinstall the `.xpi` file in Zotero

**Prompt sections you can customize:**
- Executive summary length and focus
- Which sections to include (contributions, limitations, innovations)
- Innovation framework patterns (Xd, X+Y, X|^, X|v, X++, Opposite of X)
- LaTeX cleanup rules
- Heading formats

**Example customizations:**
```javascript
// Change executive summary length
executiveSummaryLength = '5-7 sentences',

// Add custom section
prompt += `**Practical Applications**
List 3-5 real-world applications of this research:
- Application 1
- Application 2

`;
```

### Adjust TTS Content Filtering

The content filter is in [addon/chrome/content/tts/ContentFilterService.js](addon/chrome/content/tts/ContentFilterService.js).

**Aggressiveness levels:**
- `low` - Minimal filtering, keeps most content
- `medium` - Balanced filtering (default)
- `high` - Aggressive filtering, removes more content

**To change:**
```javascript
// In bootstrap.js, around line 535
const filterService = new ContentFilterService({
  aggressiveness: 'high'  // Change to 'low', 'medium', or 'high'
});
```

**Customizable filters:**
- Figure/table removal patterns
- Footnote markers
- Quality thresholds (paragraph length, article word presence, etc.)
- OCR error corrections

---

## 🔧 Troubleshooting

### Connection Issues

**Problem: "Connection failed" in preferences**

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve

# Check available models
ollama list

# Pull model if missing
ollama pull llama2
```

### Summary Generation Fails

**Common causes:**
1. **No content available** - Paper needs abstract or PDF
2. **Model not found (404 error)** - Run `ollama pull qwen3:4b` to download the model
3. **Wrong model name** - Check settings: **Tools → Summary Creator: Show Current Settings** → Model Name should match an installed model (see [PREFERENCES.md](PREFERENCES.md) to change)
4. **Ollama crashed** - Check `ollama serve` output
5. **Out of VRAM** - Use smaller model: `ollama pull qwen3:0.6b` and change preference to `qwen3:0.6b`

**Debug steps:**
1. **Help → Debug Output Logging → View Output**
2. Click **Enable** and **Clear Output**
3. Try generating summary
4. Look for error messages starting with "Summary Creator:"

### PDF Content Issues

**Problem: "No content available" for PDFs**

1. Right-click PDF → **"Reindex Item"**
2. Wait 30 seconds for indexing
3. Try again

**Advanced PDF diagnostic:**
```javascript
// Tools → Developer → Run JavaScript
const item = Zotero.getActiveZoteroPane().getSelectedItems()[0];
const att = await Zotero.Items.getAsync(item.getAttachments()[0]);
const state = await Zotero.Fulltext.getIndexedState(item.getAttachments()[0]);
return `Indexed: ${state} (0=no, 1=yes, 2=partial)`;
```

### TTS Not Working

**Problem: No sound when playing TTS**

1. Check system volume and unmute
2. Check if other audio works in your browser
3. Look for errors in debug output
4. Try closing and reopening the TTS window

**Problem: TTS reads figures/citations**

- This only happens in "Play Abstract" mode
- Use "Play Full Paper" for filtered content
- Or adjust filter aggressiveness (see Customization section)

---

## 🚀 Advanced Usage

### Batch Processing

1. **Select multiple papers** (⌘/Ctrl + click)
2. Right-click → **"Generate Summary"**
3. Progress window shows all items with ✓/✗ status
4. Continues on errors (won't stop if one paper fails)

**Batch mode differences:**
- Notes don't auto-open (prevents window spam)
- Errors don't stop processing
- Final summary shows: "Success: X, Failed: Y"

### Export Summaries

Summaries are regular Zotero notes, so you can:
- Export collection to Word/PDF (includes notes)
- Sync via Zotero Sync
- Share via Zotero groups
- Access via Zotero API

### Alternative LLM Services

The plugin works with any OpenAI-compatible API:

**LM Studio:**
```
Ollama URL: http://localhost:1234/v1
```

**LocalAI:**
```
Ollama URL: http://localhost:8080
```

**Custom service:**
Modify `addon/chrome/content/summarycreator.js` to match your API format.

---

## 📊 Project Structure

```
zotero-summary-creator/
├── addon/                      # Zotero plugin source
│   ├── manifest.json           # Plugin metadata
│   ├── bootstrap.js            # Plugin lifecycle, UI integration, TTS
│   ├── shared/
│   │   └── prompt-template.js  # Customizable prompt template
│   └── chrome/content/
│       ├── summarycreator.js   # Summary generation logic
│       ├── preferences.xhtml   # Settings UI
│       ├── preferences.js      # Settings logic
│       └── tts/                # Text-to-Speech modules
│           ├── ContentFilterService.js  # PDF content filtering
│           ├── TTSService.js            # TTS coordination
│           └── WebSpeechProvider.js     # Web Speech API wrapper
├── build/                      # Built .xpi file
├── build.js                    # Build script
└── package.json               # Dependencies and scripts
```

---

## 🔒 Privacy & Security

- ✅ **100% local processing** - All AI runs on your machine
- ✅ **No cloud services** - Paper content never leaves your computer
- ✅ **No tracking** - No analytics, telemetry, or data collection
- ✅ **No internet required** (after model download)
- ✅ **Open source** - Audit the code yourself

**Data flow:**
1. Your Zotero library (local)
2. → PDF text extraction (local, Zotero built-in)
3. → Ollama LLM (local, on your machine)
4. → Generated summary (stored as Zotero note, local)

**Nothing is sent to external servers.**

---

## 🛠️ Development

**Build the plugin:**
```bash
# Install dependencies
npm install

# Build the .xpi file
npm run build
```

**Testing:**

The project includes tests for core services (original summary generation features):
```bash
# Run existing tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

**Note on test coverage:** The original summary generation features (~92% coverage) were built with TDD. The newer TTS features were developed iteratively and don't yet have comprehensive test coverage. Contributions to improve TTS test coverage are welcome!

**Contributing:**
1. Fork the repository
2. Create a feature branch
3. Write tests for new features (especially for TTS!)
4. Submit a pull request

**Code structure:**
- [addon/bootstrap.js](addon/bootstrap.js) - Plugin lifecycle, UI integration, TTS orchestration
- [addon/chrome/content/summarycreator.js](addon/chrome/content/summarycreator.js) - Summary generation logic
- [addon/chrome/content/tts/](addon/chrome/content/tts/) - TTS modules (ContentFilterService, TTSService, WebSpeechProvider)
- [shared/prompt-template.js](shared/prompt-template.js) - Customizable prompt template

---

## 📚 Innovation Framework

The **Innovation Opportunities** section uses six systematic patterns:

1. **Xd (Add a dimension)** - Extend by adding dimensions (2D→3D, single→multimodal)
2. **X + Y (Combine)** - Merge with other technologies
3. **X|^ (Hammer → Nails)** - Apply solution to new problem domains
4. **X|v (Nail → Hammers)** - Explore alternative solutions
5. **X++ (Improve)** - Incremental improvements (faster, more accurate, more robust)
6. **Opposite of X (Invert)** - Explore inverse approaches

This framework helps identify research opportunities systematically.

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

## 🙏 Credits

- Built with [Ollama](https://ollama.ai) for local LLM inference
- Text-to-Speech powered by Web Speech API
- Inspired by the need for efficient academic paper comprehension

---

## 🆘 Support

**Before reporting issues:**
1. ✅ Check Ollama is running: `curl http://localhost:11434/api/tags`
2. ✅ Check model is installed: `ollama list` (should show `qwen3:4b` or your chosen model)
3. ✅ Check plugin installed: **Tools → Add-ons**
4. ✅ Review current settings: **Tools → Summary Creator: Show Current Settings**
5. ✅ Check debug output: **Help → Debug Output Logging → View Output**

**Common fixes:**
- Install model: `ollama pull qwen3:4b`
- Verify model name in preferences matches installed model
- Restart Ollama: `ollama serve`
- Restart Zotero
- Reinstall plugin
- Reindex PDFs (right-click → Reindex Item)

**Report issues:**
Open an issue on GitHub with:
- Zotero version
- Plugin version
- Ollama model used
- Debug output (Help → Debug Output Logging)
- Steps to reproduce

---

**Get Started:** Right-click any paper in Zotero → Generate Summary! 🚀
