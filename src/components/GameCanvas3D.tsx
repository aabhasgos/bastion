import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameSimulation } from '../engine/gameSimulation';
import { MAP_HEIGHT, MAP_WIDTH } from '../constants/gameConfig';
import type { UnitClass, Vector2D } from '../types/game';

interface GameCanvas3DProps {
  simulation: GameSimulation;
  activeDeployUnit: UnitClass | null;
  onDeployUnit: (unitClass: UnitClass, x: number, y: number) => void;
  onSelectionChange: (selectedIds: string[]) => void;
  playerRole?: 'p1' | 'p2';
}

export const GameCanvas3D: React.FC<GameCanvas3DProps> = ({
  simulation,
  activeDeployUnit,
  onDeployUnit,
  onSelectionChange,
  playerRole = 'p1',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Drag marquee selection
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<Vector2D>({ x: 0, y: 0 });
  const currentMouseRef = useRef<Vector2D>({ x: 0, y: 0 });
  const selectedUnitIdsRef = useRef<string[]>([]);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseVecRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Ground plane for raycasting
  const groundPlaneRef = useRef<THREE.Mesh | null>(null);

  // Mesh registries for fast entity pooling
  const unitMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const structureMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const projectileMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const crateMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const fxMeshesRef = useRef<THREE.Group | null>(null);

  // Tactical click feedback ripples in 3D
  const feedbackRipplesRef = useRef<{ mesh: THREE.Mesh; alpha: number; type: 'move' | 'attack' }[]>([]);

  // Convert 2D map coords (0..1600, 0..900) to 3D World coords
  const mapToWorld = (x: number, y: number): THREE.Vector3 => {
    return new THREE.Vector3(x - MAP_WIDTH / 2, 0, y - MAP_HEIGHT / 2);
  };

  const worldToMap = (pos: THREE.Vector3): Vector2D => {
    return {
      x: pos.x + MAP_WIDTH / 2,
      y: pos.z + MAP_HEIGHT / 2,
    };
  };

  // Raycast mouse to ground plane
  const getGroundIntersection = (clientX: number, clientY: number): Vector2D | null => {
    const mount = mountRef.current;
    const camera = cameraRef.current;
    const ground = groundPlaneRef.current;
    if (!mount || !camera || !ground) return null;

    const rect = mount.getBoundingClientRect();
    mouseVecRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseVecRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseVecRef.current, camera);
    const intersects = raycasterRef.current.intersectObject(ground);

    if (intersects.length > 0) {
      return worldToMap(intersects[0].point);
    }
    return null;
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const coords = getGroundIntersection(e.clientX, e.clientY);
    if (!coords) return;

    if (e.button === 0) {
      if (activeDeployUnit) {
        onDeployUnit(activeDeployUnit, coords.x, coords.y);
        return;
      }

      isDraggingRef.current = true;
      dragStartRef.current = coords;
      currentMouseRef.current = coords;
    } else if (e.button === 2) {
      e.preventDefault();
      handleRightClickCommand(coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const coords = getGroundIntersection(e.clientX, e.clientY);
    if (coords) {
      currentMouseRef.current = coords;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0 && isDraggingRef.current) {
      isDraggingRef.current = false;
      const coords = getGroundIntersection(e.clientX, e.clientY) || currentMouseRef.current;

      const box = {
        startX: dragStartRef.current.x,
        startY: dragStartRef.current.y,
        endX: coords.x,
        endY: coords.y,
      };

      const selected = simulation.selectUnitsInBox(box, playerRole);
      selectedUnitIdsRef.current = selected;
      onSelectionChange(selected);
    }
  };

  const handleRightClickCommand = (coords: Vector2D) => {
    if (selectedUnitIdsRef.current.length === 0) return;
    const opponentRole = playerRole === 'p1' ? 'p2' : 'p1';

    // Target enemy unit
    const clickedEnemyUnit = simulation.units.find(
      (u) => u.owner === opponentRole && Math.hypot(u.x - coords.x, u.y - coords.y) <= u.radius + 18
    );

    if (clickedEnemyUnit) {
      simulation.orderUnitsAttack(selectedUnitIdsRef.current, clickedEnemyUnit.id, 'unit');
      add3DFeedback(coords.x, coords.y, 'attack');
      return;
    }

    // Target enemy structure
    const clickedEnemyStruct = simulation.structures.find(
      (s) =>
        s.owner === opponentRole &&
        s.hp > 0 &&
        Math.abs(s.x - coords.x) <= s.width / 2 + 15 &&
        Math.abs(s.y - coords.y) <= s.height / 2 + 15
    );

    if (clickedEnemyStruct) {
      simulation.orderUnitsAttack(selectedUnitIdsRef.current, clickedEnemyStruct.id, 'structure');
      add3DFeedback(coords.x, coords.y, 'attack');
      return;
    }

    // Ground move
    simulation.orderUnitsMove(selectedUnitIdsRef.current, coords.x, coords.y);
    add3DFeedback(coords.x, coords.y, 'move');
  };

  const add3DFeedback = (x: number, y: number, type: 'move' | 'attack') => {
    const scene = sceneRef.current;
    if (!scene) return;

    const color = type === 'attack' ? 0xef4444 : 0x38bdf8;
    const geom = new THREE.RingGeometry(type === 'attack' ? 8 : 4, type === 'attack' ? 14 : 9, 24);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geom, mat);
    const worldPos = mapToWorld(x, y);
    mesh.position.set(worldPos.x, 1, worldPos.z);
    scene.add(mesh);

    feedbackRipplesRef.current.push({ mesh, alpha: 0.9, type });
  };

  // Initialize Three.js Scene, Camera, Lights, and Terrain
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 1200;
    const height = mount.clientHeight || 675;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.0006);
    sceneRef.current = scene;

    // 2. Camera: Isometric 3D Angle looking at battlefield center
    const camera = new THREE.PerspectiveCamera(46, width / height, 10, 4000);
    camera.position.set(0, 920, 720);
    camera.lookAt(0, -20, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x384158, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(200, 1000, 400);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 200;
    sunLight.shadow.camera.far = 2500;
    const d = 1000;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // Base Neon Pointlights
    const p1Light = new THREE.PointLight(0x0284c7, 3.5, 900);
    p1Light.position.set(-650, 120, 0);
    scene.add(p1Light);

    const p2Light = new THREE.PointLight(0xdc2626, 3.5, 900);
    p2Light.position.set(650, 120, 0);
    scene.add(p2Light);

    // 5. Ground Plane (Metal Plating)
    const groundGeom = new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT, 32, 18);
    groundGeom.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.7,
      metalness: 0.35,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);
    groundPlaneRef.current = ground;

    // Grid Floor Overlay
    const gridHelper = new THREE.GridHelper(MAP_WIDTH, 32, 0x0284c7, 0x1e293b);
    gridHelper.position.y = 0.5;
    scene.add(gridHelper);

    // Arena Perimeter Wall
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 });
    const wallGeomTop = new THREE.BoxGeometry(MAP_WIDTH + 40, 30, 20);
    const wallTop = new THREE.Mesh(wallGeomTop, wallMat);
    wallTop.position.set(0, 15, -MAP_HEIGHT / 2 - 10);
    wallTop.castShadow = true;
    scene.add(wallTop);

    const wallBottom = new THREE.Mesh(wallGeomTop, wallMat);
    wallBottom.position.set(0, 15, MAP_HEIGHT / 2 + 10);
    wallBottom.castShadow = true;
    scene.add(wallBottom);

    // Tactical FX Group
    const fxGroup = new THREE.Group();
    scene.add(fxGroup);
    fxMeshesRef.current = fxGroup;

    // Build 3D Crates, Barrels & Props
    build3DCrates(scene, simulation, crateMeshesRef);

    // Build 3D Structures
    build3DStructures(scene, simulation, structureMeshesRef);

    // Resize handler
    const handleResize = () => {
      if (!mount || !renderer || !camera) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 60 FPS Render Loop
    let animId: number;
    let tick = 0;

    const render3D = () => {
      tick++;

      // Visceral screen shake
      const trauma = simulation.screenShake;
      const shakeOffsetX = (Math.random() - 0.5) * trauma * 2.5;
      const shakeOffsetZ = (Math.random() - 0.5) * trauma * 2.5;
      camera.position.set(shakeOffsetX, 920 + (Math.random() - 0.5) * trauma, 720 + shakeOffsetZ);

      // 1. Update 3D Structures (rotations, healing waves, turrets)
      update3DStructures(structureMeshesRef, simulation, tick);

      // 2. Update 3D Units (smooth translation, rotation, animations)
      update3DUnits(scene, unitMeshesRef, simulation, tick, playerRole);

      // 3. Update 3D Projectiles
      update3DProjectiles(scene, projectileMeshesRef, simulation);

      // 4. Update 3D Click Ripples
      update3DClickRipples(scene, feedbackRipplesRef);

      renderer.render(scene, camera);
      animId = requestAnimationFrame(render3D);
    };

    animId = requestAnimationFrame(render3D);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [simulation, playerRole]);

  return (
    <div
      ref={mountRef}
      className="relative w-full aspect-[16/9] max-h-[86vh] mx-auto rounded-3xl overflow-hidden border-2 border-slate-800 shadow-[0_0_60px_rgba(0,0,0,0.95)] bg-black select-none cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Tactical 3D HUD Overlay: Marquee Drag Box */}
      {isDraggingRef.current && (
        <div
          className="absolute border-2 border-cyan-400 bg-cyan-400/20 pointer-events-none rounded-md"
          style={{
            left: `${Math.min(dragStartRef.current.x, currentMouseRef.current.x) * (mountRef.current ? mountRef.current.clientWidth / MAP_WIDTH : 1)}px`,
            top: `${Math.min(dragStartRef.current.y, currentMouseRef.current.y) * (mountRef.current ? mountRef.current.clientHeight / MAP_HEIGHT : 1)}px`,
            width: `${Math.abs(currentMouseRef.current.x - dragStartRef.current.x) * (mountRef.current ? mountRef.current.clientWidth / MAP_WIDTH : 1)}px`,
            height: `${Math.abs(currentMouseRef.current.y - dragStartRef.current.y) * (mountRef.current ? mountRef.current.clientHeight / MAP_HEIGHT : 1)}px`,
          }}
        />
      )}

      {/* Ghost Deployment Guide */}
      {activeDeployUnit && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-300 font-mono text-xs tracking-wider uppercase shadow-xl animate-pulse pointer-events-none">
          Click Inside Friendly {playerRole === 'p1' ? 'Blue' : 'Red'} Base to Deploy {activeDeployUnit.toUpperCase()}
        </div>
      )}
    </div>
  );
};

// ================= 3D BUILDERS & UPDATERS =================

function build3DCrates(
  scene: THREE.Scene,
  sim: GameSimulation,
  crateMapRef: React.MutableRefObject<Map<string, THREE.Group>>
) {
  sim.crates.forEach((crate, idx) => {
    const group = new THREE.Group();
    const worldX = crate.x - MAP_WIDTH / 2;
    const worldZ = crate.y - MAP_HEIGHT / 2;

    if (crate.type === 'cargo_crate') {
      // 3D Shipping Container
      const geom = new THREE.BoxGeometry(crate.width, 32, crate.height);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.5,
        metalness: 0.6,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 16;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Yellow hazard stripes
      const stripeGeom = new THREE.BoxGeometry(crate.width + 1, 6, crate.height + 1);
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
      const stripe = new THREE.Mesh(stripeGeom, stripeMat);
      stripe.position.y = 16;
      group.add(stripe);
    } else if (crate.type === 'ammo_crate') {
      // 3D Munitions Box
      const geom = new THREE.BoxGeometry(crate.width, 18, crate.height);
      const mat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 9;
      mesh.castShadow = true;
      group.add(mesh);
    } else if (crate.type === 'explosive_barrel') {
      // 3D High-Hazard Fuel Drum
      const geom = new THREE.CylinderGeometry(crate.width / 2, crate.width / 2, 28, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xb45309,
        emissive: 0x78350f,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 14;
      mesh.castShadow = true;
      group.add(mesh);

      // Glowing hazard band
      const ringGeom = new THREE.TorusGeometry(crate.width / 2 + 0.5, 1.5, 8, 16);
      ringGeom.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.y = 14;
      group.add(ring);
    } else {
      // 3D Concrete Barrier
      const geom = new THREE.BoxGeometry(crate.width, 24, crate.height);
      const mat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 12;
      mesh.castShadow = true;
      group.add(mesh);
    }

    group.position.set(worldX, 0, worldZ);
    scene.add(group);
    crateMapRef.current.set(`crate_${idx}`, group);
  });
}

function build3DStructures(
  scene: THREE.Scene,
  sim: GameSimulation,
  structMapRef: React.MutableRefObject<Map<string, THREE.Group>>
) {
  sim.structures.forEach((s) => {
    const group = new THREE.Group();
    const isP1 = s.owner === 'p1';
    const mainColor = isP1 ? 0x0284c7 : 0xdc2626;
    const accentColor = isP1 ? 0x38bdf8 : 0xf87171;

    const worldX = s.x - MAP_WIDTH / 2;
    const worldZ = s.y - MAP_HEIGHT / 2;

    if (s.type === 'hq') {
      // 3D Multi-Tier Fortress HQ
      const baseGeom = new THREE.BoxGeometry(s.width, 38, s.height);
      const baseMat = new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.4, metalness: 0.6 });
      const baseMesh = new THREE.Mesh(baseGeom, baseMat);
      baseMesh.position.y = 19;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      group.add(baseMesh);

      // Command deck dome
      const domeGeom = new THREE.SphereGeometry(26, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 });
      const domeMesh = new THREE.Mesh(domeGeom, domeMat);
      domeMesh.position.y = 38;
      group.add(domeMesh);

      // Rotating radar dish
      const dishGroup = new THREE.Group();
      dishGroup.name = 'radarDish';
      const dishGeom = new THREE.CylinderGeometry(14, 2, 6, 16);
      dishGeom.rotateZ(Math.PI / 3);
      const dishMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.3 });
      const dish = new THREE.Mesh(dishGeom, dishMat);
      dishGroup.position.set(0, 64, 0);
      dishGroup.add(dish);
      group.add(dishGroup);
    } else if (s.type === 'tower') {
      // 3D Dual-Railgun Sentry Tower
      const baseGeom = new THREE.CylinderGeometry(18, 24, 42, 8);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 });
      const baseMesh = new THREE.Mesh(baseGeom, baseMat);
      baseMesh.position.y = 21;
      baseMesh.castShadow = true;
      group.add(baseMesh);

      // Swivel Turret Head
      const headGroup = new THREE.Group();
      headGroup.name = 'turretHead';
      headGroup.position.y = 44;

      const headGeom = new THREE.SphereGeometry(14, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({ color: mainColor, metalness: 0.5 });
      const headMesh = new THREE.Mesh(headGeom, headMat);
      headGroup.add(headMesh);

      // Dual railgun barrels
      const barrelGeom = new THREE.CylinderGeometry(2.5, 2.5, 28, 8);
      barrelGeom.rotateX(Math.PI / 2);
      const barrelMat = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.8 });
      const b1 = new THREE.Mesh(barrelGeom, barrelMat);
      b1.position.set(-5, 0, 14);
      const b2 = new THREE.Mesh(barrelGeom, barrelMat);
      b2.position.set(5, 0, 14);
      headGroup.add(b1);
      headGroup.add(b2);

      group.add(headGroup);
    } else if (s.type === 'repair_station') {
      // 3D Nano-Repair Bay with Floating Medical Cross
      const baseGeom = new THREE.BoxGeometry(s.width, 24, s.height);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.4 });
      const baseMesh = new THREE.Mesh(baseGeom, baseMat);
      baseMesh.position.y = 12;
      group.add(baseMesh);

      // Holographic Floating Medical Cross
      const crossGroup = new THREE.Group();
      crossGroup.name = 'medicalCross';
      crossGroup.position.y = 45;

      const crossMat = new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: false });
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(6, 22, 6), crossMat);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 6), crossMat);
      crossGroup.add(c1);
      crossGroup.add(c2);
      group.add(crossGroup);
    } else if (s.type === 'generator') {
      // 3D Plasma Reactor with Spinning Turbine
      const baseGeom = new THREE.CylinderGeometry(s.width / 2, s.width / 2 + 4, 34, 16);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x312e81, metalness: 0.7 });
      const baseMesh = new THREE.Mesh(baseGeom, baseMat);
      baseMesh.position.y = 17;
      group.add(baseMesh);

      // Glowing core sphere
      const coreGeom = new THREE.SphereGeometry(14, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xa5b4fc });
      const core = new THREE.Mesh(coreGeom, coreMat);
      core.position.y = 36;
      group.add(core);
    } else {
      // Walls / Barracks
      const geom = new THREE.BoxGeometry(s.width, 26, s.height);
      const mat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 13;
      mesh.castShadow = true;
      group.add(mesh);
    }

    group.position.set(worldX, 0, worldZ);
    scene.add(group);
    structMapRef.current.set(s.id, group);
  });
}

function update3DStructures(
  structMapRef: React.MutableRefObject<Map<string, THREE.Group>>,
  sim: GameSimulation,
  tick: number
) {
  sim.structures.forEach((s) => {
    const group = structMapRef.current.get(s.id);
    if (!group) return;

    if (s.hp <= 0) {
      group.visible = false;
      return;
    }

    // HQ radar rotation
    const radar = group.getObjectByName('radarDish');
    if (radar) {
      radar.rotation.y = tick * 0.05;
    }

    // Repair Bay cross rotation & floating bob
    const cross = group.getObjectByName('medicalCross');
    if (cross) {
      cross.rotation.y = tick * 0.04;
      cross.position.y = 45 + Math.sin(tick * 0.1) * 4;
    }

    // Turret aiming at targets
    const turretHead = group.getObjectByName('turretHead');
    if (turretHead && s.targetId) {
      const target = sim.units.find((u) => u.id === s.targetId);
      if (target) {
        const targetWorldX = target.x - MAP_WIDTH / 2;
        const targetWorldZ = target.y - MAP_HEIGHT / 2;
        const angle = Math.atan2(targetWorldX - group.position.x, targetWorldZ - group.position.z);
        turretHead.rotation.y = angle;
      }
    }
  });
}

function update3DUnits(
  scene: THREE.Scene,
  unitMapRef: React.MutableRefObject<Map<string, THREE.Group>>,
  sim: GameSimulation,
  tick: number,
  _localPlayer: 'p1' | 'p2'
) {
  const currentIds = new Set(sim.units.map((u) => u.id));

  // Remove deceased units
  unitMapRef.current.forEach((group, id) => {
    if (!currentIds.has(id)) {
      scene.remove(group);
      unitMapRef.current.delete(id);
    }
  });

  // Create or update alive units
  sim.units.forEach((u) => {
    let group = unitMapRef.current.get(u.id);

    if (!group) {
      group = build3DUnitMesh(u);
      scene.add(group);
      unitMapRef.current.set(u.id, group);
    }

    const worldPos = new THREE.Vector3(u.x - MAP_WIDTH / 2, 0, u.y - MAP_HEIGHT / 2);

    // Smooth position
    group.position.lerp(worldPos, 0.4);

    // Y-hover for speeder and walkers
    if (u.classType === 'scout') {
      group.position.y = 12 + Math.sin(tick * 0.15 + u.radius) * 3;
    } else {
      group.position.y = 0;
    }

    // Smooth rotation towards facing angle
    // Facing angle is in 2D (radians). In 3D (X-Z plane), rotation around Y:
    group.rotation.y = -u.facingAngle + Math.PI / 2;

    // Selection ring visibility
    const selRing = group.getObjectByName('selectionRing');
    if (selRing) {
      selRing.visible = !!u.selected;
    }

    // Forcefield pulse on Guardian
    const forcefield = group.getObjectByName('forcefield');
    if (forcefield) {
      const s = 1 + Math.sin(tick * 0.12) * 0.08;
      forcefield.scale.set(s, s, s);
    }

    // Heavy recoil animation when attacking
    if (u.state === 'attacking' && (u.classType === 'heavy' || u.classType === 'siege')) {
      const kick = Math.sin(tick * 0.8) * 4;
      group.translateZ(-kick);
    }
  });
}

function build3DUnitMesh(unit: any): THREE.Group {
  const group = new THREE.Group();
  const isP1 = unit.owner === 'p1';
  const mainColor = isP1 ? 0x0ea5e9 : 0xef4444;
  const accentColor = isP1 ? 0x38bdf8 : 0xf87171;

  // 1. Selection Ring (Ground Torus)
  const selGeom = new THREE.TorusGeometry(unit.radius + 6, 1.5, 8, 24);
  selGeom.rotateX(Math.PI / 2);
  const selMat = new THREE.MeshBasicMaterial({ color: isP1 ? 0x38bdf8 : 0xf87171 });
  const selRing = new THREE.Mesh(selGeom, selMat);
  selRing.name = 'selectionRing';
  selRing.position.y = 1;
  selRing.visible = false;
  group.add(selRing);

  // 2. Class-specific 3D Unit Models
  if (unit.classType === 'scout') {
    // Cyber-Speeder hovering dart
    const bodyGeom = new THREE.ConeGeometry(unit.radius, 28, 5);
    bodyGeom.rotateX(-Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: mainColor, metalness: 0.6, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.castShadow = true;
    group.add(body);

    // Glowing thrusters
    const thrustGeom = new THREE.CylinderGeometry(2, 4, 8, 8);
    const thrustMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const t1 = new THREE.Mesh(thrustGeom, thrustMat);
    t1.position.set(-5, 0, -12);
    const t2 = new THREE.Mesh(thrustGeom, thrustMat);
    t2.position.set(5, 0, -12);
    group.add(t1);
    group.add(t2);
  } else if (unit.classType === 'guardian') {
    // Heavy Bipedal Mech with Aegis Sphere
    const bodyGeom = new THREE.BoxGeometry(unit.radius * 1.8, 26, unit.radius * 1.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: mainColor, metalness: 0.5 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 14;
    body.castShadow = true;
    group.add(body);

    // Translucent Hexagonal Forcefield Bubble
    const ffGeom = new THREE.SphereGeometry(unit.radius + 10, 16, 16);
    const ffMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      wireframe: true,
    });
    const ff = new THREE.Mesh(ffGeom, ffMat);
    ff.name = 'forcefield';
    ff.position.y = 14;
    group.add(ff);
  } else if (unit.classType === 'heavy') {
    // Heavy Dual-Cannon Siege Tank
    const hullGeom = new THREE.BoxGeometry(unit.radius * 2, 18, unit.radius * 2);
    const hullMat = new THREE.MeshStandardMaterial({ color: isP1 ? 0x0369a1 : 0x7f1d1d, metalness: 0.7 });
    const hull = new THREE.Mesh(hullGeom, hullMat);
    hull.position.y = 9;
    hull.castShadow = true;
    group.add(hull);

    // Dual Heavy Cannons
    const gunGeom = new THREE.CylinderGeometry(3.5, 3.5, 34, 8);
    gunGeom.rotateX(Math.PI / 2);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
    const g1 = new THREE.Mesh(gunGeom, gunMat);
    g1.position.set(-6, 13, 14);
    const g2 = new THREE.Mesh(gunGeom, gunMat);
    g2.position.set(6, 13, 14);
    group.add(g1);
    group.add(g2);
  } else if (unit.classType === 'siege') {
    // Quad-Leg Mortar Artillery Platform
    const baseGeom = new THREE.CylinderGeometry(unit.radius, unit.radius + 4, 16, 6);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = 8;
    group.add(base);

    // Big Mortar Cannon tilted up 45 deg
    const mortarGeom = new THREE.CylinderGeometry(6, 8, 30, 12);
    mortarGeom.rotateX(Math.PI / 4);
    const mortarMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8 });
    const mortar = new THREE.Mesh(mortarGeom, mortarMat);
    mortar.position.set(0, 18, 5);
    group.add(mortar);
  } else if (unit.classType === 'ranger') {
    // Sniper Mech with Targeting Laser
    const bodyGeom = new THREE.CylinderGeometry(6, 8, 22, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: mainColor, metalness: 0.4 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 11;
    group.add(body);

    // Sniper rifle
    const rifleGeom = new THREE.CylinderGeometry(1.5, 2, 26, 8);
    rifleGeom.rotateX(Math.PI / 2);
    const rifleMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const rifle = new THREE.Mesh(rifleGeom, rifleMat);
    rifle.position.set(4, 14, 12);
    group.add(rifle);
  } else {
    // Assault Mech Trooper
    const bodyGeom = new THREE.CylinderGeometry(8, 10, 24, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: mainColor, metalness: 0.5 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 12;
    group.add(body);
  }

  return group;
}

function update3DProjectiles(
  scene: THREE.Scene,
  projMapRef: React.MutableRefObject<Map<string, THREE.Mesh>>,
  sim: GameSimulation
) {
  const currentIds = new Set(sim.projectiles.map((p) => p.id));

  projMapRef.current.forEach((mesh, id) => {
    if (!currentIds.has(id)) {
      scene.remove(mesh);
      projMapRef.current.delete(id);
    }
  });

  sim.projectiles.forEach((p) => {
    let mesh = projMapRef.current.get(p.id);

    if (!mesh) {
      const geom = new THREE.SphereGeometry(p.radius * 1.4, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: p.color });
      mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);
      projMapRef.current.set(p.id, mesh);
    }

    const worldX = p.x - MAP_WIDTH / 2;
    const worldZ = p.y - MAP_HEIGHT / 2;

    // Arcing height for siege artillery mortar shells!
    let heightY = 12;
    if (p.isSiege) {
      const totalDist = Math.hypot(p.targetX - p.x, p.targetY - p.y);
      heightY = 12 + Math.sin(Math.min(1, totalDist / 300) * Math.PI) * 120;
    }

    mesh.position.set(worldX, heightY, worldZ);
  });
}

function update3DClickRipples(
  scene: THREE.Scene,
  ripplesRef: React.MutableRefObject<{ mesh: THREE.Mesh; alpha: number; type: 'move' | 'attack' }[]>
) {
  const active: { mesh: THREE.Mesh; alpha: number; type: 'move' | 'attack' }[] = [];

  for (const rip of ripplesRef.current) {
    rip.mesh.scale.multiplyScalar(1.08);
    rip.alpha -= 0.05;

    const mat = rip.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, rip.alpha);

    if (rip.alpha > 0) {
      active.push(rip);
    } else {
      scene.remove(rip.mesh);
    }
  }

  ripplesRef.current = active;
}
