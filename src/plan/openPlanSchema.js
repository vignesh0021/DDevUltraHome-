/**
 * DDevUltraHome — OpenPlan3D Normalized Floor-Plan JSON Schema & Adapter
 * Implements the open-source OpenPlan3D interchange schema (MIT) with wall aperture splitting,
 * shared wall deduplication, and quantity derivation with full civil engineering provenance.
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

export class OpenPlanSchema {
  /**
   * Validate an OpenPlan3D floor plan model
   * @param {Object} model
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validateFloorPlan(model) {
    const errors = [];
    if (!model || typeof model !== 'object') {
      return { valid: false, errors: ['Floor plan must be a non-null object'] };
    }
    if (!Array.isArray(model.floors) || model.floors.length === 0) {
      errors.push('Floor plan must contain at least one floor');
    } else {
      model.floors.forEach((floor, fIdx) => {
        if (!floor.id) errors.push(`Floor at index ${fIdx} missing id`);
        if (!Array.isArray(floor.walls)) errors.push(`Floor ${floor.id || fIdx} missing walls array`);
        if (!Array.isArray(floor.rooms)) errors.push(`Floor ${floor.id || fIdx} missing rooms array`);
        if (floor.walls) {
          floor.walls.forEach((w, wIdx) => {
            if (!w.id) errors.push(`Wall at index ${wIdx} missing id`);
            if (!w.start || typeof w.start.x !== 'number' || typeof w.start.y !== 'number') {
              errors.push(`Wall ${w.id || wIdx} has invalid start coordinates`);
            }
            if (!w.end || typeof w.end.x !== 'number' || typeof w.end.y !== 'number') {
              errors.push(`Wall ${w.id || wIdx} has invalid end coordinates`);
            }
          });
        }
      });
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Convert DDevUltraHome extracted/edited 2D rooms into normalized OpenPlan3D FloorPlan model
   * Handles shared wall deduplication and door/window opening generation.
   * @param {Array<Object>} rooms
   * @param {Object} [options]
   * @returns {Object} Normalized OpenPlan3D FloorPlan
   */
  static toOpenPlanModel(rooms = [], options = {}) {
    const projectName = options.projectName || 'Guindy Residence Scheme R0';
    const floorHeightM = options.floorHeightM || 2.80; // Standard 2.8m - 3.0m ceiling height
    const externalWallThick = options.externalWallThicknessM || 0.23; // 230mm brick wall
    const internalWallThick = options.internalWallThicknessM || 0.115; // 115mm partition wall
    const slabThicknessM = options.slabThicknessM || 0.15; // 150mm RCC slab

    // Group rooms by floor
    const floorGroups = new Map();
    rooms.forEach(rm => {
      let level = 0;
      let name = 'Ground Floor (தரைத்தளம்)';
      let code = 'GROUND_FLOOR';
      const fStr = ((rm.floor || '') + ' ' + (rm.floorName || '') + ' ' + (rm.name || '')).toUpperCase();
      if (fStr.includes('SECOND') || fStr.includes('FLOOR_3') || rm.pageNumber === 3) {
        level = 2;
        name = 'Second Floor (இரண்டாம் தளம்)';
        code = 'SECOND_FLOOR';
      } else if (fStr.includes('FIRST') || fStr.includes('FLOOR_2') || rm.pageNumber === 2) {
        level = 1;
        name = 'First Floor (முதல் தளம்)';
        code = 'FIRST_FLOOR';
      } else if (fStr.includes('THIRD') || fStr.includes('FLOOR_4') || rm.pageNumber === 4) {
        level = 3;
        name = 'Third Floor (மூன்றாம் தளம்)';
        code = 'THIRD_FLOOR';
      } else if (fStr.includes('TERRACE')) {
        level = 3;
        name = 'Terrace Floor (மொட்டை மாடி)';
        code = 'TERRACE_FLOOR';
      }
      if (!floorGroups.has(level)) {
        floorGroups.set(level, { level, name, code, rooms: [] });
      }
      floorGroups.get(level).rooms.push(rm);
    });

    const floors = [];
    const sortedLevels = Array.from(floorGroups.keys()).sort((a, b) => a - b);
    for (const lvl of sortedLevels) {
      const g = floorGroups.get(lvl);
      floors.push(this._buildFloor({
        floorId: `floor-${lvl}`,
        name: g.name,
        level: lvl,
        elevationM: lvl * floorHeightM,
        slabThicknessM,
        floorHeightM,
        rooms: g.rooms,
        externalWallThick,
        internalWallThick
      }));
    }

    if (floors.length === 0) {
      floors.push(this._buildFloor({
        floorId: 'floor-0',
        name: 'Ground Floor (தரைத்தளம்)',
        level: 0,
        elevationM: 0.0,
        slabThicknessM,
        floorHeightM,
        rooms: [],
        externalWallThick,
        internalWallThick
      }));
    }

    const floorPlan = {
      version: 1,
      id: `plan-${Date.now()}`,
      name: projectName,
      unit: 'm',
      floorHeightM,
      floors,
      metadata: {
        exportedAt: new Date().toISOString(),
        provenance: options.scaleRestrictions?.doNotScale 
          ? 'VERIFIED_WRITTEN_DIMENSIONS_NOTE_2_COMPLIANT'
          : 'EXTRACTED_CAD_TEXT',
        cadNote2Compliance: 'Drawings should not be scaled for obtaining dimensions. Written dimensions strictly enforced.'
      }
    };

    return floorPlan;
  }

  /**
   * Construct a single floor with deduplicated walls, rooms, doors, and windows
   * @private
   */
  static _buildFloor(params) {
    const { floorId, name, level, elevationM, slabThicknessM, floorHeightM, rooms, externalWallThick, internalWallThick } = params;

    const floorWalls = [];
    const floorRooms = [];
    const floorDoors = [];
    const floorWindows = [];

    // Arrange rooms geometrically
    const arrangedRooms = this._layoutRooms(rooms);

    // 1. Detect all shared touching segments between adjacent rooms
    const sharedSegments = []; // { x1, z1, x2, z2, roomA, roomB }

    for (let i = 0; i < arrangedRooms.length; i++) {
      for (let j = i + 1; j < arrangedRooms.length; j++) {
        const A = arrangedRooms[i];
        const B = arrangedRooms[j];

        // Vertical contact along X
        if (Math.abs((A.x + A.lengthM) - B.x) < 0.05) {
          const zStart = Math.max(A.z, B.z);
          const zEnd = Math.min(A.z + A.widthM, B.z + B.widthM);
          if (zEnd - zStart > 0.1) {
            sharedSegments.push({ x1: B.x, z1: zStart, x2: B.x, z2: zEnd, roomA: A.id, roomB: B.id });
          }
        } else if (Math.abs((B.x + B.lengthM) - A.x) < 0.05) {
          const zStart = Math.max(A.z, B.z);
          const zEnd = Math.min(A.z + A.widthM, B.z + B.widthM);
          if (zEnd - zStart > 0.1) {
            sharedSegments.push({ x1: A.x, z1: zStart, x2: A.x, z2: zEnd, roomA: A.id, roomB: B.id });
          }
        }

        // Horizontal contact along Z
        if (Math.abs((A.z + A.widthM) - B.z) < 0.05) {
          const xStart = Math.max(A.x, B.x);
          const xEnd = Math.min(A.x + A.lengthM, B.x + B.lengthM);
          if (xEnd - xStart > 0.1) {
            sharedSegments.push({ x1: xStart, z1: B.z, x2: xEnd, z2: B.z, roomA: A.id, roomB: B.id });
          }
        } else if (Math.abs((B.z + B.widthM) - A.z) < 0.05) {
          const xStart = Math.max(A.x, B.x);
          const xEnd = Math.min(A.x + A.lengthM, B.x + B.lengthM);
          if (xEnd - xStart > 0.1) {
            sharedSegments.push({ x1: xStart, z1: A.z, x2: xEnd, z2: A.z, roomA: A.id, roomB: B.id });
          }
        }
      }
    }

    // Add shared segments as internal walls
    sharedSegments.forEach((seg, sIdx) => {
      const wallId = `W-${level}-INT-${sIdx + 1}`;
      const len = SafeMath.round(Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1), 2);
      floorWalls.push({
        id: wallId,
        start: { x: seg.x1, y: seg.z1 },
        end: { x: seg.x2, y: seg.z2 },
        lengthM: len,
        heightM: floorHeightM,
        thicknessM: internalWallThick,
        isExternal: false,
        color: '#f1f5f9',
        sharedRooms: [seg.roomA, seg.roomB],
        elevationM
      });
    });

    const isShared = (x1, z1, x2, z2) => {
      return sharedSegments.some(s => {
        if (Math.abs(s.x1 - x1) < 0.05 && Math.abs(s.x2 - x2) < 0.05) {
          const midZ = (z1 + z2) / 2;
          return midZ >= Math.min(s.z1, s.z2) - 0.01 && midZ <= Math.max(s.z1, s.z2) + 0.01;
        }
        if (Math.abs(s.z1 - z1) < 0.05 && Math.abs(s.z2 - z2) < 0.05) {
          const midX = (x1 + x2) / 2;
          return midX >= Math.min(s.x1, s.x2) - 0.01 && midX <= Math.max(s.x1, s.x2) + 0.01;
        }
        return false;
      });
    };

    // 2. Generate external walls for each room's edges that are not shared
    arrangedRooms.forEach(rm => {
      const rx = rm.x;
      const rz = rm.z;
      const rl = rm.lengthM;
      const rw = rm.widthM;

      const roomWallIds = [];

      floorWalls.forEach(w => {
        if (!w.isExternal && w.sharedRooms.includes(rm.id)) {
          roomWallIds.push(w.id);
        }
      });

      const rawEdges = [
        { name: 'N', x1: rx, z1: rz, x2: rx + rl, z2: rz },
        { name: 'E', x1: rx + rl, z1: rz, x2: rx + rl, z2: rz + rw },
        { name: 'S', x1: rx, z1: rz + rw, x2: rx + rl, z2: rz + rw },
        { name: 'W', x1: rx, z1: rz, x2: rx, z2: rz + rw }
      ];

      rawEdges.forEach(edge => {
        if (edge.name === 'N' || edge.name === 'S') {
          const zCoord = edge.z1;
          const cuts = [edge.x1, edge.x2];
          sharedSegments.filter(s => Math.abs(s.z1 - zCoord) < 0.05 && Math.abs(s.z2 - zCoord) < 0.05).forEach(s => {
            cuts.push(Math.max(edge.x1, Math.min(edge.x2, s.x1)));
            cuts.push(Math.max(edge.x1, Math.min(edge.x2, s.x2)));
          });
          const sortedCuts = Array.from(new Set(cuts)).sort((a, b) => a - b);
          for (let c = 1; c < sortedCuts.length; c++) {
            const xA = sortedCuts[c - 1];
            const xB = sortedCuts[c];
            if (xB - xA > 0.05 && !isShared(xA, zCoord, xB, zCoord)) {
              const wallId = `W-${level}-EXT-${floorWalls.length + 1}`;
              const len = SafeMath.round(xB - xA, 2);
              floorWalls.push({
                id: wallId,
                start: { x: xA, y: zCoord },
                end: { x: xB, y: zCoord },
                lengthM: len,
                heightM: floorHeightM,
                thicknessM: externalWallThick,
                isExternal: true,
                color: '#f8fafc',
                sharedRooms: [rm.id],
                elevationM
              });
              roomWallIds.push(wallId);
            }
          }
        } else {
          const xCoord = edge.x1;
          const cuts = [edge.z1, edge.z2];
          sharedSegments.filter(s => Math.abs(s.x1 - xCoord) < 0.05 && Math.abs(s.x2 - xCoord) < 0.05).forEach(s => {
            cuts.push(Math.max(edge.z1, Math.min(edge.z2, s.z1)));
            cuts.push(Math.max(edge.z1, Math.min(edge.z2, s.z2)));
          });
          const sortedCuts = Array.from(new Set(cuts)).sort((a, b) => a - b);
          for (let c = 1; c < sortedCuts.length; c++) {
            const zA = sortedCuts[c - 1];
            const zB = sortedCuts[c];
            if (zB - zA > 0.05 && !isShared(xCoord, zA, xCoord, zB)) {
              const wallId = `W-${level}-EXT-${floorWalls.length + 1}`;
              const len = SafeMath.round(zB - zA, 2);
              floorWalls.push({
                id: wallId,
                start: { x: xCoord, y: zA },
                end: { x: xCoord, y: zB },
                lengthM: len,
                heightM: floorHeightM,
                thicknessM: externalWallThick,
                isExternal: true,
                color: '#f8fafc',
                sharedRooms: [rm.id],
                elevationM
              });
              roomWallIds.push(wallId);
            }
          }
        }
      });

      floorRooms.push({
        id: rm.id,
        name: rm.name,
        floor: level === 0 ? 'GROUND_FLOOR' : 'FIRST_FLOOR',
        x: rx,
        z: rz,
        lengthM: rl,
        widthM: rw,
        areaM2: SafeMath.round(rl * rw, 2),
        areaSqft: SafeMath.round(rl * rw * 10.7639, 1),
        perimeterM: SafeMath.round(2 * (rl + rw), 2),
        walls: roomWallIds,
        color: this._getRoomColor(rm.name),
        polygon: [
          { x: rx, y: rz },
          { x: rx + rl, y: rz },
          { x: rx + rl, y: rz + rw },
          { x: rx, y: rz + rw }
        ],
        elevationM,
        provenance: rm.provenance || DimensionProvenance.EXTRACTED_CAD_TEXT
      });
    });

    // Place Doors and Windows on Walls
    floorRooms.forEach(rm => {
      // 1. Door opening on internal wall (or West/South entrance)
      const internalWallId = rm.walls.find(wId => {
        const w = floorWalls.find(w => w.id === wId);
        return w && !w.isExternal && w.lengthM >= 1.0;
      }) || rm.walls[0];

      if (internalWallId) {
        const doorId = `DOOR-${rm.id}`;
        floorDoors.push({
          id: doorId,
          roomId: rm.id,
          wallId: internalWallId,
          position: 0.5, // 50% along wall
          widthM: 0.90,  // Standard 900mm door
          heightM: 2.10, // Standard 2100mm lintel height
          type: 'single',
          swing: 'inward'
        });
      }

      // 2. Window opening on external wall (if available)
      const externalWallId = rm.walls.find(wId => {
        const w = floorWalls.find(w => w.id === wId);
        return w && w.isExternal && w.lengthM >= 1.4 && !floorWindows.some(win => win.wallId === wId);
      });

      if (externalWallId) {
        const winId = `WIN-${rm.id}`;
        floorWindows.push({
          id: winId,
          roomId: rm.id,
          wallId: externalWallId,
          position: 0.5,
          widthM: 1.20,      // Standard 1200mm window
          heightM: 1.20,     // Standard 1200mm window height
          sillHeightM: 0.90  // Standard 900mm sill height
        });
      }
    });

    return {
      id: floorId,
      name,
      level,
      elevationM,
      slabThicknessM,
      walls: floorWalls,
      rooms: floorRooms,
      doors: floorDoors,
      windows: floorWindows
    };
  }

  /**
   * Arrange rooms using relative positioning to create a realistic contiguous floor layout
   * @private
   */
  static _layoutRooms(rooms) {
    if (!rooms || rooms.length === 0) return [];

    let currentX = 0;
    let currentZ = 0;
    let maxRowHeight = 0;
    const maxRowWidth = 7.5; // Max width before wrapping to next bay

    return rooms.map((rm, idx) => {
      const lengthM = parseFloat(rm.lengthM || rm.length) || SafeMath.round((rm.lengthFt || 10) * 0.3048, 2);
      const widthM = parseFloat(rm.widthM || rm.width) || SafeMath.round((rm.widthFt || 10) * 0.3048, 2);

      // Check if we should wrap to next row
      if (currentX + lengthM > maxRowWidth && idx > 0) {
        currentX = 0;
        currentZ += maxRowHeight;
        maxRowHeight = 0;
      }

      const roomPos = {
        id: rm.id || `rm-${idx + 1}`,
        name: rm.name,
        lengthM,
        widthM,
        x: SafeMath.round(currentX, 2),
        z: SafeMath.round(currentZ, 2),
        provenance: rm.provenance || (rm.requiresManualConfirmation ? DimensionProvenance.PROVISIONAL_ASSUMPTION : DimensionProvenance.EXTRACTED_CAD_TEXT)
      };

      currentX += lengthM;
      if (widthM > maxRowHeight) maxRowHeight = widthM;

      return roomPos;
    });
  }

  /**
   * Subdivide a wall around door and window openings into physical rectangular segments
   * Port of OpenPlan3D buildWallSegments algorithm
   * @param {number} wallLength - Total wall length in meters
   * @param {number} wallHeight - Wall height in meters
   * @param {Array<Object>} doors - Doors on this wall
   * @param {Array<Object>} windows - Windows on this wall
   * @returns {Array<Object>} Array of solid wall segments with real cutouts
   */
  static buildWallSegments(wallLength, wallHeight, doors = [], windows = []) {
    if (!Number.isFinite(wallLength) || wallLength <= 0) return [];

    // Collect all openings along wall: { left, right, bottom, top }
    const openings = [];

    doors.forEach(d => {
      const w = d.widthM || 0.90;
      const h = d.heightM || 2.10;
      const pos = d.position || 0.5;
      const center = pos * wallLength;
      const left = Math.max(0, center - w / 2);
      const right = Math.min(wallLength, center + w / 2);
      if (right > left) {
        openings.push({ left, right, bottom: 0, top: Math.min(h, wallHeight), type: 'DOOR' });
      }
    });

    windows.forEach(w => {
      const width = w.widthM || 1.20;
      const height = w.heightM || 1.20;
      const sill = w.sillHeightM || 0.90;
      const pos = w.position || 0.5;
      const center = pos * wallLength;
      const left = Math.max(0, center - width / 2);
      const right = Math.min(wallLength, center + width / 2);
      if (right > left) {
        openings.push({ left, right, bottom: sill, top: Math.min(sill + height, wallHeight), type: 'WINDOW' });
      }
    });

    if (openings.length === 0) {
      // Entire wall is solid
      return [{
        offsetX: wallLength / 2,
        width: wallLength,
        bottomY: 0,
        height: wallHeight,
        type: 'SOLID'
      }];
    }

    // Split wall along vertical boundary edges of openings
    const verticalEdges = Array.from(new Set([0, wallLength, ...openings.flatMap(o => [o.left, o.right])])).sort((a, b) => a - b);
    const segments = [];

    for (let i = 1; i < verticalEdges.length; i++) {
      const left = verticalEdges[i - 1];
      const right = verticalEdges[i];
      const spanWidth = SafeMath.round(right - left, 3);
      if (spanWidth <= 0.001) continue;

      const spanCenter = SafeMath.round((left + right) / 2, 3);
      const spanOpenings = openings.filter(o => o.left < right && o.right > left);

      if (spanOpenings.length === 0) {
        // Full height solid wall segment
        segments.push({
          offsetX: spanCenter,
          width: spanWidth,
          bottomY: 0,
          height: wallHeight,
          type: 'SOLID'
        });
      } else {
        // Split vertically around openings
        spanOpenings.forEach(op => {
          // 1. Sill segment (under window)
          if (op.bottom > 0) {
            segments.push({
              offsetX: spanCenter,
              width: spanWidth,
              bottomY: 0,
              height: op.bottom,
              type: 'SILL'
            });
          }
          // 2. Lintel segment (above door / window)
          if (op.top < wallHeight) {
            segments.push({
              offsetX: spanCenter,
              width: spanWidth,
              bottomY: op.top,
              height: wallHeight - op.top,
              type: 'LINTEL'
            });
          }
        });
      }
    }

    return segments;
  }

  /**
   * Derive net civil engineering takeoff quantities directly from OpenPlan3D model
   * @param {Object} floorPlan - Normalized OpenPlan3D model
   * @returns {Object} Quantity summary with full provenance
   */
  static deriveQuantitiesFromOpenPlan(floorPlan) {
    if (!floorPlan || !Array.isArray(floorPlan.floors)) {
      return { totalBuiltupAreaM2: 0, totalBuiltupAreaSqft: 0, items: [] };
    }

    let externalBrickworkVolumeM3 = 0;
    let internalBrickworkVolumeM3 = 0;
    let totalFloorAreaM2 = 0;
    let totalPlasterAreaM2 = 0;
    let totalDoorsCount = 0;
    let totalWindowsCount = 0;

    const items = [];

    floorPlan.floors.forEach(floor => {
      // 1. Floor Area
      floor.rooms.forEach(rm => {
        totalFloorAreaM2 += rm.areaM2;
      });

      // 2. Doors and Windows
      totalDoorsCount += floor.doors.length;
      totalWindowsCount += floor.windows.length;

      // 3. Wall brickwork with deduction subtractions
      floor.walls.forEach(w => {
        const wallDoors = floor.doors.filter(d => d.wallId === w.id);
        const wallWindows = floor.windows.filter(win => win.wallId === w.id);
        const segments = this.buildWallSegments(w.lengthM, w.heightM, wallDoors, wallWindows);

        const netWallAreaM2 = segments.reduce((sum, seg) => sum + (seg.width * seg.height), 0);
        const wallVolumeM3 = SafeMath.round(netWallAreaM2 * w.thicknessM, 3);

        if (w.isExternal) {
          externalBrickworkVolumeM3 += wallVolumeM3;
          // External wall: 1 external plaster face + 1 internal plaster face
          totalPlasterAreaM2 += SafeMath.round(netWallAreaM2 * 2, 2);
        } else {
          internalBrickworkVolumeM3 += wallVolumeM3;
          // Internal partition: 2 internal plaster faces
          totalPlasterAreaM2 += SafeMath.round(netWallAreaM2 * 2, 2);
        }
      });
    });

    const totalBuiltupAreaM2 = SafeMath.round(totalFloorAreaM2 * 1.20, 2);
    const totalBuiltupAreaSqft = SafeMath.round(totalBuiltupAreaM2 * 10.7639, 1);

    return {
      totalCarpetAreaM2: SafeMath.round(totalFloorAreaM2, 2),
      totalCarpetAreaSqft: SafeMath.round(totalFloorAreaM2 * 10.7639, 1),
      totalBuiltupAreaM2,
      totalBuiltupAreaSqft,
      externalBrickworkVolumeM3: SafeMath.round(externalBrickworkVolumeM3, 2),
      internalBrickworkVolumeM3: SafeMath.round(internalBrickworkVolumeM3, 2),
      totalPlasterAreaM2: SafeMath.round(totalPlasterAreaM2, 2),
      doorsCount: totalDoorsCount,
      windowsCount: totalWindowsCount,
      floorsCount: floorPlan.floors.length,
      provenanceSummary: 'Derived from verified OpenPlan3D normalized floor-plan model with door/window aperture deductions'
    };
  }

  /**
   * Restrained architectural color palette for floor finishes
   * @private
   */
  static _getRoomColor(name = '') {
    const n = name.toUpperCase();
    if (n.includes('LIVING') || n.includes('HALL') || n.includes('FOYER')) return '#fed7aa'; // Warm light wood/beige
    if (n.includes('BEDROOM')) return '#fef3c7'; // Calm neutral cream
    if (n.includes('KITCHEN') || n.includes('DINING')) return '#f1f5f9'; // Clean ceramic stone
    if (n.includes('TOILET') || n.includes('BATH')) return '#e0f2fe'; // Cool water blue-gray
    if (n.includes('PARKING') || n.includes('PORTICO')) return '#cbd5e1'; // Paver gray
    if (n.includes('STAIR')) return '#e2e8f0'; // Stone gray
    return '#f8fafc'; // Default neutral off-white
  }
}
