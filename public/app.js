// ─── Flake AI — Qwen Chatbot ───
// Powered by Qwen via OpenRouter API

const APP = {
  messages: [],
  isGenerating: false,
  settings: {
    apiKey: localStorage.getItem('flake_api_key') || '',
    apiHost: localStorage.getItem('flake_api_host') || '',
    model: 'qwen/qwen3-235b-a22b',
    temperature: 0.7,
    maxTokens: 512,
  },
};

// ─── DOM Elements ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const messagesContainer = $('#messages');
const messageInput = $('#message-input');
const sendBtn = $('#send-btn');
const settingsPanel = $('#settings-panel');
const settingsToggle = $('#settings-toggle');
const settingsClose = $('#settings-close');
const apiKeyInput = $('#api-key');
const apiHostInput = $('#api-host');
const modelIdInput = $('#model-id');
const temperatureSlider = $('#temperature');
const temperatureValue = $('#temperature-value');
const maxTokensInput = $('#max-tokens');
const statusDot = $('#status-dot');
const statusText = $('#status-text');
const clearBtn = $('#clear-chat');
const newChatBtn = $('#new-chat');
const charCount = $('#char-count');
const errorToast = $('#error-toast');

// ─── Initialize ───
function init() {
  loadSettings();
  setupEventListeners();
  createSnowflakes();
  checkConnection();
  autoResize();
}

function loadSettings() {
  const saved = localStorage.getItem('flake_settings');
  if (saved) {
    const parsed = JSON.parse(saved);
    APP.settings = { ...APP.settings, ...parsed };
  }

  // Migrate deprecated/broken model or Hugging Face models to Qwen DashScope
  if (
    APP.settings.model === 'Flexan/Blake-XTM-Arc' ||
    APP.settings.model === 'Qwen/Qwen2.5-7B-Instruct' ||
    APP.settings.model === 'qwen-plus' ||
    APP.settings.model === 'qwen3.6-plus' ||
    APP.settings.model === 'qwen/qwen3-coder:free' ||
    !APP.settings.model
  ) {
    APP.settings.model = 'qwen/qwen3-235b-a22b';
  }

  apiKeyInput.value = APP.settings.apiKey;
  apiHostInput.value = APP.settings.apiHost || '';
  modelIdInput.value = APP.settings.model;
  temperatureSlider.value = APP.settings.temperature;
  temperatureValue.textContent = APP.settings.temperature;
  maxTokensInput.value = APP.settings.maxTokens;
  updateBrandLabel();
}

function updateBrandLabel() {
  const brandModel = $('.brand-model');
  if (brandModel) {
    brandModel.textContent = APP.settings.model.split('/').pop();
  }
}

function saveSettings() {
  localStorage.setItem('flake_settings', JSON.stringify(APP.settings));
  localStorage.setItem('flake_api_key', APP.settings.apiKey);
  localStorage.setItem('flake_api_host', APP.settings.apiHost || '');
}

// ─── Event Listeners ───
function setupEventListeners() {
  // Send message
  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  messageInput.addEventListener('input', autoResize);

  // Settings panel
  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
    settingsToggle.classList.toggle('active');
  });
  settingsClose.addEventListener('click', () => {
    settingsPanel.classList.remove('open');
    settingsToggle.classList.remove('active');
  });

  // Settings inputs
  apiKeyInput.addEventListener('input', (e) => {
    APP.settings.apiKey = e.target.value.trim();
    saveSettings();
    checkConnection();
  });

  apiHostInput.addEventListener('input', (e) => {
    APP.settings.apiHost = e.target.value.trim();
    saveSettings();
  });

  modelIdInput.addEventListener('input', (e) => {
    APP.settings.model = e.target.value.trim() || 'qwen/qwen3-235b-a22b';
    saveSettings();
    updateBrandLabel();
  });

  temperatureSlider.addEventListener('input', (e) => {
    APP.settings.temperature = parseFloat(e.target.value);
    temperatureValue.textContent = APP.settings.temperature;
    saveSettings();
  });

  maxTokensInput.addEventListener('change', (e) => {
    APP.settings.maxTokens = parseInt(e.target.value) || 512;
    saveSettings();
  });

  // Clear / New chat
  clearBtn.addEventListener('click', clearChat);
  newChatBtn.addEventListener('click', clearChat);

  // Welcome chips
  $$('.welcome-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      messageInput.value = chip.textContent;
      autoResize();
      sendMessage();
    });
  });
}

function autoResize() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
  charCount.textContent = `${messageInput.value.length}`;
}

// ─── Check Connection ───
function checkConnection() {
  if (APP.settings.apiKey) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = 'API key configured';
  } else {
    statusDot.className = 'status-dot';
    statusText.textContent = 'No API key set';
  }
}

// ─── Snowflake Particles ───
function createSnowflakes() {
  const container = $('.snowflakes');
  const flakes = ['❄', '❅', '❆', '✦', '✧'];

  for (let i = 0; i < 20; i++) {
    const flake = document.createElement('span');
    flake.className = 'snowflake-particle';
    flake.textContent = flakes[Math.floor(Math.random() * flakes.length)];
    flake.style.left = Math.random() * 100 + '%';
    flake.style.fontSize = (8 + Math.random() * 10) + 'px';
    flake.style.animationDuration = (15 + Math.random() * 25) + 's';
    flake.style.animationDelay = Math.random() * 20 + 's';
    flake.style.opacity = 0.05 + Math.random() * 0.12;
    container.appendChild(flake);
  }
}

// ─── Send Message ───
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || APP.isGenerating) return;

  if (!APP.settings.apiKey) {
    showError('Please add your Qwen API key in Settings ⚙️');
    settingsPanel.classList.add('open');
    settingsToggle.classList.add('active');
    return;
  }

  // Hide welcome screen
  const welcome = $('.welcome-screen');
  if (welcome) welcome.remove();

  // Add user message
  addMessage('user', text);
  messageInput.value = '';
  autoResize();

  // Generate response
  APP.isGenerating = true;
  sendBtn.disabled = true;
  showTypingIndicator();

  try {
    const response = await callQwenAPI(text);
    removeTypingIndicator();
    addMessage('assistant', response);
  } catch (error) {
    removeTypingIndicator();
    console.error('Flake AI Chat Error:', error);
    const errMsg = getErrorMessage(error);
    showError(errMsg);
    addMessage('assistant', `⚠️ ${errMsg}`);
  } finally {
    APP.isGenerating = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

// ─── Call Qwen API via local proxy ───
async function callQwenAPI(userMessage) {
  APP.messages.push({ role: 'user', content: userMessage });

  const systemMessage = {
    role: 'system',
    content: 'You are Flake AI, a helpful, friendly, and knowledgeable assistant powered by Qwen (via OpenRouter). Respond clearly and concisely.'
  };

  // Include recent conversation context (last 10 messages)
  const recentMessages = APP.messages.slice(-10);
  const apiMessages = [systemMessage, ...recentMessages];

  // Send to our local proxy server — it forwards to DashScope server-side (no CORS)
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: APP.settings.apiKey,
      apiHost: APP.settings.apiHost,
      model: APP.settings.model,
      messages: apiMessages,
      maxTokens: APP.settings.maxTokens,
      temperature: APP.settings.temperature,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('API Error Response:', response.status, errorData);

    if (response.status === 401) {
      const detail = errorData.error?.message || errorData.message || '';
      throw new Error(`AUTH_ERROR: ${detail}`);
    } else if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    } else {
      const errorMsg = errorData.error?.message || errorData.message || `API Error: ${response.status}`;
      throw new Error(errorMsg);
    }
  }

  const data = await response.json();

  let assistantText = '';
  if (data.choices && data.choices[0]?.message?.content) {
    assistantText = data.choices[0].message.content.trim();
  } else {
    assistantText = 'I received a response but couldn\'t parse it. Please try again.';
  }

  // Clean up any prompt remnants
  assistantText = cleanResponse(assistantText);

  APP.messages.push({ role: 'assistant', content: assistantText });
  return assistantText;
}

function cleanResponse(text) {
  // Remove common prompt artifacts
  text = text.replace(/^(Assistant:|Bot:|AI:)\s*/i, '');
  text = text.replace(/<\/?s>/g, '');
  text = text.replace(/\[INST\].*?\[\/INST\]/gs, '');
  text = text.replace(/\[\/INST\]/g, '');
  text = text.replace(/\[INST\]/g, '');
  return text.trim();
}

// ─── Error Messages ───
function getErrorMessage(error) {
  const msg = error.message || error;
  if (msg.startsWith('AUTH_ERROR')) {
    const detail = msg.replace('AUTH_ERROR', '').replace(/^:\s*/, '');
    return `Invalid API Key / Unauthorized: ${detail || 'Please check your Qwen API key and API Host in Settings.'}`;
  } else if (msg === 'RATE_LIMIT') {
    return 'Rate limited. Wait a moment and try again.';
  } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Network/CORS error. Check your internet connection and API Host URL.';
  }
  return msg;
}

// ─── Add Message to UI ───
function addMessage(role, content) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;

  const avatar = role === 'assistant' ? '❄️' : '👤';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  messageEl.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <div class="message-bubble">${formatMarkdown(content)}</div>
      <div class="message-time">${time}</div>
    </div>
  `;

  messagesContainer.appendChild(messageEl);
  scrollToBottom();
}

// ─── Basic Markdown Rendering ───
function formatMarkdown(text) {
  // Escape HTML first
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks (```)
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code (`)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold (**text**)
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic (*text*)
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Unordered lists
  text = text.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists
  text = text.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Line breaks
  text = text.replace(/\n\n/g, '</p><p>');
  text = text.replace(/\n/g, '<br>');

  // Wrap in paragraph
  if (!text.startsWith('<')) {
    text = `<p>${text}</p>`;
  }

  return text;
}

// ─── Typing Indicator ───
function showTypingIndicator() {
  const typingEl = document.createElement('div');
  typingEl.className = 'message assistant';
  typingEl.id = 'typing-indicator';
  typingEl.innerHTML = `
    <div class="message-avatar">❄️</div>
    <div class="message-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  messagesContainer.appendChild(typingEl);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = $('#typing-indicator');
  if (el) el.remove();
}

// ─── Scroll ───
function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// ─── Clear Chat ───
function clearChat() {
  APP.messages = [];
  messagesContainer.innerHTML = `
    <div class="welcome-screen">
      <div class="welcome-icon">❄️</div>
      <h1 class="welcome-title">Flake AI</h1>
      <p class="welcome-subtitle">Powered by Qwen — your personal AI assistant. Ask me anything to get started.</p>
      <div class="welcome-chips">
        <div class="welcome-chip">Explain quantum computing</div>
        <div class="welcome-chip">Write a Python script</div>
        <div class="welcome-chip">Tell me a creative story</div>
        <div class="welcome-chip">Help me debug code</div>
      </div>
    </div>
  `;

  // Re-bind welcome chips
  $$('.welcome-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      messageInput.value = chip.textContent;
      autoResize();
      sendMessage();
    });
  });
}

// ─── Error Toast ───
function showError(message) {
  errorToast.textContent = message;
  errorToast.classList.add('visible');
  setTimeout(() => {
    errorToast.classList.remove('visible');
  }, 5000);
}

// ─── Boot ───
document.addEventListener('DOMContentLoaded', init);
