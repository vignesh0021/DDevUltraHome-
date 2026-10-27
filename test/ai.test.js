/**
 * AI Provider Abstraction and Expert Engine Test Suite
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { OfflineCivilEngineProvider, GeminiProvider, AiService } from '../src/ai/provider.js';
import { CivilExpertEngine } from '../src/ai/civilExpertEngine.js';

describe('AI Provider Abstraction Tests', () => {
  it('Offline expert engine answers concrete questions deterministically without hallucination', async () => {
    const offlineProvider = new OfflineCivilEngineProvider();
    const res = await offlineProvider.ask('What is the M20 concrete mix ratio and cement bags?');

    assert.strictEqual(res.isAiGenerated, false);
    assert.ok(res.answer.includes('1 : 1.5 : 3'));
    assert.ok(res.answer.includes('1.54'));
    assert.ok(res.references.includes('IS 456:2000 Clause 9.3'));
  });

  it('Offline expert engine answers bar bending schedule bend deductions accurately', async () => {
    const offlineProvider = new OfflineCivilEngineProvider();
    const res = await offlineProvider.ask('How to calculate BBS bend deduction for 90 degree?');

    assert.strictEqual(res.isAiGenerated, false);
    assert.ok(res.answer.includes('d² / 162.28'));
    assert.ok(res.answer.includes('90° bend = 2d'));
  });

  it('Offline expert engine provides Tamil Nadu land unit definitions', async () => {
    const offlineProvider = new OfflineCivilEngineProvider();
    const res = await offlineProvider.ask('What is 1 ground in sqft?');

    assert.strictEqual(res.isAiGenerated, false);
    assert.ok(res.answer.includes('2,400 sq.ft'));
    assert.ok(res.answer.includes('435.6 sq.ft'));
  });

  it('Gemini provider smoothly falls back to offline engine when no API key is provided', async () => {
    const gemini = new GeminiProvider({ apiKey: null });
    const res = await gemini.ask('Explain concrete curing time per IS 456');

    assert.strictEqual(res.isAiGenerated, false);
    assert.ok(res.notice.includes('Gemini API key not configured'));
    assert.ok(res.answer.includes('Minimum 7 days'));
  });

  it('AiService singleton delegates correctly and allows provider switching', async () => {
    const service = new AiService();
    const res = await service.ask('current steel price in chennai');

    assert.ok(res.answer.length > 10);
    assert.strictEqual(res.isAiGenerated, false);
  });
});
