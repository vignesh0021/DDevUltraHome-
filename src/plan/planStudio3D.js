/**
 * DDevUltraHome — Parametric 2D-to-3D Plan Studio & OpenPlan3D Model Engine
 * Replaces poor custom projection with normalized OpenPlan3D schema,
 * wall aperture cutouts, and zero invented structural elements.
 */

import { SafeMath } from '../engine/math.js';
import { OpenPlanSchema, ReviewState, DimensionProvenance } from './openPlanSchema.js';

export { ReviewState, DimensionProvenance };

export class PlanStudio3D {
  constructor(options = {}) {
    this.projectName = options.projectName || 'Guindy Residence Project';
    this.floorHeightM = options.floorHeightM || 2.80; // Standard ceiling height
    this.externalWallThicknessM = options.externalWallThicknessM || 0.23; // 230mm brick wall
    this.internalWallThicknessM = options.internalWallThicknessM || 0.115; // 115mm partition wall
    this.slabThicknessM = options.slabThicknessM || 0.15; // 150mm slab
    this.reviewState = ReviewState.DRAFT;
    this.provenanceLog = [];
    this.isConstructionReady = false; // Strictly non-negotiable

    // OpenPlan3D Normalized Floor-Plan Data
    this.floorPlan = null;
    this.elements = {
      walls: [],
      slabs: [],
      rooms: [],
      doors: [],
      windows: [],
      columns: [],
      footings: []
    };

    // View States
    this.activeFloor = 'ALL'; // ALL, GROUND, FIRST
    this.viewMode = 'DOLLHOUSE'; // DOLLHOUSE, PLAN, WALKTHROUGH
    this.explodedOffsetM = 0.0;
    this.isWireframe = false;
    this.selectedElement = null;

    // Viewport & Rendering (initialized on attachCanvas in browser)
    this.canvas = null;
    this.ctx = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
  }

  /**
   * Build 3D parametric model from 2D architectural rooms using OpenPlan3D schema
   * @param {Array<Object>} rooms - Room takeoffs from 2D plan
   * @param {Object} [options]
   */
  buildModelFrom2DPlan(rooms = [], options = {}) {
    this.elements = {
      walls: [],
      slabs: [],
      rooms: [],
      doors: [],
      windows: [],
      columns: [],
      footings: []
    };
    this.provenanceLog = [];

    // 1. Build Normalized OpenPlan3D model
    this.floorPlan = OpenPlanSchema.toOpenPlanModel(rooms, {
      projectName: this.projectName,
      floorHeightM: this.floorHeightM,
      externalWallThicknessM: this.externalWallThicknessM,
      internalWallThicknessM: this.internalWallThicknessM,
      slabThicknessM: this.slabThicknessM,
      ...options
    });

    // 2. Extract and index elements
    this.floorPlan.floors.forEach(floor => {
      // Walls
      floor.walls.forEach(w => {
        this.elements.walls.push({
          id: w.id,
          floorId: floor.id,
          floor: floor.level === 0 ? 'GROUND_FLOOR' : (floor.level === 1 ? 'FIRST_FLOOR' : (floor.level === 2 ? 'SECOND_FLOOR' : `FLOOR_${floor.level}`)),
          start: w.start,
          end: w.end,
          lengthM: w.lengthM,
          heightM: w.heightM,
          thicknessM: w.thicknessM,
          isExternal: w.isExternal,
          elevationM: floor.elevationM,
          color: w.color,
          sharedRooms: w.sharedRooms
        });
      });

      // Rooms
      floor.rooms.forEach(rm => {
        this.elements.rooms.push({
          id: rm.id,
          floorId: floor.id,
          floor: rm.floor,
          name: rm.name,
          x: rm.x,
          z: rm.z,
          lengthM: rm.lengthM,
          widthM: rm.widthM,
          areaM2: rm.areaM2,
          areaSqft: rm.areaSqft,
          perimeterM: rm.perimeterM,
          walls: rm.walls,
          polygon: rm.polygon,
          elevationM: floor.elevationM,
          color: rm.color,
          provenance: rm.provenance
        });

        // Floor surface slab for room
        this.elements.slabs.push({
          id: `SLAB-${rm.id}`,
          roomId: rm.id,
          name: `${rm.name} Floor Surface`,
          level: floor.name,
          elevationM: floor.elevationM,
          thicknessM: floor.slabThicknessM,
          lengthM: rm.lengthM,
          widthM: rm.widthM,
          areaM2: rm.areaM2,
          color: rm.color
        });
      });

      // Doors and Windows
      floor.doors.forEach(d => {
        this.elements.doors.push({
          id: d.id,
          roomId: d.roomId,
          wallId: d.wallId,
          position: d.position,
          widthM: d.widthM,
          heightM: d.heightM,
          floor: floor.level === 0 ? 'GROUND_FLOOR' : 'FIRST_FLOOR'
        });
      });

      floor.windows.forEach(win => {
        this.elements.windows.push({
          id: win.id,
          roomId: win.roomId,
          wallId: win.wallId,
          position: win.position,
          widthM: win.widthM,
          heightM: win.heightM,
          sillHeightM: win.sillHeightM,
          floor: floor.level === 0 ? 'GROUND_FLOOR' : 'FIRST_FLOOR'
        });
      });
    });

    // 3. Strictly NO INVENTED COLUMNS OR FOOTINGS
    // If structural schedules were explicitly supplied in options.schedules, link them
    if (Array.isArray(options.schedules) && options.schedules.length > 0) {
      options.schedules.filter(s => s.category === 'COLUMN').forEach(c => {
        this.elements.columns.push({
          id: c.code || `COL-${this.elements.columns.length + 1}`,
          widthM: c.widthM || 0.23,
          depthM: c.depthM || 0.45,
          heightM: this.floorHeightM,
          provenance: DimensionProvenance.EXTRACTED_CAD_TEXT
        });
      });
    }

    // Set Review Gate based on inputs
    const hasUnconfirmed = rooms.some(r => r.requiresManualConfirmation || r.status === 'Requires Confirmation');
    if (hasUnconfirmed) {
      this.reviewState = ReviewState.NEEDS_INPUT;
    } else {
      this.reviewState = ReviewState.DRAFT;
    }
    this.isConstructionReady = false;

    const quantities = OpenPlanSchema.deriveQuantitiesFromOpenPlan(this.floorPlan);

    return {
      reviewState: this.reviewState,
      isConstructionReady: false,
      validation: this.validateGeometry(),
      totalBuiltupAreaM2: quantities.totalBuiltupAreaM2,
      totalBuiltupAreaSqft: quantities.totalBuiltupAreaSqft,
      elementsSummary: {
        wallsCount: this.elements.walls.length,
        slabsCount: this.elements.slabs.length,
        roomsCount: this.elements.rooms.length,
        doorsCount: this.elements.doors.length,
        windowsCount: this.elements.windows.length,
        columnsCount: this.elements.columns.length,
        footingsCount: this.elements.footings.length
      },
      quantities
    };
  }

  /**
   * Set Review Gate state with audit logging
   * @param {string} newState
   * @param {string} [reason]
   */
  setReviewGate(newState, reason = '') {
    if (!Object.values(ReviewState).includes(newState)) {
      throw new Error(`Invalid review state: ${newState}. Allowed: ${Object.values(ReviewState).join(', ')}`);
    }

    this.provenanceLog.push({
      timestamp: new Date().toISOString(),
      previousState: this.reviewState,
      newState,
      reason,
      isConstructionReady: false
    });

    this.reviewState = newState;
    this.isConstructionReady = false; // Strictly non-negotiable without PE sign-off
    return this.reviewState;
  }

  /**
   * Set View Mode: DOLLHOUSE, PLAN, WALKTHROUGH
   */
  setViewMode(mode) {
    if (['DOLLHOUSE', 'PLAN', 'WALKTHROUGH'].includes(mode)) {
      this.viewMode = mode;
      this.render();
    }
  }

  /**
   * Set Active Floor filter: ALL, GROUND, FIRST
   */
  setActiveFloor(floor) {
    this.activeFloor = floor;
    this.render();
  }

  /**
   * Set Exploded Floor Offset in meters (0 to 2.5m)
   */
  setExplodedView(offsetM) {
    this.explodedOffsetM = Math.max(0, Math.min(2.5, parseFloat(offsetM) || 0));
    this.render();
  }

  /**
   * Toggle Wireframe mode
   */
  toggleWireframe(enabled) {
    this.isWireframe = enabled !== undefined ? enabled : !this.isWireframe;
    this.render();
  }

  /**
   * Reset Camera view
   */
  resetView() {
    this.explodedOffsetM = 0.0;
    this.activeFloor = 'ALL';
    this.isWireframe = false;
    this.viewMode = 'DOLLHOUSE';
    this.selectedElement = null;
    this.render();
  }

  /**
   * Fit camera to visible model bounds
   */
  fitToModel() {
    this.render();
  }

  /**
   * Validate geometry consistency
   */
  validateGeometry() {
    const errors = [];
    const warnings = [];

    if (!this.floorPlan) {
      return { isValid: false, errors: ['No floor plan model built'] };
    }

    const planVal = OpenPlanSchema.validateFloorPlan(this.floorPlan);
    if (!planVal.valid) {
      errors.push(...planVal.errors);
    }

    // Verify rooms have positive dimensions
    this.elements.rooms.forEach(rm => {
      if (rm.lengthM <= 0 || rm.widthM <= 0) {
        errors.push(`Room "${rm.name}" has invalid dimensions: ${rm.lengthM}m x ${rm.widthM}m`);
      }
      if (rm.areaM2 <= 0) {
        errors.push(`Room "${rm.name}" has zero area`);
      }
    });

    // Check for wall thickness compliance
    this.elements.walls.forEach(w => {
      if (w.isExternal && w.thicknessM < 0.20) {
        warnings.push(`External wall ${w.id} is thinner than standard 230mm brick wall`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      checkedAt: new Date().toISOString()
    };
  }

  /**
   * Compute civil quantities directly from 3D model geometry
   */
  computeQuantities() {
    if (!this.floorPlan) {
      return {
        totalBrickworkM3: 0,
        internalPlasteringM2: 0,
        externalPlasteringM2: 0,
        totalRccConcreteM3: 0,
        reinforcementSteelKg: 0,
        flooringTilingM2: 0
      };
    }

    const qty = OpenPlanSchema.deriveQuantitiesFromOpenPlan(this.floorPlan);

    // Derived structural quantities for residential G+1
    const totalBrickworkM3 = SafeMath.round(qty.externalBrickworkVolumeM3 + qty.internalBrickworkVolumeM3, 2);
    const internalPlasteringM2 = SafeMath.round(qty.totalPlasterAreaM2 * 0.70, 2);
    const externalPlasteringM2 = SafeMath.round(qty.totalPlasterAreaM2 * 0.30, 2);
    const flooringTilingM2 = SafeMath.round(qty.totalCarpetAreaM2, 2);

    // Roof & Floor Slabs (150mm RCC)
    const slabConcreteM3 = SafeMath.round(qty.totalBuiltupAreaM2 * this.slabThicknessM, 2);
    const totalRccConcreteM3 = SafeMath.round(slabConcreteM3 * 1.35, 2); // Includes plinth beams
    const reinforcementSteelKg = SafeMath.round(totalRccConcreteM3 * 80, 1); // ~80kg steel/m3 residential concrete

    return {
      totalCarpetAreaSqft: qty.totalCarpetAreaSqft,
      totalBuiltupAreaSqft: qty.totalBuiltupAreaSqft,
      totalCarpetAreaM2: qty.totalCarpetAreaM2,
      totalBuiltupAreaM2: qty.totalBuiltupAreaM2,
      externalBrickworkM3: qty.externalBrickworkVolumeM3,
      internalBrickworkM3: qty.internalBrickworkVolumeM3,
      totalBrickworkM3,
      internalPlasteringM2,
      externalPlasteringM2,
      totalPlasteringM2: qty.totalPlasterAreaM2,
      flooringTilingM2,
      slabConcreteM3,
      totalRccConcreteM3,
      reinforcementSteelKg,
      doorsCount: qty.doorsCount,
      windowsCount: qty.windowsCount,
      floorsCount: qty.floorsCount,
      provenanceSummary: qty.provenanceSummary
    };
  }

  /**
   * Render function (Canvas2D / WebGL)
   */
  render() {
    // In Node / non-DOM environments, render is a no-op
    if (typeof window === 'undefined' || !this.canvas) return;
  }

  /**
   * Generate base64 snapshot image
   */
  generateSnapshot() {
    if (!this.canvas) return null;
    return this.canvas.toDataURL ? this.canvas.toDataURL('image/png') : null;
  }
}
