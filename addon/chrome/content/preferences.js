// Preferences dialog logic

var SummaryCreatorPreferences = {
  init() {
    // Load current preferences
    const prefs = Services.prefs.getBranch('extensions.summarycreator.');

    document.getElementById('ollama-url').value =
      prefs.getCharPref('ollamaUrl', 'http://localhost:11434');

    document.getElementById('ollama-model').value =
      prefs.getCharPref('ollamaModel', 'llama2');

    document.getElementById('auto-open').checked =
      prefs.getBoolPref('autoOpen', true);

    document.getElementById('auto-manage-server').checked =
      prefs.getBoolPref('autoManageServer', true);
  },

  save() {
    const prefs = Services.prefs.getBranch('extensions.summarycreator.');

    prefs.setCharPref(
      'ollamaUrl',
      document.getElementById('ollama-url').value
    );

    prefs.setCharPref(
      'ollamaModel',
      document.getElementById('ollama-model').value
    );

    prefs.setBoolPref(
      'autoOpen',
      document.getElementById('auto-open').checked
    );

    prefs.setBoolPref(
      'autoManageServer',
      document.getElementById('auto-manage-server').checked
    );

    return true;
  },

  async testConnection() {
    const statusEl = document.getElementById('connection-status');
    const urlEl = document.getElementById('ollama-url');
    const url = urlEl.value || 'http://localhost:11434';

    statusEl.textContent = 'Testing...';
    statusEl.style.color = '#666';

    try {
      const response = await fetch(`${url}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        const modelCount = data.models ? data.models.length : 0;

        statusEl.textContent = `✓ Connected! ${modelCount} model(s) available`;
        statusEl.style.color = 'green';

        // Show available models
        if (modelCount > 0) {
          const models = data.models.map(m => m.name).join(', ');
          Zotero.alert(
            window,
            'Connection Successful',
            `Available models: ${models}`
          );
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      statusEl.textContent = `✗ Connection failed: ${error.message}`;
      statusEl.style.color = 'red';

      Zotero.alert(
        window,
        'Connection Failed',
        `Could not connect to Ollama at ${url}.\n\n` +
        'Make sure Ollama is installed and running.\n' +
        'Visit https://ollama.ai for installation instructions.'
      );
    }
  }
};

// Initialize when window loads
window.addEventListener('load', () => {
  SummaryCreatorPreferences.init();
});
