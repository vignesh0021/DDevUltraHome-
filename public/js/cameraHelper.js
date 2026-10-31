/**
 * DDevUltraHome — Mobile Camera & Image Capture Helper
 * Works natively in Capacitor APK with Camera permissions, with fallback action sheet.
 */

export const CameraHelper = {
  /**
   * Capture a photo from device camera or file picker
   * @param {Object} options { source: 'CAMERA' | 'PHOTOS' | 'PROMPT' }
   * @returns {Promise<{ dataUrl: string, fileName: string, fileSize: number, mimeType: string } | null>}
   */
  async capturePhoto(options = { source: 'CAMERA' }) {
    // 1. Try Native Capacitor Camera Plugin (Android APK)
    const hasCapacitor = typeof window !== 'undefined' && window.Capacitor;
    const Camera = hasCapacitor?.Plugins?.Camera;
    const isCameraAvailable = hasCapacitor?.isPluginAvailable?.('Camera') || !!Camera;

    if (isCameraAvailable && Camera) {
      try {
        // Request/Check permissions first
        if (Camera.checkPermissions) {
          try {
            const status = await Camera.checkPermissions();
            if (status.camera !== 'granted' && Camera.requestPermissions) {
              await Camera.requestPermissions();
            }
          } catch (permErr) {
            console.warn('Camera permission check warning:', permErr);
          }
        } else if (Camera.requestPermissions) {
          try {
            await Camera.requestPermissions();
          } catch (permErr) {
            console.warn('Camera requestPermissions warning:', permErr);
          }
        }

        const photo = await Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: 'dataUrl',
          source: options.source === 'PHOTOS' ? 'PHOTOS' : 'CAMERA'
        });

        if (photo && photo.dataUrl) {
          const mimeType = photo.format ? `image/${photo.format}` : 'image/jpeg';
          const fileName = `SiteScan_${Date.now()}.${photo.format || 'jpg'}`;
          const fileSize = Math.round((photo.dataUrl.length * 3) / 4);

          return {
            dataUrl: photo.dataUrl,
            fileName,
            fileSize,
            mimeType
          };
        }

        return null;
      } catch (err) {
        // User cancel returns null and DOES NOT fall through
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('cancel') || msg.includes('user cancelled') || msg.includes('canceled')) {
          return null;
        }
        console.warn('Native Capacitor Camera failed, showing fallback selector sheet:', err);
      }
    }

    // 2. Fallback: Display Action Sheet with Open Camera, Choose from Gallery, and Cancel
    return new Promise((resolve, reject) => {
      this._showCameraSheet({
        onCamera: () => {
          this._openFileInput({ isCamera: true }).then(resolve).catch(reject);
        },
        onGallery: () => {
          this._openFileInput({ isCamera: false }).then(resolve).catch(reject);
        },
        onCancel: () => {
          resolve(null);
        }
      });
    });
  },

  /**
   * Render in-DOM action sheet modal for camera/gallery choices
   */
  _showCameraSheet({ onCamera, onGallery, onCancel }) {
    const existing = document.getElementById('ddev-camera-sheet');
    if (existing) existing.remove();

    const sheet = document.createElement('div');
    sheet.id = 'ddev-camera-sheet';
    sheet.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      z-index: 10000;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      backdrop-filter: blur(2px);
    `;

    sheet.innerHTML = `
      <div class="modal-animated" style="background: var(--bg-card, #FFFFFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 16px; width: 100%; max-width: 420px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
        <div style="font-size: 16px; font-weight: 800; color: var(--brand-navy-900, #0B192C); margin-bottom: 4px; text-align: center;">
          📸 Capture Bill / Document
        </div>
        <div style="font-size: 12px; color: var(--text-muted, #64748B); margin-bottom: 18px; text-align: center;">
          Choose source to scan voucher or purchase bill:
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button type="button" id="btn-sheet-camera" class="btn-primary" style="width: 100%; min-height: 48px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; touch-action: manipulation;">
            📷 Open camera
          </button>
          <button type="button" id="btn-sheet-gallery" class="btn-outline" style="width: 100%; min-height: 48px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; touch-action: manipulation;">
            🖼️ Choose from gallery
          </button>
          <button type="button" id="btn-sheet-cancel" class="btn-outline" style="width: 100%; min-height: 44px; background: transparent; color: #DC2626 !important; border-color: #FCA5A5 !important; font-size: 13px; font-weight: 700; cursor: pointer; touch-action: manipulation;">
            ✕ Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(sheet);

    const cleanup = () => {
      if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
    };

    sheet.querySelector('#btn-sheet-camera').onclick = () => {
      cleanup();
      onCamera();
    };

    sheet.querySelector('#btn-sheet-gallery').onclick = () => {
      cleanup();
      onGallery();
    };

    sheet.querySelector('#btn-sheet-cancel').onclick = () => {
      cleanup();
      onCancel();
    };

    sheet.onclick = (e) => {
      if (e.target === sheet) {
        cleanup();
        onCancel();
      }
    };
  },

  /**
   * HTML5 file chooser with body attachment for Android WebView compatibility
   */
  _openFileInput({ isCamera }) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (isCamera) {
        input.capture = 'environment';
      }
      input.style.position = 'fixed';
      input.style.opacity = '0';
      input.style.left = '-9999px';

      // Required: Must be appended to document.body before click or WebView ignores it
      document.body.appendChild(input);

      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
          if (input.parentNode) input.parentNode.removeChild(input);
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          if (input.parentNode) input.parentNode.removeChild(input);
          resolve({
            dataUrl: event.target.result,
            fileName: file.name || `Scan_${Date.now()}.jpg`,
            fileSize: file.size,
            mimeType: file.type || 'image/jpeg'
          });
        };
        reader.onerror = () => {
          if (input.parentNode) input.parentNode.removeChild(input);
          reject(new Error('Failed to read photo data.'));
        };
        reader.readAsDataURL(file);
      };

      input.oncancel = () => {
        if (input.parentNode) input.parentNode.removeChild(input);
        resolve(null);
      };

      input.click();
    });
  }
};
