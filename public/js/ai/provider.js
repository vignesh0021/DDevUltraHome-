/**
 * AI Provider Abstraction Layer
 * Pluggable architecture supporting Google Gemini, Offline Rule-Based Fallback, and Mock
 * Enforces strict security, timeouts, rate limiting, and calculation guardrails
 */

import { CivilExpertEngine } from './civilExpertEngine.js';

export class AiProvider {
  async ask(prompt, context = {}) {
    throw new Error('Method ask() must be implemented by subclass');
  }
}

/**
 * Offline Rule-Based Civil Engineering Engine Fallback
 * 100% Free, zero external network dependency, deterministic
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
}

/**
 * Google Gemini Provider with Rate Limiting, Timeout, and Deterministic Fallback
 */
export class GeminiProvider extends AiProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || (typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : null) || null;
    this.modelName = options.modelName || 'gemini-1.5-flash';
    this.timeoutMs = options.timeoutMs || 10000;
    this.fallbackEngine = new OfflineCivilEngineProvider();

    // Rate Limiting: Free tier limit 15 requests per minute
    this.requestTimestamps = [];
    this.maxRpm = 15;
  }

  isRateLimited() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 60000);
    return this.requestTimestamps.length >= this.maxRpm;
  }

  async ask(prompt, context = {}) {
    // 1. If no API key configured, use deterministic offline fallback
    if (!this.apiKey) {
      const fallbackRes = await this.fallbackEngine.ask(prompt, context);
      return {
        ...fallbackRes,
        notice: 'Gemini API key not configured in environment. Using built-in deterministic civil expert engine.'
      };
    }

    // 2. Check rate limit
    if (this.isRateLimited()) {
      const fallbackRes = await this.fallbackEngine.ask(prompt, context);
      return {
        ...fallbackRes,
        notice: 'Gemini API free tier rate limit reached (15 RPM). Returned verified offline answer.'
      };
    }

    // 3. Make Gemini API call with strict civil engineering guardrails
    const startTime = Date.now();
    try {
      this.requestTimestamps.push(Date.now());

      const systemPrompt = `You are the civil engineering AI assistant for DDevUltraHome, an estimation app in Tamil Nadu, India.
CRITICAL GUARDRAILS:
1. NEVER invent or fabricate numerical material rates, tender prices, or calculation results.
2. For all quantities and costs, refer the user to the application's deterministic calculation tabs (Concrete, Masonry, BBS, Water Tank, BOQ).
3. Base all standards on Indian Standard Codes (IS 456 for concrete, IS 1200 for measurement, IS 2502 for BBS) and Tamil Nadu PWD Schedule of Rates 2025-26.
4. Keep responses concise, practical, and helpful for contractors and civil engineers.`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nUser Question: ${prompt}` }]
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
        provider: 'Google Gemini (Free Tier)',
        model: this.modelName,
        isAiGenerated: true,
        answer: text.trim(),
        latencyMs: Date.now() - startTime,
        references: ['IS 456:2000', 'TN PWD SOR 2025-26', 'Google Gemini 1.5 Flash']
      };
    } catch (err) {
      // Automatic fallback on timeout, network failure, or rate limit error
      const fallbackRes = await this.fallbackEngine.ask(prompt, context);
      return {
        ...fallbackRes,
        notice: `Gemini service unavailable (${err.message}). Safely transitioned to deterministic offline expert engine.`
      };
    }
  }
}

/**
 * AI Service Manager Singleton
 */
export class AiService {
  constructor() {
    this.provider = new GeminiProvider();
  }

  setProvider(providerInstance) {
    if (!(providerInstance instanceof AiProvider)) {
      throw new Error('Provider must be an instance of AiProvider');
    }
    this.provider = providerInstance;
  }

  async ask(prompt, context = {}) {
    return this.provider.ask(prompt, context);
  }
}

export const aiService = new AiService();
