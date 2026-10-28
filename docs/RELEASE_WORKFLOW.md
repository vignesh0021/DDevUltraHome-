# DDevUltraHome — Android Signed Release Workflow Guide

This guide describes how to configure and execute a secure, production-grade Android release build for **DDevUltraHome (டிடெவ் அல்ட்ரா ஹோம்)** without committing keystores, certificates, or passwords to version control.

---

## 1. Security Principles

1. **Never commit `.keystore` or `.jks` files** to Git repositories.
2. **Never commit passwords or credentials** in `gradle.properties` or source code.
3. Use **GitHub Actions Encrypted Secrets** for all signing credentials.
4. Clean up temporary keystore files in the CI runner immediately after signing.

---

## 2. Generating the Production Keystore

Generate a 2048-bit RSA signing key using Java's standard `keytool` utility:

```bash
keytool -genkey -v \
  -keystore ddevultrahome-release.keystore \
  -alias ddevultrahome \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=DDevUltraHome, OU=Engineering, O=DDevUltraHome Tamil Nadu, L=Chennai, ST=Tamil Nadu, C=IN"
```

You will be prompted to enter a Keystore Password and Key Password. Keep these safe in an encrypted password manager.

---

## 3. Preparing Keystore for GitHub Actions Secrets

Convert the binary keystore file to a Base64-encoded string:

### Linux / macOS:
```bash
base64 -w 0 ddevultrahome-release.keystore > keystore_base64.txt
```

### Windows PowerShell:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("ddevultrahome-release.keystore")) | Out-File -Encoding ASCII keystore_base64.txt
```

---

## 4. Configuring GitHub Repository Secrets

In your GitHub repository, navigate to:
**Settings → Secrets and variables → Actions → New repository secret**

Add the following 4 secrets:

| Secret Name | Value Description | Example |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | The entire content of `keystore_base64.txt` | `MIIKPwIBAzCCC...` |
| `KEYSTORE_PASSWORD` | Password used when creating the keystore | `YourStrongKeystorePass` |
| `KEY_ALIAS` | Alias name specified during `keytool` generation | `ddevultrahome` |
| `KEY_PASSWORD` | Password for the specific key alias | `YourStrongKeyPass` |

---

## 5. Automated Signed Release Workflow (`.github/workflows/release-signed-apk.yml`)

Create the workflow file `.github/workflows/release-signed-apk.yml` with the following contents:

```yaml
name: Build & Sign Android Release APK

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:

jobs:
  release-signed-apk:
    name: Build & Sign Release APK
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Java 21 (Temurin JDK)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: 21

      - name: Accept Android Licenses
        run: |
          yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses 2>/dev/null || true

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install Dependencies & Run Tests
        run: |
          pnpm install
          pnpm test

      - name: Generate & Sync Capacitor Android
        run: |
          npx cap add android || true
          npx cap sync android

      - name: Build Unsigned Release APK
        run: |
          cd android
          chmod +x gradlew
          ./gradlew assembleRelease --no-daemon

      - name: Decode Keystore from Secrets
        env:
          KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
        run: |
          echo "$KEYSTORE_BASE64" | base64 -d > /tmp/release.keystore

      - name: Align and Sign APK with apksigner
        env:
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        run: |
          BUILD_TOOLS_DIR=$(ls -d $ANDROID_HOME/build-tools/* | sort -V | tail -n 1)
          UNSIGNED_APK="android/app/build/outputs/apk/release/app-release-unsigned.apk"
          ALIGNED_APK="/tmp/app-release-aligned.apk"
          SIGNED_APK="android/app/build/outputs/apk/release/DDevUltraHome-release-signed.apk"

          # 1. Zipalign
          $BUILD_TOOLS_DIR/zipalign -v -p 4 "$UNSIGNED_APK" "$ALIGNED_APK"

          # 2. Apksigner (v2 + v3 scheme)
          $BUILD_TOOLS_DIR/apksigner sign \
            --ks /tmp/release.keystore \
            --ks-pass "pass:$KEYSTORE_PASSWORD" \
            --ks-key-alias "$KEY_ALIAS" \
            --key-pass "pass:$KEY_PASSWORD" \
            --out "$SIGNED_APK" \
            "$ALIGNED_APK"

          # 3. Verify Signature
          $BUILD_TOOLS_DIR/apksigner verify --verbose "$SIGNED_APK"

          # 4. Immediate shred of temporary keystore
          shred -u /tmp/release.keystore || rm -f /tmp/release.keystore
          rm -f "$ALIGNED_APK"

      - name: Upload Signed APK
        uses: actions/upload-artifact@v4
        with:
          name: DDevUltraHome-Signed-Release-APK
          path: android/app/build/outputs/apk/release/DDevUltraHome-release-signed.apk
          if-no-files-found: error
```

---

## 6. Testing & Verifying the Signed APK

To verify the signature of any built APK on your local machine:

```bash
apksigner verify --verbose --print-certs DDevUltraHome-release-signed.apk
```

Expected output:
```text
Verifies
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
Number of signers: 1
Signer #1 certificate DN: CN=DDevUltraHome, OU=Engineering, O=DDevUltraHome Tamil Nadu, L=Chennai, ST=Tamil Nadu, C=IN
```
