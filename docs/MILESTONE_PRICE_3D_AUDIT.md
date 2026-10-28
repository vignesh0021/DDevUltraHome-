# DDevUltraHome — Milestone Audit: Dynamic Price Intelligence + Verified 2D-to-3D Construction Projection

**Document Version**: 1.0.0  
**Audit Timestamp**: 2026-10-28T20:00:00Z  
**Branch**: `feature/price-intelligence-3d-projection`  
**Base Commit SHA**: `cc0f6eb8f0b6471d3d11b72697c09e33f7517f0c`  
**Target Repository**: `https://github.com/vignesh0021/DDevUltraHome-`  
**Primary Reference Plan**: `JAS - GUINDY RESIDENCE - SCHEME R0 24042026.pdf` (2-page architectural scheme plan, J-Angle Studio, Velachery, Chennai)

---

## 1. Executive Summary & Baseline State

### 1.1 Automated Test Suite Baseline
- **Execution Command**: `pnpm test`
- **Total Tests**: 123
- **Test Suites**: 34
- **Passing**: 123 (100%)
- **Failing**: 0
- **Duration**: ~1.87s

### 1.2 Build & Deployment Baseline
- **Cloud CI**: GitHub Actions Workflow `build-apk.yml` (Run #40755558482) — **Completed Success**
- **Cloud Build Artifact**: `DDevUltraHome-Debug-APK` (11.48 MB)
- **Local Artifact**: `release-apk/app-debug.apk` (12 MB) and `./app-debug.apk` (12 MB)
- **Local Runtime**: Node.js 26.4.0 on Termux Linux; Capacitor 8.5.3 Android container; Web/PWA on port 3000

---

## 2. Capabilities Matrix (Existing vs Missing)

| Domain | Existing Capability (Commit `cc0f6eb`) | Missing / Deficient Capability | Action Required |
| :--- | :--- | :--- | :--- |
| **Price Freshness & Provenance** | Static catalogue with `2026-10-28` hardcoded dates and mock latency | No real-time provenance tracking (`lastAttemptAt`, `lastSuccessfulFetchAt`, `sourceObservedAt`, `sourcePublishedAt`, `nextScheduledRefreshAt`, `dataHash`, etc.) | Implement centralized Data Provenance Service; display `Asia/Kolkata` timestamps; distinguish fetch time from price date |
| **Provider Connectivity** | Providers show `CONNECTED` with mock ms latency without network ping | Misrepresents offline or unreachable sources as "Connected" | Strict availability verification; genuine HTTP requests; return `DISCONNECTED` or `STALE` if unreachable |
| **Price Data Collection** | Bundled static rates for TN districts and scrap | No pluggable adapter architecture; no dealer quotation import; scrap lacks alloy sub-grades | Create pluggable adapter interface; official TN PWD SOR monitor, public market scraper with error handling, dealer quotation CSV parser, multi-grade scrap catalog |
| **PDF Extraction & Plan Analysis** | Text stream parser using regex for `stream...endstream` blocks | Flattens PDF streams indiscriminately (yielded 5 streams instead of 2 pages for Guindy residence scheme); misses CAD notes | Update parser to traverse PDF `/Type/Page` catalog tree; detect drawing notes ("Do not scale for dimensions"); build side-by-side verification UI |
| **2D to 3D Parametric Projection** | Static 2D room table and Shoelace polygon area | No 3D model, no parametric wall/opening/elevation geometry, no 3D rendering | Implement DDevUltraHome Plan Studio with Three.js viewer (orbit, pan, walkthrough, exploded floors) and geometry validation engine |
| **Review Gates & Estimation Certification** | Basic BOQ marked as "Draft Preliminary Takeoff" | No strict review gate separating unconfirmed extracted dimensions from confirmed dimensions | Implement explicit status gates: `DRAFT`, `NEEDS_INPUT`, `REVIEW_REQUIRED`, `APPROVED_FOR_ESTIMATION`. Enforce engineer sign-off |
| **Android CI Pipeline** | CI builds debug APK using Gradle | `npx cap add android || true` masks potential Capacitor errors with `|| true` | Refactor CI workflow to check directory existence conditionally before running `cap add android` |

---

## 3. Reproducible Defects & File Paths

1. **Hardcoded Price Dates & Fake Latency**:
   - `src/intelligence/materialRates.js`: Hardcodes `const CURRENT_YEAR = 2026`, and static observation dates.
   - `src/intelligence/providerArchitecture.js`: Randomizes latency `Math.floor(Math.random() * 80) + 40` and marks static providers as `CONNECTED` without a verified network handshake.
2. **PDF Page Structure Flaw**:
   - `src/plan/pdfExtractor.js`: Scans regex `/\bstream[\r\n]+([\s\S]*?)[\r\n]+\s*endstream/g` globally. For `guindy_residence_scheme.pdf`, it extracted 5 disconnected streams rather than 2 structured sheets corresponding to Object 27 (Ground Floor) and Object 52 (First Floor).
3. **Missing Drawing Disclaimer Enforcement**:
   - The Guindy Residence drawing explicitly notes:
     > *"Drawings should not be scaled for obtaining dimensions. If any discrepancy is found in the drawing it is to be brought to the notice of the Architect before execution of work at site."*
   - The system must flag pixel-scaled dimensions as UNVERIFIED and require human confirmation.
4. **CI Workflow Error Masking**:
   - `.github/workflows/build-apk.yml`: Line 42 uses `npx cap add android || true`, which hides genuine project generation failures.

---

## 4. Open-Source Dependency & License Evaluation

| Dependency / Technology | License | Suitability for Termux & Android APK | Recommendation |
| :--- | :--- | :--- | :--- |
| **Three.js** | MIT | Extremely high. Standard WebGL renderer, runs natively in all Android WebViews and desktop browsers without native binaries. | **Adopt** for 3D Plan Studio (real-time rendering, parametric meshes, orbit/pan/walkthrough). |
| **openPlan3D** (`laanlabs/openPlan3D`) | MIT | Evaluated. Browser-based 2D/3D floor plan editor with Three.js. Clean parametric wall graph and polygon triangulation. | **Adapt & integrate** key parametric geometry and coordinate patterns directly into pure ESM Plan Studio. |
| **Crawlee / Playwright** | Apache 2.0 | Heavy. Playwright requires bundled Chromium binaries (~300MB) which cannot execute in Termux Android arm64 userland without X11/proot. | **Use direct HTTP / Cheerio / fetch parser adapters** with rate limiting, timeouts, and structured error handling for mobile portability. |

---

## 5. Phase Plan & Acceptance Verification

- **Phase B**: Data Provenance Service (`src/intelligence/provenanceService.js`), `Asia/Kolkata` time formatting, real provider health checks, stale badges, offline data safety.
- **Phase C**: Pluggable Source Adapters (`src/intelligence/adapters/`):
  1. `OfficialSorAdapter`: TN PWD SOR document monitor and parser.
  2. `PublicMarketAdapter`: Permitted market price parsers with validation.
  3. `DealerQuotationAdapter`: Manual and CSV supplier quotation intake.
  4. `ScrapRatesAdapter`: Multi-alloy grade catalog (copper, brass, aluminium, ferrous, cables, e-waste).
  5. `OfflineBaselineAdapter`: Immutable historical baseline with distinct labelling.
- **Phase D**: PDF Page Catalog Extractor traversing `/Type/Page` objects, extracting dimensions with bounding boxes and confidence scores, CAD notes extraction ("Do not scale").
- **Phase E**: 2D-to-3D Parametric Plan Studio:
  - Parametric Building Model: Walls (length, thickness, height), Rooms, Openings (doors, windows, sills), Levels (elevation).
  - Real-time 3D Viewer: Three.js canvas with Orbit, Pan, Zoom, First-Person Walkthrough, Floor Visibility, and Exploded Floor View.
  - Geometry Validator: Closed loops, intersections, overlaps, and issue lists.
- **Phase F**: Review Gates & Verification Provenance (`DRAFT` $\to$ `NEEDS_INPUT` $\to$ `REVIEW_REQUIRED` $\to$ `APPROVED_FOR_ESTIMATION`).
- **Phase G**: Connected Parametric BOQ & Commercial Procurement BOM.
- **Phase H**: Branded Multi-Tab Excel, PDF, and CSV Exports + Fixed Android CI workflow.
- **Phase I**: Automated verification test suite and build packaging.
