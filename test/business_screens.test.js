import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

describe('DDevUltraHome Construction Business Platform — 12 Screens & UI Architecture', () => {
  test('verifies all 12 business screens exist and export render functions', async () => {
    const screens = [
      'dashboardScreen.js',
      'projectsScreen.js',
      'clientsScreen.js',
      'quotationsScreen.js',
      'incomeScreen.js',
      'expensesScreen.js',
      'suppliersScreen.js',
      'progressScreen.js',
      'documentsScreen.js',
      'reportsScreen.js',
      'backupScreen.js',
      'settingsScreen.js'
    ];

    for (const screenFile of screens) {
      const filePath = path.join(ROOT, 'public', 'js', 'screens', screenFile);
      assert.ok(fs.existsSync(filePath), `Screen file ${screenFile} must exist`);

      const content = fs.readFileSync(filePath, 'utf-8');
      assert.match(content, /export\s+const\s+\w+Screen\s*=\s*\{/, `${screenFile} must export Screen object`);
      assert.match(content, /async\s+render\s*\(/, `${screenFile} must implement render() method`);
    }
  });

  test('verifies screens/index.js registers all 12 screens in SCREENS router map', async () => {
    const indexPath = path.join(ROOT, 'public', 'js', 'screens', 'index.js');
    assert.ok(fs.existsSync(indexPath));

    const content = fs.readFileSync(indexPath, 'utf-8');
    const requiredKeys = [
      'dashboard',
      'projects',
      'clients',
      'quotations',
      'income',
      'expenses',
      'suppliers',
      'progress',
      'documents',
      'reports',
      'backup',
      'settings'
    ];

    for (const key of requiredKeys) {
      assert.match(content, new RegExp(`${key}:\\s*\\w+Screen`), `Registry must include screen key "${key}"`);
    }
  });

  test('verifies design-system.css contains D DEV ULTRA HOMES brand palette and touch-friendly rules', () => {
    const cssPath = path.join(ROOT, 'public', 'css', 'design-system.css');
    assert.ok(fs.existsSync(cssPath));

    const css = fs.readFileSync(cssPath, 'utf-8');
    assert.match(css, /--brand-navy-900:\s*#0B192C/);
    assert.match(css, /--brand-gold-600:\s*#D97706/);
    assert.match(css, /badge-status/);
    assert.match(css, /kpi-grid/);
    assert.match(css, /min-height:\s*48px/);
  });

  test('verifies public/index.html includes business suite container, role switcher, and subnav', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf-8');

    assert.match(html, /id="business-screen-mount"/, 'Mount container exists for screens');
    assert.match(html, /id="active-role-display"/, 'Active role display exists');
    assert.match(html, /href="\/css\/design-system.css"/, 'design-system.css linked');
    assert.match(html, /data-screen="dashboard"/);
    assert.match(html, /data-screen="projects"/);
    assert.match(html, /data-screen="clients"/);
    assert.match(html, /data-screen="income"/);
    assert.match(html, /data-screen="expenses"/);
    assert.match(html, /data-screen="suppliers"/);
    assert.match(html, /data-screen="documents"/);
    assert.match(html, /data-screen="reports"/);
  });
});
