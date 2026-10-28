/**
 * AI Provider Abstraction Layer
 * Pluggable architecture supporting:
 * - Google Gemini (gemini-1.5-flash / gemini-2.5-flash)
 * - Groq (Free Tier: llama-3.3-70b-versatile, llama-3.1-8b-instant)
 * - OpenRouter (Free tier models)
 * - Custom OpenAI-compatible endpoint (Ollama, LocalAI, custom proxy)
 * - Built-in Deterministic Offline Civil Expert (IS 456 / IS 1200 / TN PWD)
 * 
 * Enforces strict security, timeouts, rate limiting, key redaction, and calculation guardrails.
 */

import { CivilExpertEngine } from './civilExpertEngine.js';

const SYSTEM_GUARDRAIL_PROMPT = `You are the civil engineering AI assistant for DDevUltraHome, a construction estimation and planning app for Tamil Nadu, India.
CRITICAL MANDATORY GUARDRAILS:
1. NEVER invent, fabricate, or hallucinate numerical quantities, rates, or arithmetic.
2. Direct all structural sizing and estimation calculations to the application's built-in calculation engines (Concrete, RCC, Masonry, Finishing, BBS, Water Tank, Septic Tank, BOQ).
3. Base all standards on Indian Standard Codes (IS 456 for RCC, IS 1200 for measurement, IS 2502 for BBS, IS 2470 for septic tanks, IS 1904 for foundations, TNCDBR 2019 for planning) and Tamil Nadu PWD Schedule of Rates 2025-26.
4. Provide practical, concise, and professional explanations in Tamil or English as requested by the user.`;

export class AiProvider {
  async ask(prompt, context = {}) {
    throw new Error('Method ask() must be implemented by subclass');
  }

  async testConnection() {
    return { ok: true, latencyMs: 0, message: 'Provider ready' };
  }
}

/**
 * 1. Built-in Deterministic Offline Civil Expert Engine
 * 100% Free, zero network dependency, deterministic rule-based knowledge base
 */
export class OfflineCivilEngineProvider extends AiProvider {
  async ask(prompt, context = {}) {
    const result = CivilExpertEngine.answer(prompt, context);
    return {
      provider: 'DDevUltraHome Offline Civil Expert (Rule-Based)',
      model: 'Deterministic Knowledge Base (IS 456 / IS 1200 / TN PWD)',
      isAiGenerated: false,
      answer: result.answer,
      topic: result.topic || 'General Civil Engineering',
      references: result.references || ['IS 456:2000', 'TN PWD SOR 2025-26'],
      latencyMs: 1
    };
  }

  async testConnection() {
    return { ok: true, latencyMs: 1, message: 'Deterministic offline engine ready' };
  }
}

/**
 * 2. Google Gemini Provider
 */
export class GeminiProvider extends AiProvider {
  constructor(options = {}) {
    super();
    const envKey = (typeof process !== 'undefined' && process.env) ? process.env.GEMINI_API_KEY : null;
    this.apiKey = options.apiKey || envKey || null;
    this.modelName = options.modelName || 'gemini-1.5-flash';
    this.timeoutMs = options.timeoutMs || 10000;
    this.fallbackEngine = new OfflineCivilEngineProvider();
    this.requestTimestamps = [];
    this.maxRpm = 15;
  }

  isRateLimited() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 60000);
    return this.requestTimestamps.length >= this.maxRpm;
  }

  async testConnection() {
    if (!this.apiKey) {
      return { ok: false, latencyMs: 0, message: 'Gemini API key missing' };
    }
    const start = Date.now();
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Ping test. Reply with "OK".' }] }]
        }),
        signal: AbortSignal.timeout(5000)
      });
      const latency = Date.now() - start;
      return { ok: res.ok, latencyMs: latency, message: res.ok ? 'Gemini API connected successfully' : `HTTP error: ${res.status}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, message: err.message };
    }
  }

  async ask(prompt, context = {}) {
    if (!this.apiKey) {
      const fallbackRes = await this.fallbackEngine.ask(prompt, context);
      return {
        ...fallbackRes,
        notice: 'Gemini API key not configured. Using built-in deterministic civil expert engine.'
      };
    }

    if (this.isRateLimited()) {
      const fallbackRes = await this.fallbackEngine.ask(prompt, context);
      return {
        ...fallbackRes,
        notice: 'Gemini free tier rate limit reached (15 RPM). Returned verified offline answer.'
      };
    }

    const startTime = Date.now();
    try {
      this.requestTimestamps.push(Date.now());
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${SYSTEM_GUARDRAIL_PROMPT}\n\nUser Question: ${prompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 600
        }
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Gemini API HTTP Error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Empty response received from Gemini API');
      }

      return {
        provider: 'Google Gemini',
        model: this.modelName,
        isAiGenerated: true,
        answer: text.trim(),
        latencyMs: Date.now() - startTime,
        references: ['IS 456:2000', 'TN PWD SOR 2025-26', `Google Gemini (${this.modelName})`]
      };
    } catch (err) {
      const fallbackRes = await this.fallbackEngine.ask(prompt, context);
      return {
        ...fallbackRes,
        notice: `Gemini service unavailable (${err.message}). Safely transitioned to deterministic offline expert engine.`
      };
    }
  }
}

/**
 * 3. Groq Provider (Fast Llama 3 models with free tier)
 */
export class GroqProvider extends AiProvider {
  constructor(options = {}) {
    super();
    const envKey = (typeof process !== 'undefined' && process.env) ? process.env.GROQ_API_KEY : null;
    this.apiKey = options.apiKey || envKey || null;
    this.modelName = options.modelName || 'llama-3.3-70b-versatile';
    this.timeoutMs = options.timeoutMs || 10000;
    this.fallbackEngine = new OfflineCivilEngineProvider();
  }

  async testConnection() {
    if (!this.apiKey) {
      return { ok: false, latencyMs: 0, message: 'Groq API key missing' };
    }
    const start = Date.now();
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [{ role: 'user', content: 'Ping test. Reply with "OK".' }],
          max_tokens: 5
        }),
        signal: AbortSignal.timeout(5000)
      });
      const latency = Date.now() - start;
      return { ok: res.ok, latencyMs: latency, message: res.ok ? 'Groq API connected successfully' : `HTTP error: ${res.status}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, message: err.message };
    }
  }

  async ask(prompt, context = {}) {
    if (!this.apiKey) {
      const fallbackRes = await this.fallbackEngine.ask(prompt, context);
      return {
        ...fallbackRes,
        notice: 'Groq API key not configured. Using built-in deterministic civil expert engine.'
      };
    }

    const startTime = Date.now();
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: SYSTEM_GUARDRAIL_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 600
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (!res.ok) {
        throw new Error(`Groq HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from Groq');

      return {
        provider: 'Groq (Llama 3.3)',
        model: this.modelName,
        isAiGenerated: true,
        answer: text.trim(),
        latencyMs: Date.now() - startTime,
        references: ['IS 456:2000', 'TN PWD SOR 2025-26', `Groq (${this.modelName})`]
      };
    } catch (err) {
      const fallbackRes = await this.fallbackEngine.ask(prompt, context);
      return {
        ...fallbackRes,
        notice: `Groq service error (${err.message}). Safely transitioned to deterministic offline expert engine.`
      };
    }
  }
}

/**
 * 4. OpenRouter Provider (Free tier and diverse models)
 */
export class OpenRouterProvider extends AiProvider {
  constructor(options = {}) {
    super();
    const envKey = (typeof process !== 'undefined' && process.env) ? process.env.OPENROUTER_API_KEY : null;
    this.apiKey = options.apiKey || envKey || null;
    this.modelName = options.modelName || 'meta-llama/llama-3.2-3b-instruct:free';
    this.timeoutMs = options.timeoutMs || 10000;
    this.fallbackEngine = new OfflineCivilEngineProvider();
  }

  async testConnection() {
    if (!this.apiKey) {
      return { ok: false, latencyMs: 0, message: 'OpenRouter API key missing' };
    }
    const start = Date.now();
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [{ role: 'user', content: 'Ping test. Reply with "OK".' }],
          max_tokens: 5
        }),
        signal: AbortSignal.timeout(5000)
      });
      const latency = Date.now() - start;
      return { ok: res.ok, latencyMs: latency, message: res.ok ? 'OpenRouter connected' : `HTTP error: ${res.status}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, message: err.message };
    }
  }

  async ask(prompt, context = {}) {
    if (!this.apiKey) {
      const fallbackRes = await this.fallbackEngine.ask(prompt, context);
      return {
        ...fallbackRes,
        notice: 'OpenRouter API key not configured. Using built-in deterministic civil expert engine.'
      };
    }

    const startTime = Date.now();
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/vignesh0021/DDevUltraHome-',
          'X-Title': 'DDevUltraHome'
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: SYSTEM_GUARDRAIL_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 600
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from OpenRouter');

      return {
        provider: 'OpenRouter',
        model: this.modelName,
        isAiGenerated: true,
        answer: text.trim(),
        latencyMs: Date.now() - startTime,
        references: ['IS 456:2000', 'TN PWD SOR 2025-26', `OpenRouter (${this.modelName})`]
      };
    } catch (err) {
      const fallbackRes = await this.fallbackEngine.ask(prompt, context);
      return {
        ...fallbackRes,
        notice: `OpenRouter service error (${err.message}). Safely transitioned to deterministic offline expert engine.`
      };
    }
  }
}

/**
 * 5. Custom OpenAI-Compatible Endpoint Provider
 */
export class CustomEndpointProvider extends AiProvider {
  constructor(options = {}) {
    super();
    this.baseUrl = (options.baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');
    this.apiKey = options.apiKey || '';
    this.modelName = options.modelName || 'llama3';
    this.timeoutMs = options.timeoutMs || 10000;
    this.fallbackEngine = new OfflineCivilEngineProvider();
  }

  async testConnection() {
    const start = Date.now();
    try {
      const url = `${this.baseUrl}/chat/completions`;
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.modelName,
          messages: [{ role: 'user', content: 'Ping test' }],
          max_tokens: 5
        }),
        signal: AbortSignal.timeout(5000)
      });
      const latency = Date.now() - start;
      return { ok: res.ok, latencyMs: latency, message: res.ok ? 'Custom endpoint connected' : `HTTP error: ${res.status}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, message: `Endpoint unreachable: ${err.message}` };
    }
  }

  async ask(prompt, context = {}) {
    const startTime = Date.now();
    try {
      const url = `${this.baseUrl}/chat/completions`;
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: SYSTEM_GUARDRAIL_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 600
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (!res.ok) throw new Error(`Custom endpoint HTTP ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from custom endpoint');

      return {
        provider: 'Custom Endpoint',
        model: this.modelName,
        isAiGenerated: true,
        answer: text.trim(),
        latencyMs: Date.now() - startTime,
        references: ['IS 456:2000', 'TN PWD SOR 2025-26', `Custom Endpoint (${this.modelName})`]
      };
    } catch (err) {
      const fallbackRes = await this.fallbackEngine.ask(prompt, context);
      return {
        ...fallbackRes,
        notice: `Custom AI endpoint unreachable (${err.message}). Safely transitioned to deterministic offline expert engine.`
      };
    }
  }
}

/**
 * AI Service Manager Singleton
 */
export class AiService {
  constructor() {
    this.disabled = false;
    this.activeProviderType = 'offline';
    this.providers = {
      offline: new OfflineCivilEngineProvider(),
      gemini: new GeminiProvider(),
      groq: new GroqProvider(),
      openrouter: new OpenRouterProvider(),
      custom: new CustomEndpointProvider()
    };
    this.loadSavedConfig();
  }

  loadSavedConfig() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('ddev_ai_config');
        if (saved) {
          const cfg = JSON.parse(saved);
          this.configure(cfg, false);
        }
      } catch {}
    }
  }

  configure(config = {}, saveToStorage = true) {
    if (config.disabled !== undefined) this.disabled = !!config.disabled;
    if (config.provider && this.providers[config.provider]) {
      this.activeProviderType = config.provider;
    }

    const prov = this.providers[this.activeProviderType];
    if (config.apiKey !== undefined && prov) prov.apiKey = config.apiKey.trim();
    if (config.model && prov) prov.modelName = config.model.trim();
    if (config.baseUrl && prov && prov.baseUrl !== undefined) prov.baseUrl = config.baseUrl.trim();

    if (saveToStorage && typeof localStorage !== 'undefined') {
      try {
        // Redact or mask keys before saving or store strictly in private localStorage
        localStorage.setItem('ddev_ai_config', JSON.stringify({
          provider: this.activeProviderType,
          disabled: this.disabled,
          apiKey: prov?.apiKey || '',
          model: prov?.modelName || '',
          baseUrl: prov?.baseUrl || ''
        }));
      } catch {}
    }
  }

  getConfig() {
    const prov = this.providers[this.activeProviderType];
    const key = prov?.apiKey || '';
    const maskedKey = key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : (key ? '••••••••' : '');
    return {
      activeProvider: this.activeProviderType,
      disabled: this.disabled,
      model: prov?.modelName || '',
      hasKey: !!key,
      maskedKey,
      baseUrl: prov?.baseUrl || ''
    };
  }

  getActiveProvider() {
    if (this.disabled) {
      return this.providers.offline;
    }
    return this.providers[this.activeProviderType] || this.providers.offline;
  }

  async testConnection() {
    const prov = this.getActiveProvider();
    return prov.testConnection();
  }

  async ask(prompt, context = {}) {
    const prov = this.getActiveProvider();
    return prov.ask(prompt, context);
  }
}

export const aiService = new AiService();
