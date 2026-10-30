/**
 * DDevUltraHome — Mobile Camera & Image Capture Helper
 * Works natively in Capacitor APK via Camera Plugin, and in Browser via HTML5 capture.
 */

export const CameraHelper = {
  /**
   * Capture a photo from device camera or prompt file picker
   * @param {Object} options { source: 'CAMERA' | 'PHOTOS' | 'PROMPT' }
   * @returns {Promise<{ dataUrl: string, fileName: string, fileSize: number, mimeType: string }>}
   */
  async capturePhoto(options = { source: 'CAMERA' }) {
    // 1. Try Native Capacitor Camera Plugin first (for Android APK)
    if (window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Camera')) {
      try {
        const Camera = window.Capacitor.Plugins.Camera;
        const photo = await Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: 'dataUrl',
          source: options.source === 'PHOTOS' ? 'PHOTOS' : 'CAMERA'
        });

        if (photo && photo.dataUrl) {
          const mimeType = photo.format ? `image/${photo.format}` : 'image/jpeg';
          const fileName = `SiteScan_${Date.now()}.${photo.format || 'jpg'}`;
          // Estimate byte size from base64 length
          const fileSize = Math.round((photo.dataUrl.length * 3) / 4);

          return {
            dataUrl: photo.dataUrl,
            fileName,
            fileSize,
            mimeType
          };
        }
      } catch (err) {
        // If user cancelled, don't fallback; rethrow or return null
        if (err.message && err.message.toLowerCase().includes('cancel')) {
          return null;
        }
        console.warn('Native Capacitor camera error, falling back to file input:', err);
      }
    }

    // 2. Fallback to HTML5 File / Capture Input (for browser or WebChromeClient)
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (options.source !== 'PHOTOS') {
        input.capture = 'environment';
      }

      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            dataUrl: event.target.result,
            fileName: file.name || `Bill_${Date.now()}.jpg`,
            fileSize: file.size,
            mimeType: file.type || 'image/jpeg'
          });
        };
        reader.onerror = () => reject(new Error('Failed to read photo data.'));
        reader.readAsDataURL(file);
      };

      input.oncancel = () => resolve(null);

      // Trigger user file chooser
      input.click();
    });
  }
};
