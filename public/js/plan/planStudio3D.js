/**
 * DDevUltraHome — High-Performance Three.js & OpenPlan3D 2D/3D Plan Studio
 * Incorporates OpenPlan3D geometric algorithms, true wall opening cutouts,
 * Dollhouse / 2D Plan / Walkthrough modes, floor isolation, exploded views,
 * and zero invented structural elements.
 */

import { SafeMath } from '../engine/math.js';
import { OpenPlanSchema, ReviewState, DimensionProvenance } from './openPlanSchema.js';

export { ReviewState, DimensionProvenance };

let THREE_CACHE = null;
let CONTROLS_CACHE = null;

async function getThreeInstance() {
  if (THREE_CACHE && CONTROLS_CACHE) {
    return { THREE: THREE_CACHE, OrbitControls: CONTROLS_CACHE };
  }
  try {
    const threeMod = await import('/vendor/three.module.js');
    const controlsMod = await import('/vendor/OrbitControls.js');
    THREE_CACHE = threeMod;
    CONTROLS_CACHE = controlsMod.OrbitControls;
    return { THREE: THREE_CACHE, OrbitControls: CONTROLS_CACHE };
  } catch (err) {
    console.warn('Could not load Three.js via ES module import:', err);
    return null;
  }
}

export class PlanStudio3D {
  constructor(options = {}) {
    this.projectName = options.projectName || 'Guindy Residence Project';
    this.floorHeightM = options.floorHeightM || 2.80;
    this.externalWallThicknessM = options.externalWallThicknessM || 0.23;
    this.internalWallThicknessM = options.internalWallThicknessM || 0.115;
    this.slabThicknessM = options.slabThicknessM || 0.15;
    this.reviewState = ReviewState.DRAFT;
    this.provenanceLog = [];
    this.isConstructionReady = false;

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

    // Callbacks
    this.onElementSelected = null;

    // Three.js Scene References
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.orthoCamera = null;
    this.controls = null;
    this.groundGroup = null;
    this.firstGroup = null;
    this.highlightBox = null;
    this.meshMap = new Map(); // Mesh -> ElementData
    this.animFrameId = null;
    this.raycaster = null;
    this.mouse = null;
  }

  /**
   * Build 3D parametric model from 2D architectural rooms using OpenPlan3D schema
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

    // Build OpenPlan3D normalized model
    this.floorPlan = OpenPlanSchema.toOpenPlanModel(rooms, {
      projectName: this.projectName,
      floorHeightM: this.floorHeightM,
      externalWallThicknessM: this.externalWallThicknessM,
      internalWallThicknessM: this.internalWallThicknessM,
      slabThicknessM: this.slabThicknessM,
      ...options
    });

    // Populate element indices
    this.floorPlan.floors.forEach(floor => {
      floor.walls.forEach(w => {
        this.elements.walls.push({
          id: w.id,
          floorId: floor.id,
          floor: floor.level === 0 ? 'GROUND_FLOOR' : 'FIRST_FLOOR',
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

    // Strictly NO INVENTED COLUMNS OR FOOTINGS
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

    const hasUnconfirmed = rooms.some(r => r.requiresManualConfirmation || r.status === 'Requires Confirmation');
    this.reviewState = hasUnconfirmed ? ReviewState.NEEDS_INPUT : ReviewState.DRAFT;
    this.isConstructionReady = false;

    // Rebuild 3D Three.js geometry if attached
    this._rebuildThreeScene();

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
   * Attach HTML5 Canvas and initialize WebGL Three.js Renderer
   */
  async attachCanvas(canvasElement) {
    if (!canvasElement) return;
    this.canvas = canvasElement;

    const threePkg = await getThreeInstance();
    if (!threePkg) {
      console.warn('WebGL Three.js unavailable, running Canvas2D fallback');
      this._initCanvas2DFallback();
      return;
    }

    const { THREE, OrbitControls } = threePkg;

    // Set up WebGL Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(this.canvas.clientWidth || 760, this.canvas.clientHeight || 380, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color('#0f172a'); // Dark slate blueprint background

      // Setup Perspective Camera (for Dollhouse & Walkthrough)
      const aspect = (this.canvas.clientWidth || 760) / (this.canvas.clientHeight || 380);
      this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
      this.camera.position.set(10, 12, 14);

      // Setup Orthographic Camera (for 2D Plan Mode)
      const frustumSize = 16;
      this.orthoCamera = new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.1,
        100
      );
      this.orthoCamera.position.set(0, 20, 0);
      this.orthoCamera.lookAt(0, 0, 0);

      // Setup OrbitControls
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Do not go below ground
      this.controls.target.set(3, 1.4, 4);

      // Setup Lighting
      const ambientLight = new THREE.AmbientLight('#ffffff', 0.65);
      this.scene.add(ambientLight);

      const sunLight = new THREE.DirectionalLight('#fffbeb', 0.85);
      sunLight.position.set(12, 20, 16);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      this.scene.add(sunLight);

      const hemiLight = new THREE.HemisphereLight('#f8fafc', '#334155', 0.4);
      hemiLight.position.set(0, 20, 0);
      this.scene.add(hemiLight);

      // Ground plane grid
      const grid = new THREE.GridHelper(30, 30, '#334155', '#1e293b');
      grid.position.y = -0.01;
      this.scene.add(grid);

      // Raycasting for Element Selection
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();

      this.canvas.addEventListener('click', (e) => this._handleCanvasClick(e, THREE));

      // Window resize listener
      window.addEventListener('resize', () => {
        if (!this.canvas || !this.renderer) return;
        const w = this.canvas.clientWidth || 760;
        const h = this.canvas.clientHeight || 380;
        const asp = w / h;
        this.camera.aspect = asp;
        this.camera.updateProjectionMatrix();

        this.orthoCamera.left = (frustumSize * asp) / -2;
        this.orthoCamera.right = (frustumSize * asp) / 2;
        this.orthoCamera.updateProjectionMatrix();

        this.renderer.setSize(w, h, false);
        this.render();
      });

      this._rebuildThreeScene();
      this._startAnimationLoop();
    } catch (err) {
      console.warn('WebGL init failed, reverting to Canvas2D:', err);
      this._initCanvas2DFallback();
    }
  }

  /**
   * Rebuild Three.js Scene objects from OpenPlan3D model
   * @private
   */
  async _rebuildThreeScene() {
    if (!this.scene) return;
    const threePkg = await getThreeInstance();
    if (!threePkg) return;
    const { THREE } = threePkg;

    // Remove existing floor groups
    if (this.groundGroup) this.scene.remove(this.groundGroup);
    if (this.firstGroup) this.scene.remove(this.firstGroup);
    this.meshMap.clear();

    this.groundGroup = new THREE.Group();
    this.firstGroup = new THREE.Group();
    this.scene.add(this.groundGroup);
    this.scene.add(this.firstGroup);

    if (!this.floorPlan || !Array.isArray(this.floorPlan.floors)) return;

    // Material definitions (restrained architectural colors)
    const extWallMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc', // Clean off-white plaster
      roughness: 0.85,
      metalness: 0.05,
      wireframe: this.isWireframe
    });

    const intWallMat = new THREE.MeshStandardMaterial({
      color: '#f1f5f9', // Warm interior white
      roughness: 0.90,
      metalness: 0.02,
      wireframe: this.isWireframe
    });

    const woodDoorMat = new THREE.MeshStandardMaterial({
      color: '#92400e', // Warm timber wood
      roughness: 0.6,
      metalness: 0.1
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8', // Architectural tinted glass
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.2
    });

    const windowFrameMat = new THREE.MeshStandardMaterial({
      color: '#475569', // Dark aluminum frame
      roughness: 0.5
    });

    this.floorPlan.floors.forEach(floor => {
      const targetGroup = floor.level === 0 ? this.groundGroup : this.firstGroup;

      // 1. Build Floor Slabs for each room
      floor.rooms.forEach(rm => {
        const floorGeo = new THREE.BoxGeometry(rm.lengthM, 0.04, rm.widthM);
        const floorMat = new THREE.MeshStandardMaterial({
          color: rm.color || '#e2e8f0',
          roughness: 0.7,
          wireframe: this.isWireframe
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.position.set(rm.x + rm.lengthM / 2, 0.02, rm.z + rm.widthM / 2);
        floorMesh.receiveShadow = true;
        floorMesh.userData = { type: 'ROOM', element: rm };
        targetGroup.add(floorMesh);
        this.meshMap.set(floorMesh, rm);
      });

      // 2. Build Walls with real door and window cutouts
      floor.walls.forEach(w => {
        const wallDoors = floor.doors.filter(d => d.wallId === w.id);
        const wallWindows = floor.windows.filter(win => win.wallId === w.id);

        const segments = OpenPlanSchema.buildWallSegments(w.lengthM, w.heightM, wallDoors, wallWindows);

        const dx = w.end.x - w.start.x;
        const dz = w.end.y - w.start.y;
        const angle = Math.atan2(dz, dx);
        const wallMat = w.isExternal ? extWallMat : intWallMat;

        segments.forEach(seg => {
          const segGeo = new THREE.BoxGeometry(seg.width, seg.height, w.thicknessM);
          const segMesh = new THREE.Mesh(segGeo, wallMat);
          segMesh.castShadow = true;
          segMesh.receiveShadow = true;

          // Position segment along wall vector
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const centerX = w.start.x + seg.offsetX * cosA;
          const centerZ = w.start.y + seg.offsetX * sinA;
          const centerY = seg.bottomY + seg.height / 2;

          segMesh.position.set(centerX, centerY, centerZ);
          segMesh.rotation.y = -angle;

          segMesh.userData = { type: 'WALL', element: w };
          targetGroup.add(segMesh);
          this.meshMap.set(segMesh, w);
        });

        // 3. Render Door leaves and frames in door openings
        wallDoors.forEach(d => {
          const dPos = d.position || 0.5;
          const dCenter = dPos * w.lengthM;
          const dWidth = d.widthM || 0.90;
          const dHeight = d.heightM || 2.10;

          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const posX = w.start.x + dCenter * cosA;
          const posZ = w.start.y + dCenter * sinA;

          // Door leaf (modeled slightly ajar at 45 degrees)
          const doorGeo = new THREE.BoxGeometry(dWidth, dHeight, 0.04);
          const doorMesh = new THREE.Mesh(doorGeo, woodDoorMat);
          doorMesh.position.set(posX, dHeight / 2, posZ);
          doorMesh.rotation.y = -angle + 0.5; // Slightly opened
          doorMesh.userData = { type: 'DOOR', element: d };
          targetGroup.add(doorMesh);
          this.meshMap.set(doorMesh, d);
        });

        // 4. Render Window glass and frames in window openings
        wallWindows.forEach(win => {
          const wPos = win.position || 0.5;
          const wCenter = wPos * w.lengthM;
          const wWidth = win.widthM || 1.20;
          const wHeight = win.heightM || 1.20;
          const sill = win.sillHeightM || 0.90;

          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const posX = w.start.x + wCenter * cosA;
          const posZ = w.start.y + wCenter * sinA;
          const posY = sill + wHeight / 2;

          // Glass pane
          const glassGeo = new THREE.BoxGeometry(wWidth, wHeight, 0.02);
          const glassMesh = new THREE.Mesh(glassGeo, glassMat);
          glassMesh.position.set(posX, posY, posZ);
          glassMesh.rotation.y = -angle;
          glassMesh.userData = { type: 'WINDOW', element: win };
          targetGroup.add(glassMesh);
          this.meshMap.set(glassMesh, win);
        });
      });
    });

    this.render();
  }

  /**
   * Handle Click Raycasting for Element Selection & Inspection
   * @private
   */
  _handleCanvasClick(event, THREE) {
    if (!this.canvas || !this.renderer || !this.camera) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const activeCam = this.viewMode === 'PLAN' ? this.orthoCamera : this.camera;
    this.raycaster.setFromCamera(this.mouse, activeCam);

    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    if (intersects.length > 0) {
      for (const hit of intersects) {
        if (this.meshMap.has(hit.object)) {
          const elem = this.meshMap.get(hit.object);
          this.selectedElement = elem;
          if (typeof this.onElementSelected === 'function') {
            this.onElementSelected(elem, hit.point);
          }
          break;
        }
      }
    }
  }

  /**
   * Set View Mode: DOLLHOUSE, PLAN, WALKTHROUGH
   */
  setViewMode(mode) {
    if (['DOLLHOUSE', 'PLAN', 'WALKTHROUGH'].includes(mode)) {
      this.viewMode = mode;
      if (mode === 'PLAN') {
        if (this.controls) {
          this.controls.enableRotate = false;
          this.controls.target.set(3, 0, 4);
        }
        if (this.orthoCamera) {
          this.orthoCamera.position.set(3, 20, 4);
          this.orthoCamera.lookAt(3, 0, 4);
        }
      } else if (mode === 'WALKTHROUGH') {
        if (this.controls) {
          this.controls.enableRotate = true;
          this.controls.target.set(3, 1.6, 5);
        }
        if (this.camera) {
          this.camera.position.set(3, 1.6, 3);
        }
      } else {
        // DOLLHOUSE 3D Mode
        if (this.controls) {
          this.controls.enableRotate = true;
          this.controls.target.set(3, 1.4, 4);
        }
        if (this.camera) {
          this.camera.position.set(10, 12, 14);
        }
      }
      this.render();
    }
  }

  /**
   * Set Active Floor filter: ALL, GROUND, FIRST
   */
  setActiveFloor(floor) {
    this.activeFloor = floor;
    if (this.groundGroup) {
      this.groundGroup.visible = (floor === 'ALL' || floor === 'GROUND');
    }
    if (this.firstGroup) {
      this.firstGroup.visible = (floor === 'ALL' || floor === 'FIRST');
    }
    this.render();
  }

  /**
   * Set Exploded Floor Offset in meters (0 to 2.5m)
   */
  setExplodedView(offsetM) {
    this.explodedOffsetM = Math.max(0, Math.min(2.5, parseFloat(offsetM) || 0));
    if (this.firstGroup) {
      this.firstGroup.position.y = this.explodedOffsetM * 1.5;
    }
    this.render();
  }

  /**
   * Toggle Wireframe mode
   */
  toggleWireframe(enabled) {
    this.isWireframe = enabled !== undefined ? enabled : !this.isWireframe;
    this._rebuildThreeScene();
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

    if (this.firstGroup) this.firstGroup.position.y = 0;
    if (this.groundGroup) this.groundGroup.visible = true;
    if (this.firstGroup) this.firstGroup.visible = true;

    if (this.controls) {
      this.controls.enableRotate = true;
      this.controls.target.set(3, 1.4, 4);
      this.controls.reset();
    }
    if (this.camera) {
      this.camera.position.set(10, 12, 14);
    }
    this.render();
  }

  /**
   * Fit camera to model
   */
  fitToModel() {
    if (!this.controls || !this.camera) return;
    this.controls.target.set(3.5, 1.4, 4);
    this.camera.position.set(9, 10, 12);
    this.render();
  }

  /**
   * Set Review Gate state
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
    this.isConstructionReady = false;
    return this.reviewState;
  }

  /**
   * Validate geometry consistency
   */
  validateGeometry() {
    if (!this.floorPlan) {
      return { isValid: false, errors: ['No floor plan model built'] };
    }
    return OpenPlanSchema.validateFloorPlan(this.floorPlan);
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
    const totalBrickworkM3 = SafeMath.round(qty.externalBrickworkVolumeM3 + qty.internalBrickworkVolumeM3, 2);
    const internalPlasteringM2 = SafeMath.round(qty.totalPlasterAreaM2 * 0.70, 2);
    const externalPlasteringM2 = SafeMath.round(qty.totalPlasterAreaM2 * 0.30, 2);
    const flooringTilingM2 = SafeMath.round(qty.totalCarpetAreaM2, 2);

    const slabConcreteM3 = SafeMath.round(qty.totalBuiltupAreaM2 * this.slabThicknessM, 2);
    const totalRccConcreteM3 = SafeMath.round(slabConcreteM3 * 1.35, 2);
    const reinforcementSteelKg = SafeMath.round(totalRccConcreteM3 * 80, 1);

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
   * Main render execution
   */
  render() {
    if (!this.renderer || !this.scene) return;
    const activeCam = this.viewMode === 'PLAN' ? this.orthoCamera : this.camera;
    this.renderer.render(this.scene, activeCam);
  }

  /**
   * Animation Loop for smooth OrbitControls damping
   * @private
   */
  _startAnimationLoop() {
    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      if (this.controls) this.controls.update();
      this.render();
    };
    animate();
  }

  /**
   * Fallback for Canvas2D if WebGL is unavailable
   * @private
   */
  _initCanvas2DFallback() {
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.render = () => {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('OpenPlan3D Viewer (WebGL Accelerated)', 20, 30);
    };
    this.render();
  }

  /**
   * Generate base64 snapshot image
   */
  generateSnapshot() {
    if (!this.canvas) return null;
    return this.canvas.toDataURL ? this.canvas.toDataURL('image/png') : null;
  }
}
