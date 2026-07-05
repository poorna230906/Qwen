// ─── Flake AI — Proxy Server ───
// Forwards browser API requests to OpenRouter (Qwen models), bypassing CORS.

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// ─── Middleware ───
app.use(express.json({ limit: '1mb' }));
// Disable caching so browsers always load latest files
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

// ─── Proxy endpoint ───
// The browser sends requests here; the server forwards them to the real API.
app.post('/api/chat', async (req, res) => {
  const { apiKey, apiHost, model, messages, maxTokens, temperature } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: { message: 'API key is required.' } });
  }

  // Build the target URL
  let baseUrl = apiHost || 'https://openrouter.ai/api/v1';
  if (!baseUrl.endsWith('/chat/completions')) {
    baseUrl = baseUrl.replace(/\/$/, '') + '/chat/completions';
  }

  console.log(`[Proxy] POST → ${baseUrl}  model=${model}`);

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.origin || req.headers.referer || 'https://flake-ai.onrender.com',
        'X-Title': 'Flake AI',
      },
      body: JSON.stringify({
        model: model || 'qwen/qwen3-235b-a22b',
        messages: messages,
        max_tokens: maxTokens || 512,
        temperature: temperature || 0.7,
        top_p: 0.9,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Proxy] API Error ${response.status}:`, JSON.stringify(data));
      return res.status(response.status).json(data);
    }

    console.log(`[Proxy] ✓ Success — tokens used: ${data.usage?.total_tokens || '?'}`);
    return res.json(data);
  } catch (err) {
    console.error(`[Proxy] Network error:`, err.message);
    return res.status(502).json({
      error: { message: `Proxy failed to reach API: ${err.message}` },
    });
  }
});

// ─── Test which models are accessible ───
app.post('/api/test-models', async (req, res) => {
  const { apiKey, apiHost } = req.body;
  const modelsToTest = [
    'qwen-plus', 'qwen-turbo', 'qwen-max',
    'qwen-plus-latest', 'qwen-turbo-latest', 'qwen-max-latest',
    'qwen2.5-72b-instruct', 'qwen2.5-32b-instruct', 'qwen2.5-14b-instruct', 'qwen2.5-7b-instruct',
    'qwen-long', 'qwen-vl-plus',
  ];

  let baseUrl = apiHost || 'https://openrouter.ai/api/v1';
  if (!baseUrl.endsWith('/chat/completions')) {
    baseUrl = baseUrl.replace(/\/$/, '') + '/chat/completions';
  }

  console.log(`[Test] Testing ${modelsToTest.length} models against ${baseUrl}`);
  const results = [];

  for (const model of modelsToTest) {
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      });
      const data = await response.json();
      const status = response.ok ? '✅' : `❌ ${data.error?.code || response.status}`;
      console.log(`  ${status}  ${model}`);
      results.push({ model, ok: response.ok, status: response.status, error: data.error?.code });
    } catch (err) {
      console.log(`  ❌  ${model} — ${err.message}`);
      results.push({ model, ok: false, status: 0, error: err.message });
    }
  }

  return res.json({ results });
});

// ─── Start ───
app.listen(PORT, () => {
  console.log('');
  console.log('  ❄️  Flake AI Server');
  console.log(`  ➜  Local:   http://localhost:${PORT}/`);
  console.log(`  ➜  Network: http://127.0.0.1:${PORT}/`);
  console.log('');
  console.log('  API requests are proxied via OpenRouter (no CORS issues).');
  console.log('');
});
