/**
 * Automated Mobile-First UI/UX & Localization Tests
 * Verifies Navigation, Home Dashboard, Tamil/English Localization,
 * Mobile Touch targets, Categories, and PWA manifest integrity.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TRANSLATIONS, I18n } from '../src/i18n/translations.js';
import { MaterialPriceIntelligence } from '../src/intelligence/materialRates.js';
import { ScrapRatesEngine } from '../src/intelligence/scrapRates.js';
import { ScrapValuationEngine } from '../src/intelligence/scrapValuation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

describe('Mobile-First UI/UX Redesign & Layout Integrity', () => {

  it('verifies public/index.html includes all 5 primary bottom navigation destinations', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

    // 5 primary navigation buttons
    assert.match(html, /id="nav-home"/, 'Home navigation button exists');
    assert.match(html, /id="nav-calc"/, 'Calculations navigation button exists');
    assert.match(html, /id="nav-rates"/, 'Material rates navigation button exists');
    assert.match(html, /id="nav-scrap"/, 'Scrap valuation navigation button exists');
    assert.match(html, /id="nav-more"/, 'More navigation button exists');

    // 5 matching primary tab panes
    assert.match(html, /id="tab-home"/, 'tab-home destination exists');
    assert.match(html, /id="tab-calc"/, 'tab-calc destination exists');
    assert.match(html, /id="tab-rates"/, 'tab-rates destination exists');
    assert.match(html, /id="tab-scrap"/, 'tab-scrap destination exists');
    assert.match(html, /id="tab-more"/, 'tab-more destination exists');
  });

  it('verifies all 19 calculation engines and form IDs are preserved without regression', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

    const expectedForms = [
      'form-concrete',
      'form-rcc',
      'form-masonry',
      'form-finishing',
      'form-earthwork',
      'form-stirrup',
      'form-watertank',
      'form-septictank',
      'form-geotech',
      'form-qc',
      'form-antitermite',
      'form-tncdbr',
      'form-mbook',
      'form-labour',
      'form-rwh',
      'form-durability',
      'form-cmdafee',
      'form-plinth',
      'form-pile'
    ];

    for (const formId of expectedForms) {
      assert.ok(html.includes(`id="${formId}"`), `Missing form element: ${formId}`);
    }

    const expectedOutputs = [
      'output-concrete',
      'output-rcc',
      'output-masonry',
      'output-finishing',
      'output-earthwork',
      'output-stirrup',
      'output-watertank',
      'output-septictank',
      'output-geotech',
      'output-qc',
      'output-antitermite',
      'output-tncdbr',
      'output-mbook',
      'output-labour',
      'output-rwh',
      'output-durability',
      'output-cmdafee',
      'output-plinth',
      'output-pile'
    ];

    for (const outId of expectedOutputs) {
      assert.ok(html.includes(`id="${outId}"`), `Missing output element: ${outId}`);
    }
  });

  it('verifies Home Dashboard contains real quick action targets, material snapshot, and scrap snapshot', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

    assert.match(html, /data-jump-subtab="sub-concrete"/, 'Quick action for concrete mix exists');
    assert.match(html, /data-jump-subtab="sub-rcc"/, 'Quick action for RCC exists');
    assert.match(html, /data-jump-subtab="sub-masonry"/, 'Quick action for brick masonry exists');
    assert.match(html, /data-jump-subtab="sub-finishing"/, 'Quick action for plastering & tiles exists');
    assert.match(html, /data-jump-subtab="sub-bbs"/, 'Quick action for BBS exists');
    assert.match(html, /data-jump-tab="tab-boq"/, 'Quick action for BOQ exists');
    assert.match(html, /data-jump-subtab="sub-septictank"/, 'Quick action for septic tank exists');
    assert.match(html, /data-jump-subtab="sub-tncdbr"/, 'Quick action for TNCDBR exists');

    assert.match(html, /id="home-materials-grid"/, 'Real materials snapshot container exists on home');
    assert.match(html, /Heavy Melting Steel/, 'Scrap snapshot includes HMS iron');
    assert.match(html, /Copper DC/, 'Scrap snapshot includes Copper DC');
    assert.match(html, /Brass/, 'Scrap snapshot includes Brass');
  });

  it('verifies Calculations Hub contains categorized filter chips and search input', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

    assert.match(html, /data-calc-category="all"/, 'Category chip "all" exists');
    assert.match(html, /data-calc-category="structural"/, 'Category chip "structural" exists');
    assert.match(html, /data-calc-category="masonry"/, 'Category chip "masonry" exists');
    assert.match(html, /data-calc-category="water"/, 'Category chip "water" exists');
    assert.match(html, /data-calc-category="planning"/, 'Category chip "planning" exists');
    assert.match(html, /id="calc-search-input"/, 'Instant search input exists');
    assert.match(html, /id="calc-dropdown"/, 'Mobile 1-tap dropdown exists');
  });

  it('verifies Material Rates screen has category filter chips and search input', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

    assert.match(html, /data-rate-cat="Cement"/, 'Cement filter exists');
    assert.match(html, /data-rate-cat="Steel"/, 'Steel filter exists');
    assert.match(html, /data-rate-cat="Aggregates"/, 'Aggregates filter exists');
    assert.match(html, /id="rates-search-input"/, 'Rates search input exists');
    assert.match(html, /id="rates-refresh-btn"/, 'Rates refresh button exists');
  });

  it('verifies "More" screen contains organized subviews for BOQ, Projects, AI, Standards, and Backup', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

    assert.match(html, /data-more-target="view-boq"/, 'More card for BOQ exists');
    assert.match(html, /data-more-target="view-projects"/, 'More card for Projects exists');
    assert.match(html, /data-more-target="view-ai"/, 'More card for AI Assistant exists');
    assert.match(html, /data-more-target="view-standards"/, 'More card for Standards exists');
    assert.match(html, /data-more-target="view-backup"/, 'More card for Backup exists');
    assert.match(html, /data-more-target="view-apk"/, 'More card for APK info exists');

    assert.match(html, /id="view-boq"/, 'Sub-view container for BOQ exists');
    assert.match(html, /id="view-projects"/, 'Sub-view container for Projects exists');
    assert.match(html, /id="view-ai"/, 'Sub-view container for AI exists');
    assert.match(html, /id="view-standards"/, 'Sub-view container for Standards exists');
    assert.match(html, /id="view-backup"/, 'Sub-view container for Backup exists');
    assert.match(html, /id="view-apk"/, 'Sub-view container for APK info exists');
  });

  it('verifies styling includes mobile-first tokens, safe areas, 48px touch targets, and dark theme', () => {
    const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'style.css'), 'utf8');

    assert.match(css, /--safe-bottom:/, 'Safe area inset bottom defined');
    assert.match(css, /--safe-top:/, 'Safe area inset top defined');
    assert.match(css, /--accent:\s*#0d9488;/, 'Professional teal accent defined');
    assert.match(css, /'Mukta Malar'/, 'Tamil font stack configured');
    assert.match(css, /min-height:\s*48px;/, 'Accessible 48px mobile touch targets enforced');
    assert.match(css, /\[data-theme="dark"\]/, 'Dark theme token definitions exist');
    assert.match(css, /nav\.mobile-bottom-nav/, 'Mobile bottom navigation styles exist');
  });

  it('verifies complete bilingual localization dictionary integrity (Tamil & English)', () => {
    const i18nJs = fs.readFileSync(path.join(ROOT, 'public', 'js', 'i18n.js'), 'utf8');

    assert.match(i18nJs, /appTitle:\s*'டிடெவ் அல்ட்ரா ஹோம்'/, 'Tamil app title exists');
    assert.match(i18nJs, /appTitle:\s*'DDevUltraHome'/, 'English app title exists');
    assert.match(i18nJs, /localStorage\.getItem\('ddev_lang'\)\s*\|\|\s*'ta'/, 'Defaults to Tamil');
    assert.match(i18nJs, /concrete:\s*'கான்கிரீட் கலவை/, 'Tamil concrete translation key exists');
    assert.match(i18nJs, /septictank:\s*'செப்டிக் டேங்க்/, 'Tamil septic tank key exists');

    // Server-side translation module
    const ta = I18n.get('ta');
    const en = I18n.get('en');
    assert.strictEqual(ta.appTitle, 'டிடெவ் அல்ட்ரா ஹோம்');
    assert.strictEqual(en.appTitle, 'DDevUltraHome');
    assert.strictEqual(ta.nav.home, 'முகப்பு');
    assert.strictEqual(en.nav.home, 'Home');
  });

  it('verifies offline Service Worker caches i18n.js and core assets', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
    assert.match(sw, /'\/js\/i18n\.js'/, 'sw.js caches i18n.js');
    assert.match(sw, /'\/js\/app\.js'/, 'sw.js caches app.js');
    assert.match(sw, /'\/css\/style\.css'/, 'sw.js caches style.css');
    assert.match(sw, /'\/manifest\.json'/, 'sw.js caches manifest.json');
  });

});
