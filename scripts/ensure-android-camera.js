#!/usr/bin/env node

/**
 * Ensure Android Manifest retains Camera and Storage permissions after Capacitor sync.
 * Target: android/app/src/main/AndroidManifest.xml
 */

import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve(process.cwd(), 'android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.log('AndroidManifest.xml does not exist yet (pre-sync). Exiting cleanly.');
  process.exit(0);
}

let content = fs.readFileSync(manifestPath, 'utf-8');

const requiredPermissions = [
  'android.permission.CAMERA',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_EXTERNAL_STORAGE'
];

let modified = false;

for (const perm of requiredPermissions) {
  if (!content.includes(perm)) {
    const permTag = `    <uses-permission android:name="${perm}" />\n`;
    content = content.replace('</manifest>', `${permTag}</manifest>`);
    modified = true;
    console.log(`[ensure-android-camera] Added missing permission: ${perm}`);
  }
}

// Ensure camera uses-feature that is not required
const cameraFeatureName = 'android.hardware.camera';
if (!content.includes(cameraFeatureName)) {
  const featTag = `    <uses-feature android:name="android.hardware.camera" android:required="false" />\n`;
  content = content.replace('</manifest>', `${featTag}</manifest>`);
  modified = true;
  console.log('[ensure-android-camera] Added uses-feature android.hardware.camera (required=false)');
}

if (modified) {
  fs.writeFileSync(manifestPath, content, 'utf-8');
  console.log('[ensure-android-camera] AndroidManifest.xml successfully verified and updated.');
} else {
  console.log('[ensure-android-camera] AndroidManifest.xml already has all required camera permissions and features.');
}
