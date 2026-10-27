# DDevUltraHome (டிடெவ் அல்ட்ரா ஹோம்)
### Production Civil Engineering, Material Intelligence & Scrap Management System

A production-grade, Tamil Nadu-focused web application and offline-first PWA for civil engineers, contractors, quantity surveyors, material dealers, and scrap business operators.

---

## 🏗️ Core Modules & Capabilities

### 1. Deterministic Civil Engineering Calculation Engine
Independent of AI, 100% deterministic, and decimal-safe. Every calculation provides formulas, inputs, assumptions, step-by-step intermediate results, and engineering disclaimers:
- **Concrete Mix & Material Quantities**: M7.5, M10, M15, M20, M25, M30 with dry factor 1.54, cement density 1440 kg/m³, 50kg bags, fine aggregate (M-Sand in m³, cft, and TN Units where 1 Unit = 100 cft), coarse aggregate (Blue Metal 20mm/40mm in cft and TN Units), and water-cement ratio.
- **RCC Structural Elements**:
  - Slabs (One-Way vs Two-Way ratio analysis, concrete volume, steel reinforcement, soffit and edge shuttering).
  - Beams (Concrete volume, longitudinal steel, 2-legged shear stirrups, 3-face shuttering area).
  - Columns (4-face vertical shuttering perimeter, longitudinal main bars, lateral ties).
  - Isolated Footings (Pad concrete volume, steel bottom mesh, 1:4:8 PCC bed with 100mm offset).
  - Staircases (Inclined waist slab, riser & tread triangular steps volume, landing slab, soffit & riser shuttering).
- **Brick & Block Masonry**:
  - Traditional Wire-Cut / Country Red Bricks ($9'' \times 4.25'' \times 2.75''$ / $228.6 \times 107.95 \times 69.85$ mm).
  - Standard Modular Bricks ($190 \times 90 \times 90$ mm).
  - Fly-Ash Bricks ($230 \times 110 \times 70$ mm).
  - AAC Blocks ($600 \times 200 \times 100/150/200$ mm).
  - Mortar ratios (1:3, 1:4, 1:5, 1:6) with dry mortar factor 1.33, frog filling factor, and openings deductions.
- **Finishing & Tiling**:
  - Plastering (6mm ceiling 1:3, 12mm internal 1:4/1:5, 15mm-20mm external double coat).
  - Painting (2 coats putty, 1 coat primer, 2 coats emulsion paint with coverage constants).
  - Flooring & Tiling (Vitrified 2'x2', 4'x2', ceramic tiles, 4-inch skirting perimeter, cement mortar bedding, tile slurry, and epoxy grout).
- **Earthwork & Backfilling**:
  - In-situ excavation for foundation pits, trenches, and basements.
  - Soil swelling / bulking factor (1.25) and compaction settlement factor (1.18).
  - Net pit backfill, plinth filling, and surplus soil carting away.
- **Bar Bending Schedule (BBS)**:
  - Steel unit weights per meter using standard formula:
    $$\text{Weight} = \frac{d^2}{162.28} \text{ kg/m}$$
  - Standard IS 2502 bend deductions ($45^\circ = 1d$, $90^\circ = 2d$, $135^\circ = 3d$, $180^\circ = 4d$).
  - Rectangular column and beam stirrup cutting length with $135^\circ$ seismic hooks ($2 \times 10d$).
- **Formwork & Centering**:
  - Contact surface area for slabs, beams, columns, footings, and retaining walls.
  - Plywood 8'x4' sheets count, shuttering oil, and Acrow props estimation.
- **Water Tank & Sump**:
  - Rectangular underground sump and cylindrical overhead tank volume.
  - Air-gap freeboard deduction for effective water capacity in Litres.
  - IS 1172 domestic demand sizing (135 LPCD residential standard).
- **Tamil Nadu Labour Productivity & Wages**:
  - Man-day outputs based on Tamil Nadu PWD Standard Data Book for masons, bar-benders, carpenters, painters, and helpers.

---

### 2. Tamil Nadu Material Price Intelligence
- **Sources**:
  - Official Tamil Nadu PWD Schedule of Rates (SOR 2025–26 effective July 22, 2025 & SOR 2024–25 effective July 15, 2024).
  - Market Dealer Benchmarks across Chennai and Tamil Nadu districts.
- **Tracked Materials**:
  - Cement (OPC 53, OPC 43, PPC per bag and MT).
  - TMT Steel (Primary Fe550D and Secondary Fe500 per MT).
  - M-Sand (Concreting grade) & P-Sand (Plastering grade) per cft and TN Unit (100 cft).
  - Blue Metal 20mm / 40mm Granite stone per cft and TN Unit.
  - Red country chamber bricks, fly-ash bricks, and AAC blocks.
  - Ready Mix Concrete (M20, M25 per m³).
- **Provenance & Freshness**:
  - Explicit badges: `Verified Recently` (<7d), `Older Reference` (7–30d), `Official SOR Reference`, `Stale Rate`.
  - Distinguishes basic PWD rates (excluding 18% GST) from retail market purchase rates.
  - Relative district indexing for Chennai, Coimbatore, Madurai, Salem, Trichy, Tirunelveli, Chengalpattu, etc.

---

### 3. Scrap Valuation & Settlement Engine
- **Tamil Nadu Scrap Benchmarks**:
  - Verified from LiveChennai (`livechennai.com/scrap_prices_Chennai.asp`) and Scraprates.in (`scraprates.in/state/tamil-nadu`).
  - Covers Heavy Melting Steel (HMS 1 & 2), Cast Iron, Copper DC (Armature wire), Copper OC (Mixed), Brass (Honey), Aluminium Section (Extrusion), Aluminium Utensil, Stainless Steel 304, Electrical wire, and Car Lead-Acid Batteries.
- **Settlement Calculator**:
  - Gross weighbridge weight minus vehicle tare weight.
  - Itemized deductions: Moisture %, Dirt/impurities %, Wire sheath PVC insulation recovery factor.
  - Handling, gas cutting, and transport expenses.
  - Net accepted material weight and final payable payout in INR (₹).

---

### 4. Bill of Quantities (BOQ) & Cost Estimation
- Separates physical quantities from commercial pricing.
- Itemized direct civil works breakdown.
- Commercial surcharges:
  - Site Overhead (5%)
  - Contractor Profit (10%)
  - Contingencies (3%)
  - Applicable GST (18% on civil works contracts)
- Revision tracking (v1, v2) with immutable SQLite persistence.
- Branded printable estimate sheet optimized for browser Print to PDF.

---

### 5. Pluggable AI Assistant with Offline Fallback
- Provider abstraction (`AiProvider`) supporting Google Gemini API.
- Strict security: API keys are maintained exclusively on the server (`process.env.GEMINI_API_KEY`) and never bundled in client code.
- Guardrails: AI is strictly prohibited from inventing material prices or arithmetic results; all calculations are executed by the deterministic engine.
- **Offline Civil Knowledge Engine**: Built-in deterministic expert system that answers IS 456, IS 1200, mix ratios, curing periods, and TN PWD norms even with zero internet or no API key.

---

### 6. Architecture & Tech Stack
- **Backend**: Node.js 26 ESM server (`server.js`) with zero heavy external dependencies.
- **Persistence**: Built-in `node:sqlite` for projects, estimates, scrap transactions, and audit logs.
- **Testing**: Built-in `node:test` runner.
- **Frontend**: Lightweight, mobile-first responsive PWA with bilingual support (English & Tamil தமிழ்).
- **Portability**: Runs reliably on Linux, Termux / Android, and Cloud VPS without native compilation failures.

---

## 🚀 Getting Started

### 1. Run Automated Test Suite
```bash
pnpm test
```
Executes 37 independent test cases verifying math, unit conversions, concrete mixes, RCC elements, masonry, BBS bend deductions, scrap valuations, and AI fallbacks.

### 2. Start the Server
```bash
pnpm start
```
Starts the server on `http://localhost:3000` (or `PORT` environment variable).

### 3. Optional: Configure Gemini API Key
To enable cloud AI capabilities, supply the key in the server environment:
```bash
export GEMINI_API_KEY="your-api-key"
pnpm start
```
If no key is configured, the system automatically uses the built-in deterministic civil expert engine.

---

## 📜 Standards & References
- **IS 456:2000**: Code of practice for plain and reinforced concrete.
- **IS 1200 (Parts 1 to 28)**: Method of measurement of building and civil engineering works.
- **IS 2502:1963**: Code of practice for bending and fixing of bars for concrete reinforcement.
- **IS 13920:2016**: Ductile design and detailing of reinforced concrete structures.
- **IS 1172:1993**: Code of basic requirements for water supply, drainage, and sanitation.
- **Tamil Nadu PWD Schedule of Rates (SOR 2025–2026)**: Volume I (PWD, Highways, WRD).
