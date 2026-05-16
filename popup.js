const keyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');
const toggleBtn = document.getElementById('toggle-key');

const storage = typeof chrome !== 'undefined' && chrome.storage?.local;

// Load saved settings
if (storage) {
  storage.get(['apiKey', 'model'], ({ apiKey, model }) => {
    if (apiKey) keyInput.value = apiKey;
    if (model) modelSelect.value = model;
  });
}

// Toggle key visibility — attached unconditionally
toggleBtn.addEventListener('click', () => {
  const hidden = keyInput.type === 'password';
  keyInput.type = hidden ? 'text' : 'password';
  toggleBtn.textContent = hidden ? 'Hide' : 'Show';
});

// Save — attached unconditionally
saveBtn.addEventListener('click', () => {
  const apiKey = keyInput.value.trim();
  const model = modelSelect.value;

  if (!apiKey) {
    showStatus('Please enter an API key.', true);
    return;
  }

  if (storage) {
    storage.set({ apiKey, model }, () => showStatus('Saved!'));
  } else {
    showStatus('Saved! (install as extension to persist)');
  }
});

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (isError ? ' err' : '');
  setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'status'; }, 2500);
}
