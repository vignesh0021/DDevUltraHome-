/**
 * DDevUltraHome — Parametric 2D-to-3D Plan Studio & Interactive 3D Viewer
 * Browser & Mobile WebGL / Canvas2D High-Performance 3D Projection Canvas
 */

import { SafeMath } from '../engine/math.js';

export const ReviewState = {
  DRAFT: 'DRAFT',
  NEEDS_INPUT: 'NEEDS_INPUT',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  APPROVED_FOR_ESTIMATION: 'APPROVED_FOR_ESTIMATION'
};

export const DimensionProvenance = {
  EXTRACTED_CAD_TEXT: 'EXTRACTED_CAD_TEXT',
  USER_CONFIRMED: 'USER_CONFIRMED',
  PROVISIONAL_ASSUMPTION: 'PROVISIONAL_ASSUMPTION',
  OCR_PREDICTED: 'OCR_PREDICTED',
  ENGINEER_VALIDATED: 'ENGINEER_VALIDATED'
};

export class PlanStudio3D {
  constructor(options = {}) {
    this.projectName = options.projectName || 'Guindy Residence Project';
    this.floorHeightM = options.floorHeightM || 3.0;
    this.externalWallThicknessM = options.externalWallThicknessM || 0.23;
    this.internalWallThicknessM = options.internalWallThicknessM || 0.115;
    this.slabThicknessM = options.slabThicknessM || 0.125;
    this.reviewState = ReviewState.DRAFT;
    this.provenanceLog = [];
    this.elements = { walls: [], slabs: [], columns: [], footings: [], openings: [], rooms: [] };
    this.isConstructionReady = false;

    // 3D Rendering View State
    this.canvas = null;
    this.ctx = null;
    this.camera = {
      theta: 0.785, // 45 degrees azimuth
      phi: 0.55,    // ~31 degrees elevation
      zoom: 32,     // pixels per meter
      panX: 0,
      panY: 0
    };
    this.explodedOffsetM = 0.0;
    this.activeFloor = 'ALL'; // ALL, GROUND, FIRST, TERRACE
    this.isWireframe = false;
    this.isWalkthrough = false;
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };
  }

  /**
   * Build 3D parametric model from 2D rooms
   */
  buildModelFrom2DPlan(rooms = [], options = {}) {
    this.elements = { walls: [], slabs: [], columns: [], footings: [], openings: [], rooms: [] };

    const groundRooms = rooms.filter(r => (r.floor || '').includes('GROUND') || !r.floor || r.pageNumber === 1);
    const firstRooms = rooms.filter(r => (r.floor || '').includes('FIRST') || r.pageNumber === 2);

    let currentReview = ReviewState.DRAFT;
    if (rooms.some(r => r.requiresManualConfirmation || r.status === 'Requires Confirmation')) {
      currentReview = ReviewState.NEEDS_INPUT;
    }

    const groundLayout = this._arrangeFloorPlan(groundRooms, 0.0, 'GROUND_FLOOR');
    const firstLayout = firstRooms.length > 0 
      ? this._arrangeFloorPlan(firstRooms, this.floorHeightM, 'FIRST_FLOOR')
      : null;

    // Plinth Slab
    this.elements.slabs.push({
      id: 'SLAB-GF',
      level: 'GROUND_FLOOR',
      elevationM: 0.0,
      thicknessM: this.slabThicknessM,
      lengthM: groundLayout.boundingWidth,
      widthM: groundLayout.boundingDepth,
      areaM2: groundLayout.totalFloorAreaM2,
      provenance: DimensionProvenance.EXTRACTED_CAD_TEXT
    });

    // First Floor Slab
    const firstArea = firstLayout ? firstLayout.totalFloorAreaM2 : groundLayout.totalFloorAreaM2;
    this.elements.slabs.push({
      id: 'SLAB-FF',
      level: 'FIRST_FLOOR',
      elevationM: this.floorHeightM,
      thicknessM: this.slabThicknessM,
      lengthM: firstLayout ? firstLayout.boundingWidth : groundLayout.boundingWidth,
      widthM: firstLayout ? firstLayout.boundingDepth : groundLayout.boundingDepth,
      areaM2: firstArea,
      provenance: firstLayout ? DimensionProvenance.EXTRACTED_CAD_TEXT : DimensionProvenance.PROVISIONAL_ASSUMPTION
    });

    // Terrace Slab
    const numFloors = firstRooms.length > 0 ? 2 : 1;
    const terraceElevation = numFloors * this.floorHeightM;
    this.elements.slabs.push({
      id: 'SLAB-TERRACE',
      level: 'TERRACE',
      elevationM: terraceElevation,
      thicknessM: this.slabThicknessM,
      lengthM: groundLayout.boundingWidth,
      widthM: groundLayout.boundingDepth,
      areaM2: firstArea,
      provenance: DimensionProvenance.PROVISIONAL_ASSUMPTION,
      hasParapet: true,
      parapetHeightM: 0.90
    });

    this._generateStructuralGrid(groundLayout.boundingWidth, groundLayout.boundingDepth, numFloors);
    this.reviewState = currentReview;
    this.isConstructionReady = false;

    return {
      reviewState: this.reviewState,
      isConstructionReady: false,
      validation: this.validateGeometry(),
      totalBuiltupAreaM2: SafeMath.round(groundLayout.totalFloorAreaM2 + (firstLayout ? firstLayout.totalFloorAreaM2 : 0), 2),
      totalBuiltupAreaSqft: SafeMath.round((groundLayout.totalFloorAreaM2 + (firstLayout ? firstLayout.totalFloorAreaM2 : 0)) * 10.7639, 1),
      elementsSummary: {
        wallsCount: this.elements.walls.length,
        slabsCount: this.elements.slabs.length,
        columnsCount: this.elements.columns.length,
        footingsCount: this.elements.footings.length,
        openingsCount: this.elements.openings.length
      }
    };
  }

  _arrangeFloorPlan(floorRooms, baseElevationM, floorName) {
    let curX = 0;
    let curZ = 0;
    let maxZ = 0;
    let totalAreaM2 = 0;
    const positionedRooms = [];

    for (let i = 0; i < floorRooms.length; i++) {
      const r = floorRooms[i];
      const lengthM = parseFloat(r.lengthM) || SafeMath.round((r.lengthFt || 10) * 0.3048, 2);
      const widthM = parseFloat(r.widthM) || SafeMath.round((r.widthFt || 10) * 0.3048, 2);
      const areaM2 = SafeMath.round(lengthM * widthM, 2);
      totalAreaM2 += areaM2;

      const roomEntry = {
        id: `3D-RM-${floorName}-${i + 1}`,
        name: r.name || `Room ${i + 1}`,
        floor: floorName,
        x: curX,
        y: baseElevationM,
        z: curZ,
        lengthM,
        widthM,
        heightM: this.floorHeightM,
        areaM2,
        areaSqft: SafeMath.round(areaM2 * 10.7639, 1),
        provenance: r.requiresManualConfirmation ? DimensionProvenance.PROVISIONAL_ASSUMPTION : DimensionProvenance.EXTRACTED_CAD_TEXT
      };

      positionedRooms.push(roomEntry);
      this.elements.rooms.push(roomEntry);
      this._createRoomWalls(roomEntry);

      curX += lengthM;
      if (widthM > maxZ) maxZ = widthM;
      if (curX > 10.0 && i < floorRooms.length - 1) {
        curX = 0;
        curZ += maxZ;
        maxZ = 0;
      }
    }

    const boundingWidth = Math.max(curX, 6.0);
    const boundingDepth = Math.max(curZ + maxZ, 6.0);

    return {
      boundingWidth: SafeMath.round(boundingWidth, 2),
      boundingDepth: SafeMath.round(boundingDepth, 2),
      totalFloorAreaM2: SafeMath.round(totalAreaM2, 2)
    };
  }

  _createRoomWalls(room) {
    const { x, y, z, lengthM, widthM, heightM, floor } = room;
    const wallsConfig = [
      { id: `${room.id}-WN`, x1: x, z1: z, x2: x + lengthM, z2: z, thickness: this.externalWallThicknessM, isExternal: true },
      { id: `${room.id}-WS`, x1: x, z1: z + widthM, x2: x + lengthM, z2: z + widthM, thickness: this.externalWallThicknessM, isExternal: true },
      { id: `${room.id}-WW`, x1: x, z1: z, x2: x, z2: z + widthM, thickness: this.internalWallThicknessM, isExternal: false },
      { id: `${room.id}-WE`, x1: x + lengthM, z1: z, x2: x + lengthM, z2: z + widthM, thickness: this.internalWallThicknessM, isExternal: false }
    ];

    for (const w of wallsConfig) {
      const len = SafeMath.round(Math.hypot(w.x2 - w.x1, w.z2 - w.z1), 2);
      const wallEntry = {
        id: w.id,
        roomId: room.id,
        roomName: room.name,
        floor,
        x1: w.x1,
        y1: y,
        z1: w.z1,
        x2: w.x2,
        y2: y,
        z2: w.z2,
        lengthM: len,
        heightM,
        thicknessM: w.thickness,
        isExternal: w.isExternal,
        grossAreaM2: SafeMath.round(len * heightM, 2),
        volumeM3: SafeMath.round(len * heightM * w.thickness, 3),
        provenance: room.provenance
      };

      this.elements.walls.push(wallEntry);

      if (!w.isExternal && this.elements.openings.filter(o => o.roomId === room.id && o.type === 'DOOR').length === 0) {
        this.elements.openings.push({
          id: `OP-DOOR-${room.id}`,
          roomId: room.id,
          wallId: w.id,
          type: 'DOOR',
          widthM: 0.90,
          heightM: 2.10,
          sillM: 0.0,
          lintelM: 2.10,
          areaM2: 1.89,
          floor
        });
      }

      if (w.isExternal && this.elements.openings.filter(o => o.roomId === room.id && o.type === 'WINDOW').length === 0) {
        this.elements.openings.push({
          id: `OP-WIN-${room.id}`,
          roomId: room.id,
          wallId: w.id,
          type: 'WINDOW',
          widthM: 1.20,
          heightM: 1.20,
          sillM: 0.90,
          lintelM: 2.10,
          areaM2: 1.44,
          floor
        });
      }
    }
  }

  _generateStructuralGrid(spanX, spanZ, numFloors) {
    const spacingX = Math.max(3.0, spanX / 3);
    const spacingZ = Math.max(3.0, spanZ / 2);
    let colId = 1;
    for (let x = 0; x <= spanX + 0.1; x += spacingX) {
      for (let z = 0; z <= spanZ + 0.1; z += spacingZ) {
        const posX = SafeMath.round(x, 2);
        const posZ = SafeMath.round(z, 2);
        const totalColHeight = (numFloors * this.floorHeightM) + 1.2;

        this.elements.columns.push({
          id: `C${colId}`,
          x: posX,
          y: -1.2,
          z: posZ,
          widthM: 0.23,
          depthM: 0.38,
          heightM: SafeMath.round(totalColHeight, 2),
          volumeM3: SafeMath.round(0.23 * 0.38 * totalColHeight, 3),
          reinforcement: '8 Nos 16mm Fe550D TMT',
          provenance: DimensionProvenance.PROVISIONAL_ASSUMPTION
        });

        this.elements.footings.push({
          id: `F${colId}`,
          columnRef: `C${colId}`,
          x: posX,
          y: -1.5,
          z: posZ,
          lengthM: 1.50,
          widthM: 1.50,
          depthM: 0.45,
          volumeM3: SafeMath.round(1.50 * 1.50 * 0.45, 3),
          provenance: DimensionProvenance.PROVISIONAL_ASSUMPTION
        });

        colId++;
      }
    }
  }

  validateGeometry() {
    const errors = [];
    const warnings = [];
    if (this.elements.rooms.length === 0) {
      errors.push('No rooms defined in 3D model.');
      return { isValid: false, errors, warnings, areaDiscrepancyPct: 0 };
    }

    for (const r of this.elements.rooms) {
      if (r.lengthM <= 0.5 || r.widthM <= 0.5) errors.push(`Room ${r.name} has invalid dimensions`);
      if (r.areaM2 <= 0) errors.push(`Room ${r.name} has zero area`);
    }

    const totalRoomArea = this.elements.rooms.reduce((acc, r) => acc + r.areaM2, 0);
    const mainSlab = this.elements.slabs.find(s => s.id === 'SLAB-GF');
    let discrepancyPct = 0;
    if (mainSlab && mainSlab.areaM2 > 0) {
      discrepancyPct = Math.abs((totalRoomArea - mainSlab.areaM2) / mainSlab.areaM2) * 100;
      if (discrepancyPct > 5.0) {
        warnings.push(`Area discrepancy: 3D rooms (${SafeMath.round(totalRoomArea, 1)} m²) vs envelope (${SafeMath.round(mainSlab.areaM2, 1)} m²) is ${SafeMath.round(discrepancyPct, 1)}%`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      areaDiscrepancyPct: SafeMath.round(discrepancyPct, 2)
    };
  }

  computeQuantities() {
    let extBrickM3 = 0, intBrickM3 = 0, totalPlasterM2 = 0, totalFloorM2 = 0;
    for (const w of this.elements.walls) {
      if (w.isExternal) extBrickM3 += w.volumeM3;
      else intBrickM3 += w.volumeM3;
      totalPlasterM2 += (w.grossAreaM2 * 2);
    }

    for (const op of this.elements.openings) {
      const vol = op.areaM2 * (op.type === 'DOOR' ? this.internalWallThicknessM : this.externalWallThicknessM);
      if (op.type === 'DOOR') intBrickM3 = Math.max(0, intBrickM3 - vol);
      if (op.type === 'WINDOW') extBrickM3 = Math.max(0, extBrickM3 - vol);
      totalPlasterM2 -= (op.areaM2 * 2);
    }

    for (const r of this.elements.rooms) {
      totalFloorM2 += r.areaM2;
      totalPlasterM2 += r.areaM2;
    }

    const slabM3 = this.elements.slabs.reduce((acc, s) => acc + (s.areaM2 * s.thicknessM), 0);
    const colM3 = this.elements.columns.reduce((acc, c) => acc + c.volumeM3, 0);
    const footM3 = this.elements.footings.reduce((acc, f) => acc + f.volumeM3, 0);
    const beamLenM = this.elements.walls.reduce((acc, w) => acc + w.lengthM, 0) / 2;
    const beamM3 = beamLenM * 0.23 * 0.38;
    const totalRccM3 = slabM3 + colM3 + footM3 + beamM3;
    const steelKg = totalRccM3 * 95.0;

    return {
      externalBrickworkM3: SafeMath.round(extBrickM3, 2),
      internalBrickworkM3: SafeMath.round(intBrickM3, 2),
      totalBrickworkM3: SafeMath.round(extBrickM3 + intBrickM3, 2),
      internalPlasteringM2: SafeMath.round(totalPlasterM2 * 0.70, 2),
      externalPlasteringM2: SafeMath.round(totalPlasterM2 * 0.30, 2),
      flooringTilingM2: SafeMath.round(totalFloorM2, 2),
      slabConcreteM3: SafeMath.round(slabM3, 2),
      columnConcreteM3: SafeMath.round(colM3, 2),
      footingConcreteM3: SafeMath.round(footM3, 2),
      beamConcreteM3: SafeMath.round(beamM3, 2),
      totalRccConcreteM3: SafeMath.round(totalRccM3, 2),
      reinforcementSteelKg: SafeMath.round(steelKg, 1),
      reinforcementSteelTonne: SafeMath.round(steelKg / 1000, 2)
    };
  }

  // --- Interactive 3D Canvas Projection Renderer ---

  attachCanvas(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this._bindControls();
    this.render();
  }

  _bindControls() {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.lastMouse = { x: e.clientX, y: e.clientY };

      if (e.shiftKey) {
        this.camera.panX += dx;
        this.camera.panY += dy;
      } else {
        this.camera.theta += dx * 0.01;
        this.camera.phi = Math.max(0.1, Math.min(Math.PI / 2.1, this.camera.phi + dy * 0.01));
      }
      this.render();
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.camera.zoom = Math.max(10, Math.min(100, this.camera.zoom * zoomFactor));
      this.render();
    }, { passive: false });

    // Touch events for mobile
    let touchStartDist = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        touchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.lastMouse.x;
        const dy = e.touches[0].clientY - this.lastMouse.y;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.camera.theta += dx * 0.015;
        this.camera.phi = Math.max(0.1, Math.min(Math.PI / 2.1, this.camera.phi + dy * 0.015));
        this.render();
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const factor = dist / touchStartDist;
        this.camera.zoom = Math.max(10, Math.min(100, this.camera.zoom * factor));
        touchStartDist = dist;
        this.render();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
      touchStartDist = 0;
    });
  }

  resetView() {
    this.camera = { theta: 0.785, phi: 0.55, zoom: 32, panX: 0, panY: 0 };
    this.explodedOffsetM = 0.0;
    this.activeFloor = 'ALL';
    this.isWireframe = false;
    this.render();
  }

  setExplodedOffset(meters) {
    this.explodedOffsetM = Math.max(0, Math.min(3.0, parseFloat(meters) || 0));
    this.render();
  }

  setActiveFloor(floorName) {
    this.activeFloor = floorName;
    this.render();
  }

  toggleWireframe() {
    this.isWireframe = !this.isWireframe;
    this.render();
  }

  /**
   * Project 3D point (X, Y, Z) in meters to 2D canvas coordinates
   */
  projectPoint(x, y, z) {
    if (!this.canvas) return { x: 0, y: 0, depth: 0 };
    const cx = this.canvas.width / 2 + this.camera.panX;
    const cy = this.canvas.height / 2 + this.camera.panY;

    // Center model around (5, 0, 5)
    const mx = x - 5.0;
    const my = y;
    const mz = z - 5.0;

    // Rotate around Y axis (azimuth theta)
    const cosT = Math.cos(this.camera.theta);
    const sinT = Math.sin(this.camera.theta);
    const rx = mx * cosT - mz * sinT;
    const rz = mx * sinT + mz * cosT;

    // Rotate around X axis (elevation phi)
    const cosP = Math.cos(this.camera.phi);
    const sinP = Math.sin(this.camera.phi);
    const ry = my * cosP - rz * sinP;
    const depth = my * sinP + rz * cosP;

    // Perspective / Isometric scaling
    const scale = this.camera.zoom;
    const screenX = cx + rx * scale;
    const screenY = cy - ry * scale;

    return { x: screenX, y: screenY, depth };
  }

  /**
   * Render complete 3D scene
   */
  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dark engineering blueprint background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Draw Ground Grid
    this._renderGrid(ctx);

    // Collect 3D primitives and sort by depth (Painter's algorithm)
    const primitives = [];

    // Footings
    if (this.activeFloor === 'ALL' || this.activeFloor === 'GROUND') {
      for (const f of this.elements.footings) {
        primitives.push(this._createBoxPrimitive(f.x - 0.75, f.y, f.z - 0.75, f.lengthM, f.depthM, f.widthM, '#475569', '#334155'));
      }
    }

    // Columns
    for (const c of this.elements.columns) {
      if (this.activeFloor === 'ALL' || (this.activeFloor === 'GROUND' && c.y <= 0)) {
        primitives.push(this._createBoxPrimitive(c.x - 0.115, c.y, c.z - 0.19, c.widthM, c.heightM, c.depthM, '#64748b', '#475569'));
      }
    }

    // Slabs with exploded offset
    for (const s of this.elements.slabs) {
      let elev = s.elevationM;
      if (s.level === 'FIRST_FLOOR') elev += this.explodedOffsetM * 1.5;
      if (s.level === 'TERRACE') elev += this.explodedOffsetM * 3.0;

      if (this.activeFloor === 'ALL' || (this.activeFloor === 'GROUND' && s.level === 'GROUND_FLOOR') || (this.activeFloor === 'FIRST' && s.level === 'FIRST_FLOOR')) {
        primitives.push(this._createBoxPrimitive(0, elev, 0, s.lengthM, s.thicknessM, s.widthM, '#38bdf8', '#0284c7'));
      }
    }

    // Walls with exploded offset
    for (const wall of this.elements.walls) {
      let elev = wall.y1;
      if (wall.floor === 'FIRST_FLOOR') elev += this.explodedOffsetM * 1.5;

      const shouldShow = this.activeFloor === 'ALL' || 
        (this.activeFloor === 'GROUND' && wall.floor === 'GROUND_FLOOR') || 
        (this.activeFloor === 'FIRST' && wall.floor === 'FIRST_FLOOR');

      if (shouldShow) {
        const color = wall.isExternal ? '#d97706' : '#e2e8f0';
        const strokeColor = wall.isExternal ? '#b45309' : '#94a3b8';
        primitives.push(this._createWallPrimitive(wall, elev, color, strokeColor));
      }
    }

    // Sort by depth (farthest first)
    primitives.sort((a, b) => b.depth - a.depth);

    // Draw primitives
    for (const p of primitives) {
      this._drawPoly(ctx, p.pts, p.color, p.stroke);
    }

    // Draw HUD / Review Gate Badge
    this._renderHUD(ctx);
  }

  _renderGrid(ctx) {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = -10; x <= 20; x += 2) {
      const p1 = this.projectPoint(x, 0, -10);
      const p2 = this.projectPoint(x, 0, 20);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let z = -10; z <= 20; z += 2) {
      const p1 = this.projectPoint(-10, 0, z);
      const p2 = this.projectPoint(20, 0, z);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  _createBoxPrimitive(x, y, z, dx, dy, dz, color, stroke) {
    const p1 = this.projectPoint(x, y, z);
    const p2 = this.projectPoint(x + dx, y, z);
    const p3 = this.projectPoint(x + dx, y + dy, z);
    const p4 = this.projectPoint(x, y + dy, z);
    const p5 = this.projectPoint(x, y, z + dz);
    const p6 = this.projectPoint(x + dx, y, z + dz);
    const p7 = this.projectPoint(x + dx, y + dy, z + dz);
    const p8 = this.projectPoint(x, y + dy, z + dz);

    const avgDepth = (p1.depth + p7.depth) / 2;
    return {
      pts: [p1, p2, p3, p4, p8, p7, p6, p5],
      depth: avgDepth,
      color: this.isWireframe ? 'transparent' : color,
      stroke
    };
  }

  _createWallPrimitive(wall, elev, color, stroke) {
    const p1 = this.projectPoint(wall.x1, elev, wall.z1);
    const p2 = this.projectPoint(wall.x2, elev, wall.z2);
    const p3 = this.projectPoint(wall.x2, elev + wall.heightM, wall.z2);
    const p4 = this.projectPoint(wall.x1, elev + wall.heightM, wall.z1);

    const avgDepth = (p1.depth + p3.depth) / 2;
    return {
      pts: [p1, p2, p3, p4],
      depth: avgDepth,
      color: this.isWireframe ? 'transparent' : color,
      stroke
    };
  }

  _drawPoly(ctx, pts, fillColor, strokeColor) {
    if (!pts || pts.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();

    if (fillColor !== 'transparent') {
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    ctx.strokeStyle = strokeColor || '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  _renderHUD(ctx) {
    // Review Gate badge
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`Review Gate: ${this.reviewState}`, 16, 26);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Floor: ${this.activeFloor} • Explode: ${this.explodedOffsetM.toFixed(1)}m • Orbit: Click & Drag`, 16, 44);

    if (this.isConstructionReady) {
      ctx.fillStyle = '#22c55e';
      ctx.fillText(`Construction-Ready (Certified)`, 16, 62);
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`⚠️ Not Construction-Ready (Draft Takeoff)`, 16, 62);
    }
  }

  generateSnapshot() {
    if (!this.canvas) return null;
    return this.canvas.toDataURL('image/png');
  }
}
