/**
 * DDevUltraHome — In-DOM Native-Style Dialog System
 * Replaces window.prompt, window.confirm, and window.alert with touch-friendly,
 * high-contrast modals that are guaranteed to work in Android WebViews and APKs.
 */

export const AppDialog = {
  /**
   * Show a confirmation modal (Replaces window.confirm)
   */
  confirm({ title = 'Confirm Action', message, confirmText = 'Confirm', cancelText = 'Cancel', isDestructive = false }) {
    return new Promise((resolve) => {
      const existing = document.getElementById('app-dynamic-dialog');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'app-dynamic-dialog';
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 9999;
        display: flex; align-items: center; justify-content: center; padding: 16px;
        backdrop-filter: blur(2px); animation: fadeIn 0.15s ease-out;
      `;

      overlay.innerHTML = `
        <div style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 14px; width: 100%; max-width: 420px; padding: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
          <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">
            ${title}
          </h3>
          <p style="margin: 0 0 20px; font-size: 13px; color: var(--text-secondary, #475569); line-height: 1.5; white-space: pre-line;">
            ${message}
          </p>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="dialog-btn-cancel" class="btn-outline" style="min-height: 40px; padding: 0 16px; font-size: 13px; font-weight: 600;">
              ${cancelText}
            </button>
            <button id="dialog-btn-confirm" class="btn-primary" style="min-height: 40px; padding: 0 18px; font-size: 13px; font-weight: 700; ${isDestructive ? 'background: #DC2626 !important; border-color: #DC2626 !important; color: white !important;' : ''}">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };

      overlay.querySelector('#dialog-btn-cancel').onclick = () => cleanup(false);
      overlay.querySelector('#dialog-btn-confirm').onclick = () => cleanup(true);
      overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
    });
  },

  /**
   * Show an input prompt modal (Replaces window.prompt)
   */
  prompt({ title = 'Provide Reason', message, placeholder = 'Enter reason...', defaultValue = '', confirmText = 'Submit', cancelText = 'Cancel' }) {
    return new Promise((resolve) => {
      const existing = document.getElementById('app-dynamic-dialog');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'app-dynamic-dialog';
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 9999;
        display: flex; align-items: center; justify-content: center; padding: 16px;
        backdrop-filter: blur(2px);
      `;

      overlay.innerHTML = `
        <div style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 14px; width: 100%; max-width: 440px; padding: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
          <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">
            ${title}
          </h3>
          <p style="margin: 0 0 12px; font-size: 13px; color: var(--text-secondary, #475569); line-height: 1.4; white-space: pre-line;">
            ${message}
          </p>
          <div style="margin-bottom: 16px;">
            <input type="text" id="dialog-inp-val" class="form-control" style="width: 100%; font-size: 13px;" placeholder="${placeholder}" value="${defaultValue}">
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="dialog-btn-cancel" class="btn-outline" style="min-height: 40px; padding: 0 16px; font-size: 13px; font-weight: 600;">
              ${cancelText}
            </button>
            <button id="dialog-btn-confirm" class="btn-primary" style="min-height: 40px; padding: 0 18px; font-size: 13px; font-weight: 700;">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const inp = overlay.querySelector('#dialog-inp-val');
      setTimeout(() => inp.focus(), 50);

      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };

      overlay.querySelector('#dialog-btn-cancel').onclick = () => cleanup(null);
      overlay.querySelector('#dialog-btn-confirm').onclick = () => {
        const val = inp.value.trim();
        cleanup(val || defaultValue || 'Authorized by user');
      };
      inp.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const val = inp.value.trim();
          cleanup(val || defaultValue || 'Authorized by user');
        } else if (e.key === 'Escape') {
          cleanup(null);
        }
      };
      overlay.onclick = (e) => { if (e.target === overlay) cleanup(null); };
    });
  },

  /**
   * Show a notice alert (Replaces window.alert)
   */
  alert({ title = 'Notice', message, okText = 'OK' }) {
    return new Promise((resolve) => {
      const existing = document.getElementById('app-dynamic-dialog');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'app-dynamic-dialog';
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 9999;
        display: flex; align-items: center; justify-content: center; padding: 16px;
      `;

      overlay.innerHTML = `
        <div style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 14px; width: 100%; max-width: 400px; padding: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
          <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">
            ${title}
          </h3>
          <p style="margin: 0 0 18px; font-size: 13px; color: var(--text-secondary, #475569); line-height: 1.5; white-space: pre-line;">
            ${message}
          </p>
          <div style="display: flex; justify-content: flex-end;">
            <button id="dialog-btn-ok" class="btn-primary" style="min-height: 40px; padding: 0 20px; font-size: 13px; font-weight: 700;">
              ${okText}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const cleanup = () => {
        overlay.remove();
        resolve();
      };

      overlay.querySelector('#dialog-btn-ok').onclick = cleanup;
      overlay.onclick = (e) => { if (e.target === overlay) cleanup(); };
    });
  }
};
