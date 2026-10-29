# DDevUltraHome — Open-Source PDF-to-3D Plan Viewer Audit & Integration Strategy

**Document Version**: 1.0.0  
**Audit Timestamp**: 2026-10-29T01:15:00Z  
**Branch**: `feature/open-source-3d-plan-viewer`  
**Starting Commit**: `10be86a`  
**Target Repository**: `https://github.com/vignesh0021/DDevUltraHome-`  

---

## 1. Candidate Repository Audit

### 1.1 Candidate A: OpenPlan3D (`laanlabs/openPlan3D`)
- **Repository URL**: `https://github.com/laanlabs/openPlan3D`
- **License**: **MIT License** (Fully open-source, permissive, commercial use allowed).
- **Technology Stack**: SvelteKit, TypeScript, Three.js (`three`), OrbitControls, PointerLockControls.
- **Architectural Strengths**:
  1. **Clean Geometric Algorithms**:
     - `wallProfiles.ts`: True wall opening subtraction algorithm (`buildWallSegments`, `segmentsAroundOpenings`, `openingOnWall`). Subdivides walls into left, right, sill-bottom, and lintel-top segments around doors and windows.
     - `roomSlabGeometry.ts`: Extruded room slab surfaces from closed room boundary polygons.
     - `floorStack.ts`: Multi-floor vertical assembly, elevation offsets, and exploded floor view.
  2. **Interchange Schema**: Clean, well-documented `FloorPlan` JSON schema with `floors: [{ walls, rooms, doors, windows }]`.
  3. **Zero Backend Required**: Runs 100% client-side in the browser / WebView, matching DDevUltraHome's privacy-first, offline Android requirement.
- **Integration Feasibility**: **Very High**. While embedding the entire SvelteKit application wholesale would bloat the build, adapting OpenPlan3D's documented JSON schema, geometric algorithms, and Three.js viewer architecture into a standalone ESM module integrates seamlessly into DDevUltraHome without modifying existing frameworks or violating Termux package constraints.

---

### 1.2 Candidate B: FloorViz (`Shital-P276/FloorViz`)
- **Repository URL**: `https://github.com/Shital-P276/FloorViz`
- **License**: **NO LICENSE** (`license: null`, default copyright law applies; unauthorized code reuse constitutes copyright infringement).
- **Technology Stack**: Python, FastAPI, OpenCV (`opencv-python-headless`), `pdf2image`, `poppler` (native C++), `ezdxf`, `shapely`.
- **Architectural Weaknesses**:
  1. **Heavy Server-Side Dependencies**: Requires a cloud Python server running OpenCV and Poppler C++ binaries. Cannot execute client-side inside a Capacitor Android APK.
  2. **Privacy & Security Risk**: Uploading private architectural drawings to an external Python server violates the local-first security requirement ("Keep uploaded drawings local by default").
  3. **Unlicensed**: No open-source license provided by the author.
- **Integration Feasibility**: **REJECTED**. Violates licensing, security, and offline Android standalone requirements.

---

## 2. Selection Rationale: Strategy A/C

Based on the audit, **Strategy A/C** is selected:
1. **Normalized Floor-Plan JSON Schema**: Adopt the OpenPlan3D `FloorPlan` JSON specification for full portability, editability, and serialization.
2. **OpenPlan3D Geometric Algorithms**: Adapt OpenPlan3D's `buildWallSegments` and `roomSlabGeometry` algorithms to generate genuine 3D wall apertures for doors and windows (not decorative decals).
3. **Three.js Standalone Viewer**: Implement a responsive Three.js viewer in pure ESM (`ThreePlanViewer`) equipped with:
   - **Dollhouse 3D Mode**: 45° isometric perspective view.
   - **2D Plan Mode**: Top-down orthogonal view with room labels and dimension callouts.
   - **Walkthrough Mode**: First-person camera at 1.6m eye-height.
   - **Floor Level Isolation**: Independent inspection of Ground Floor and First Floor.
   - **Exploded Floor Slider**: $0.0\text{m} - 2.5\text{m}$ vertical floor separation.
   - **Element Inspector**: Raycast click selection showing element ID, dimensions, area, source page, and provenance.
   - **Restrained Architectural Palette**: Off-white plaster walls, natural timber door frames, tinted glass windows, neutral stone/slate slabs.

---

## 3. Root Cause Analysis: Previous Projection Defect

The previous 3D projection suffered from two critical defects visible in the screenshot:
1. **Unexplained Repeated Orange Panels**:
   - In `_createRoomWalls`, every room generated 4 independent wall boxes without checking for shared boundaries.
   - Adjacent rooms generated duplicate overlapping walls at the same $(x, z)$ coordinates.
   - All external walls were hardcoded with saturated orange `#d97706`, creating dense clusters of orange slabs.
2. **Floating Supports and Base Plates**:
   - `_generateStructuralGrid` ran a synthetic grid loop `for (let x = 0; x <= spanX; x += spacingX)` that programmatically invented structural columns from $y = -1.2\text{m}$ and isolated footings at $y = -1.5\text{m}$.
   - Because no structural drawings existed, these elements hovered ungrounded beneath the building envelope as "floating supports and base plates".

**Resolution in this Milestone**:
- **Completely removed `_generateStructuralGrid`**. No invented structural columns, footings, or base plates will be generated.
- **Implemented shared wall deduplication**. Adjacent rooms sharing a boundary generate a single 115mm interior wall.
- **Architectural Material Palette**: Saturated orange is replaced by clean off-white plaster (`#f8fafc`), warm interior white (`#f1f5f9`), natural wood timber (`#92400e`), and translucent architectural glass (`#38bdf8`).

---

## 4. Guindy Residence Fixture Analysis (`JAS - GUINDY RESIDENCE - SCHEME R0 24042026.pdf`)

The drawing contains explicit CAD text positions:
- **Sheet 1 (Ground Floor)**:
  - `Parking`: $20'\text{-}0" \times 17'\text{-}0"$ ($6.10\text{m} \times 5.18\text{m}$, 340 sq.ft) at front (South)
  - `Foyer`: $10'\text{-}10" \times 6'\text{-}8"$ ($3.30\text{m} \times 2.03\text{m}$, 72.2 sq.ft)
  - `Staircase`: $8'\text{-}5" \times 6'\text{-}0"$ ($2.57\text{m} \times 1.83\text{m}$, 50.5 sq.ft)
  - `Living & Dining`: $9'\text{-}1" \times 19'\text{-}9"$ ($2.77\text{m} \times 6.02\text{m}$, 179.4 sq.ft)
  - `Kitchen`: $7'\text{-}0" \times 6'\text{-}0"$ ($2.13\text{m} \times 1.83\text{m}$, 42.0 sq.ft)
  - `Bedroom`: $9'\text{-}0" \times 9'\text{-}0"$ ($2.74\text{m} \times 2.74\text{m}$, 81.0 sq.ft)
  - `Toilet`: $7'\text{-}0" \times 4'\text{-}0"$ ($2.13\text{m} \times 1.22\text{m}$, 28.0 sq.ft)
- **Sheet 2 (First Floor)**:
  - `Bedroom 02`: $9'\text{-}0" \times 9'\text{-}0"$ ($2.74\text{m} \times 2.74\text{m}$, 81.0 sq.ft)
  - `Toilet`: $9'\text{-}0" \times 4'\text{-}0"$ ($2.74\text{m} \times 1.22\text{m}$, 36.0 sq.ft)
  - Open terrace / balcony areas
- **CAD Restrictions Enforced**:
  - Drawing Note 2 explicitly mandates: *"Drawings should not be scaled for obtaining dimensions."*
  - All geometry is constructed strictly from written dimensions, with pixel scaling restricted.
