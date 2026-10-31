import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameSimulation } from '../engine/gameSimulation';
import { MAP_HEIGHT, MAP_WIDTH, DEPLOYMENT_ZONES } from '../constants/gameConfig';
import type { UnitClass, Vector2D } from '../types/game';

interface GameCanvas3DProps {
  simulation: GameSimulation;
  activeDeployUnit: UnitClass | null;
  activeUltimate: boolean;
  onDeployUnit: (unitClass: UnitClass, x: number, y: number) => void;
  onCastUltimate: (x: number, y: number) => void;
  onSelectionChange: (selectedIds: string[]) => void;
  playerRole?: 'p1' | 'p2';
}

export const GameCanvas3D: React.FC<GameCanvas3DProps> = ({
  simulation,
  activeDeployUnit,
  activeUltimate,
  onDeployUnit,
  onCastUltimate,
  onSelectionChange,
  playerRole = 'p1',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const activeDeployUnitRef = useRef(activeDeployUnit);
  activeDeployUnitRef.current = activeDeployUnit;

  // Drag selection
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

  // Ground plane for raycast
  const groundPlaneRef = useRef<THREE.Mesh | null>(null);

  // Mesh registries for fast entity pooling
  const unitMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const structureMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const projectileMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const crateMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const feedbackRipplesRef = useRef<{ mesh: THREE.Mesh; alpha: number; type: 'move' | 'attack' }[]>([]);

  // 3D Orbital Beam Visual Mesh
  const orbitalBeamRef = useRef<THREE.Mesh | null>(null);
  const ghostMeshRef = useRef<THREE.Group | null>(null);

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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const coords = getGroundIntersection(e.clientX, e.clientY);
    if (!coords) return;

    if (e.button === 0) {
      if (activeUltimate) {
        onCastUltimate(coords.x, coords.y);
        triggerOrbitalBeamEffect(coords.x, coords.y);
        return;
      }

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

    const clickedEnemyUnit = simulation.units.find(
      (u) => u.owner === opponentRole && Math.hypot(u.x - coords.x, u.y - coords.y) <= u.radius + 18
    );

    if (clickedEnemyUnit) {
      simulation.orderUnitsAttack(selectedUnitIdsRef.current, clickedEnemyUnit.id, 'unit');
      add3DFeedback(coords.x, coords.y, 'attack');
      return;
    }

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
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geom, mat);
    const worldPos = mapToWorld(x, y);
    mesh.position.set(worldPos.x, 1, worldPos.z);
    scene.add(mesh);

    feedbackRipplesRef.current.push({ mesh, alpha: 0.95, type });
  };

  const triggerOrbitalBeamEffect = (x: number, y: number) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const worldPos = mapToWorld(x, y);
    const beamGeom = new THREE.CylinderGeometry(24, 28, 1200, 24);
    const beamMat = new THREE.MeshBasicMaterial({
      color: playerRole === 'p1' ? 0x38bdf8 : 0xef4444,
      transparent: true,
      opacity: 0.85,
    });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.set(worldPos.x, 600, worldPos.z);
    scene.add(beam);
    orbitalBeamRef.current = beam;

    // Fade out beam
    let beamAlpha = 0.85;
    const fadeTimer = setInterval(() => {
      beamAlpha -= 0.1;
      if (beamAlpha <= 0) {
        clearInterval(fadeTimer);
        scene.remove(beam);
        orbitalBeamRef.current = null;
      } else {
        beamMat.opacity = beamAlpha;
        beam.scale.x *= 1.05;
        beam.scale.z *= 1.05;
      }
    }, 40);
  };

  // INITIALIZE 3D SCENE
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 1200;
    const height = mount.clientHeight || 675;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.FogExp2(0x070b14, 0.00055);
    sceneRef.current = scene;

    // 2. Camera: Angled 3D Isometric View
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

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0x475569, 1.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(200, 1100, 450);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 200;
    sunLight.shadow.camera.far = 2600;
    const d = 1000;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    const p1Light = new THREE.PointLight(0x0284c7, 4.0, 950);
    p1Light.position.set(-650, 140, 0);
    scene.add(p1Light);

    const p2Light = new THREE.PointLight(0xdc2626, 4.0, 950);
    p2Light.position.set(650, 140, 0);
    scene.add(p2Light);

    // 5. 3D Metal Battleground Floor
    const groundGeom = new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT, 32, 18);
    groundGeom.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.65,
      metalness: 0.4,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);
    groundPlaneRef.current = ground;

    // Glowing Lane Ground Strips
    const laneMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const topLane = new THREE.Mesh(new THREE.PlaneGeometry(MAP_WIDTH - 200, 20), laneMat);
    topLane.rotateX(-Math.PI / 2);
    topLane.position.set(0, 0.4, -200);
    scene.add(topLane);

    const midLane = new THREE.Mesh(new THREE.PlaneGeometry(MAP_WIDTH - 200, 30), new THREE.MeshBasicMaterial({ color: 0x172554 }));
    midLane.rotateX(-Math.PI / 2);
    midLane.position.set(0, 0.4, 0);
    scene.add(midLane);

    const botLane = new THREE.Mesh(new THREE.PlaneGeometry(MAP_WIDTH - 200, 20), laneMat);
    botLane.rotateX(-Math.PI / 2);
    botLane.position.set(0, 0.4, 200);
    scene.add(botLane);

    // Perimeter Laser Fences
    const fenceMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.5 });
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(MAP_WIDTH, 14, 4), fenceMat);
    f1.position.set(0, 7, -MAP_HEIGHT / 2);
    scene.add(f1);

    const f2 = new THREE.Mesh(new THREE.BoxGeometry(MAP_WIDTH, 14, 4), fenceMat);
    f2.position.set(0, 7, MAP_HEIGHT / 2);
    scene.add(f2);

    // Holographic Deployment Zones (Ground Hologrid)
    const p1ZoneGeom = new THREE.PlaneGeometry(350, 700);
    p1ZoneGeom.rotateX(-Math.PI / 2);
    const p1ZoneMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.14 });
    const p1ZoneMesh = new THREE.Mesh(p1ZoneGeom, p1ZoneMat);
    p1ZoneMesh.position.set(-575, 0.2, 0);
    scene.add(p1ZoneMesh);

    const p2ZoneGeom = new THREE.PlaneGeometry(350, 700);
    p2ZoneGeom.rotateX(-Math.PI / 2);
    const p2ZoneMat = new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.14 });
    const p2ZoneMesh = new THREE.Mesh(p2ZoneGeom, p2ZoneMat);
    p2ZoneMesh.position.set(575, 0.2, 0);
    scene.add(p2ZoneMesh);

    // Interactive 3D Holographic Ghost Preview
    const ghostGroup = new THREE.Group();
    ghostGroup.visible = false;
    scene.add(ghostGroup);
    ghostMeshRef.current = ghostGroup;

    const ghostRingGeom = new THREE.RingGeometry(16, 22, 32);
    ghostRingGeom.rotateX(-Math.PI / 2);
    const ghostRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const ghostRing = new THREE.Mesh(ghostRingGeom, ghostRingMat);
    ghostRing.name = 'ghostRing';
    ghostRing.position.y = 1;
    ghostGroup.add(ghostRing);

    const ghostBeamGeom = new THREE.CylinderGeometry(14, 20, 90, 16, 1, true);
    const ghostBeamMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
    const ghostBeam = new THREE.Mesh(ghostBeamGeom, ghostBeamMat);
    ghostBeam.name = 'ghostBeam';
    ghostBeam.position.y = 45;
    ghostGroup.add(ghostBeam);

    // Build 3D Crates & Barrels
    build3DCrates(scene, simulation, crateMeshesRef);

    // Build 3D Symmetrical Base Structures
    build3DStructures(scene, simulation, structureMeshesRef);

    // Resize Handler
    const handleResize = () => {
      if (!mount || !renderer || !camera) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 60 FPS RENDER LOOP
    let animId: number;
    let tick = 0;

    const render3D = () => {
      tick++;

      // Visceral screen shake
      const trauma = simulation.screenShake;
      const shakeOffsetX = (Math.random() - 0.5) * trauma * 2.5;
      const shakeOffsetZ = (Math.random() - 0.5) * trauma * 2.5;
      camera.position.set(shakeOffsetX, 920 + (Math.random() - 0.5) * trauma, 720 + shakeOffsetZ);

      // 1. Structures Animation (HQ radar, healing cross, turrets)
      update3DStructures(structureMeshesRef, simulation, tick);

      // 2. Units Walking Limb Animation & Head tracking
      update3DArticulatedUnits(scene, unitMeshesRef, simulation, tick);

      // 3. Projectiles & Arcing Mortar Shells
      update3DProjectiles(scene, projectileMeshesRef, simulation);

      // 4. Click Ripples
      update3DClickRipples(scene, feedbackRipplesRef);

      // 5. Interactive Ghost Preview Update
      if (ghostGroup) {
        const curUnit = activeDeployUnitRef.current;
        if (curUnit && currentMouseRef.current) {
          ghostGroup.visible = true;
          const coords = currentMouseRef.current;
          const zone = DEPLOYMENT_ZONES[playerRole];
          const isValid = coords.x >= zone.minX && coords.x <= zone.maxX && coords.y >= zone.minY && coords.y <= zone.maxY;
          const worldPos = mapToWorld(coords.x, coords.y);
          ghostGroup.position.set(worldPos.x, 0, worldPos.z);

          const ringMesh = ghostGroup.getObjectByName('ghostRing') as THREE.Mesh;
          const beamMesh = ghostGroup.getObjectByName('ghostBeam') as THREE.Mesh;
          const ghostColor = isValid ? (playerRole === 'p1' ? 0x38bdf8 : 0xf87171) : 0xf59e0b;
          if (ringMesh) {
            (ringMesh.material as THREE.MeshBasicMaterial).color.setHex(ghostColor);
            ringMesh.rotation.y = tick * 0.05;
          }
          if (beamMesh) {
            (beamMesh.material as THREE.MeshBasicMaterial).color.setHex(ghostColor);
            (beamMesh.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(tick * 0.15) * 0.1;
          }
        } else {
          ghostGroup.visible = false;
        }
      }

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
      className="relative w-full h-full select-none cursor-crosshair overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 3D Drag Marquee Selection Box */}
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

      {/* Ultimate Strike Cursor Notification */}
      {activeUltimate && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-rose-950/95 border-2 border-rose-500 text-rose-300 font-mono text-xs font-black tracking-widest uppercase shadow-[0_0_25px_rgba(239,68,68,0.8)] animate-pulse pointer-events-none">
          ⚡ TARGET FIELD TO CALL DOWN ULTIMATE STRIKE!
        </div>
      )}

      {/* Floating Combat Damage Numbers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {simulation.floatingTexts.map((txt) => {
          const mount = mountRef.current;
          if (!mount || !cameraRef.current) return null;
          const pos = new THREE.Vector3(txt.x - MAP_WIDTH / 2, 28, txt.y - MAP_HEIGHT / 2);
          pos.project(cameraRef.current);
          const screenX = ((pos.x + 1) * mount.clientWidth) / 2;
          const screenY = ((-pos.y + 1) * mount.clientHeight) / 2;

          return (
            <div
              key={txt.id}
              className="absolute font-mono font-black text-xs md:text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${screenX}px`,
                top: `${screenY}px`,
                color: txt.color,
                opacity: Math.max(0, Math.min(1, txt.life / txt.maxLife)),
                transform: `scale(${1 + (1 - txt.life / txt.maxLife) * 0.3})`,
              }}
            >
              {txt.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ================= ARTICULATED 3D CHARACTER SYSTEM =================

function build3DUnitMesh(unit: any): THREE.Group {
  const group = new THREE.Group();
  const isP1 = unit.owner === 'p1';
  const mainColor = isP1 ? 0x0ea5e9 : 0xef4444;
  const accentColor = isP1 ? 0x38bdf8 : 0xf87171;

  // 1. Selection Torus on Ground
  const selGeom = new THREE.TorusGeometry(unit.radius + 6, 1.5, 8, 24);
  selGeom.rotateX(Math.PI / 2);
  const selMat = new THREE.MeshBasicMaterial({ color: isP1 ? 0x38bdf8 : 0xf87171 });
  const selRing = new THREE.Mesh(selGeom, selMat);
  selRing.name = 'selectionRing';
  selRing.position.y = 1;
  selRing.visible = false;
  group.add(selRing);

  // 2. Overhead 3D Health Bar Billboard
  const hpBar = new THREE.Group();
  hpBar.name = 'healthBar';
  const barY = unit.classType === 'heavy' ? 44 : unit.classType === 'siege' ? 36 : 30;
  hpBar.position.set(0, barY, 0);
  hpBar.rotation.x = -Math.PI / 4;

  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 3.2),
    new THREE.MeshBasicMaterial({ color: 0x090d16, side: THREE.DoubleSide })
  );
  hpBar.add(hpBg);

  const hpFill = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 2.2),
    new THREE.MeshBasicMaterial({ color: isP1 ? 0x22c55e : 0xf87171, side: THREE.DoubleSide })
  );
  hpFill.name = 'hpFill';
  hpFill.position.z = 0.1;
  hpBar.add(hpFill);
  group.add(hpBar);

  // 3. Character Body & Limbs
  if (unit.classType === 'scout') {
    // CYBER-RONIN: Humanoid Cyber Ninja with Hover Skates & Twin Vibro-Katanas
    const torsoGeom = new THREE.BoxGeometry(10, 14, 8);
    const torsoMat = new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.3, metalness: 0.8 });
    const torso = new THREE.Mesh(torsoGeom, torsoMat);
    torso.position.y = 18;
    torso.castShadow = true;
    group.add(torso);

    // Cyber Helm & Visor
    const headGeom = new THREE.SphereGeometry(4.5, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 27;
    group.add(head);

    const visorGeom = new THREE.BoxGeometry(7, 2, 3);
    const visorMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const visor = new THREE.Mesh(visorGeom, visorMat);
    visor.position.set(0, 27, 3);
    group.add(visor);

    // Twin Vibro-Katanas
    const bladeGeom = new THREE.BoxGeometry(1.5, 24, 2);
    const bladeMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const blade1 = new THREE.Mesh(bladeGeom, bladeMat);
    blade1.position.set(-8, 16, 6);
    blade1.rotateZ(-Math.PI / 6);
    const blade2 = new THREE.Mesh(bladeGeom, bladeMat);
    blade2.position.set(8, 16, 6);
    blade2.rotateZ(Math.PI / 6);
    group.add(blade1);
    group.add(blade2);

    // Hover skate thrusters
    const skateGeom = new THREE.BoxGeometry(4, 3, 10);
    const skateMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const s1 = new THREE.Mesh(skateGeom, skateMat);
    s1.position.set(-4, 5, 0);
    const s2 = new THREE.Mesh(skateGeom, skateMat);
    s2.position.set(4, 5, 0);
    group.add(s1);
    group.add(s2);
  } else if (unit.classType === 'guardian') {
    // AEGIS PALADIN: Towering Armored Paladin with Riot Shield & Seismic Hammer
    const torsoGeom = new THREE.BoxGeometry(16, 18, 12);
    const torsoMat = new THREE.MeshStandardMaterial({ color: mainColor, metalness: 0.6 });
    const torso = new THREE.Mesh(torsoGeom, torsoMat);
    torso.position.y = 20;
    torso.castShadow = true;
    group.add(torso);

    // Horned Helm
    const headGeom = new THREE.BoxGeometry(8, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 31;
    group.add(head);

    // Giant Tower Shield in Left Arm
    const shieldGeom = new THREE.BoxGeometry(4, 30, 20);
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8 });
    const shield = new THREE.Mesh(shieldGeom, shieldMat);
    shield.position.set(-14, 18, 6);
    group.add(shield);

    // Seismic Hammer in Right Arm
    const hammerShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 26), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 12), new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.9 }));
    hammerShaft.position.set(13, 20, 4);
    hammerHead.position.set(13, 31, 4);
    group.add(hammerShaft);
    group.add(hammerHead);

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
    ff.position.y = 20;
    group.add(ff);
  } else if (unit.classType === 'heavy') {
    // DREADNOUGHT TITAN: 10-Ton Articulated Bipedal War Mech with Dual Rotary Cannons
    const chassisGeom = new THREE.BoxGeometry(26, 22, 22);
    const chassisMat = new THREE.MeshStandardMaterial({ color: isP1 ? 0x0369a1 : 0x7f1d1d, metalness: 0.7 });
    const chassis = new THREE.Mesh(chassisGeom, chassisMat);
    chassis.position.y = 26;
    chassis.castShadow = true;
    group.add(chassis);

    // Dual Heavy Gatling Cannons
    const barrelGeom = new THREE.CylinderGeometry(4, 4, 34, 8);
    barrelGeom.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
    const g1 = new THREE.Mesh(barrelGeom, barrelMat);
    g1.position.set(-16, 26, 14);
    const g2 = new THREE.Mesh(barrelGeom, barrelMat);
    g2.position.set(16, 26, 14);
    group.add(g1);
    group.add(g2);

    // Articulated Hydraulic Legs
    const legGeom = new THREE.BoxGeometry(6, 20, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const legL = new THREE.Mesh(legGeom, legMat);
    legL.name = 'legL';
    legL.position.set(-10, 10, 0);
    const legR = new THREE.Mesh(legGeom, legMat);
    legR.name = 'legR';
    legR.position.set(10, 10, 0);
    group.add(legL);
    group.add(legR);
  } else if (unit.classType === 'siege') {
    // CATACLYSM MORTAR: Quad-Pedal Heavy Siege Artillery Platform
    const baseGeom = new THREE.CylinderGeometry(unit.radius, unit.radius + 6, 14, 6);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = 10;
    group.add(base);

    // Giant Angled Mortar Tube
    const mortarGroup = new THREE.Group();
    mortarGroup.name = 'mortarCannon';
    const mortarGeom = new THREE.CylinderGeometry(7, 9, 32, 12);
    mortarGeom.rotateX(Math.PI / 4);
    const mortarMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8 });
    const mortar = new THREE.Mesh(mortarGeom, mortarMat);
    mortar.position.set(0, 16, 4);
    mortarGroup.add(mortar);
    group.add(mortarGroup);
  } else if (unit.classType === 'ranger') {
    // PHANTOM SNIPER: Sleek Marksman with Long Railgun & Real Laser Sight
    const torsoGeom = new THREE.CylinderGeometry(6, 7, 20, 8);
    const torsoMat = new THREE.MeshStandardMaterial({ color: mainColor, metalness: 0.5 });
    const torso = new THREE.Mesh(torsoGeom, torsoMat);
    torso.position.y = 16;
    torso.castShadow = true;
    group.add(torso);

    // Sniper Rifle
    const rifleGeom = new THREE.CylinderGeometry(2, 2.5, 36, 8);
    rifleGeom.rotateX(Math.PI / 2);
    const rifleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 });
    const rifle = new THREE.Mesh(rifleGeom, rifleMat);
    rifle.position.set(4, 18, 16);
    group.add(rifle);

    // Real 3D Laser Targeting Line
    const laserMat = new THREE.LineBasicMaterial({ color: isP1 ? 0x38bdf8 : 0xef4444 });
    const points = [new THREE.Vector3(4, 18, 34), new THREE.Vector3(4, 18, 260)];
    const laserGeom = new THREE.BufferGeometry().setFromPoints(points);
    const laserLine = new THREE.Line(laserGeom, laserMat);
    group.add(laserLine);
  } else {
    // VANGUARD COMMANDO: Frontline Combat Trooper with Dual Plasma Assault SMGs
    const torsoGeom = new THREE.BoxGeometry(12, 16, 9);
    const torsoMat = new THREE.MeshStandardMaterial({ color: mainColor, metalness: 0.5 });
    const torso = new THREE.Mesh(torsoGeom, torsoMat);
    torso.position.y = 16;
    torso.castShadow = true;
    group.add(torso);

    // Dual SMGs
    const smgGeom = new THREE.BoxGeometry(3, 5, 14);
    const smgMat = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.8 });
    const smg1 = new THREE.Mesh(smgGeom, smgMat);
    smg1.position.set(-8, 16, 10);
    const smg2 = new THREE.Mesh(smgGeom, smgMat);
    smg2.position.set(8, 16, 10);
    group.add(smg1);
    group.add(smg2);
  }

  return group;
}

function update3DArticulatedUnits(
  scene: THREE.Scene,
  unitMapRef: React.MutableRefObject<Map<string, THREE.Group>>,
  sim: GameSimulation,
  tick: number
) {
  const currentIds = new Set(sim.units.map((u) => u.id));

  unitMapRef.current.forEach((group, id) => {
    if (!currentIds.has(id)) {
      scene.remove(group);
      unitMapRef.current.delete(id);
    }
  });

  sim.units.forEach((u) => {
    let group = unitMapRef.current.get(u.id);

    if (!group) {
      group = build3DUnitMesh(u);
      scene.add(group);
      unitMapRef.current.set(u.id, group);
    }

    const worldPos = new THREE.Vector3(u.x - MAP_WIDTH / 2, 0, u.y - MAP_HEIGHT / 2);
    group.position.lerp(worldPos, 0.45);

    // Hover effect for Cyber-Ronin
    if (u.classType === 'scout') {
      group.position.y = 6 + Math.sin(tick * 0.18 + u.radius) * 3;
    } else {
      group.position.y = 0;
    }

    // Facing Angle
    group.rotation.y = -u.facingAngle + Math.PI / 2;

    // Selection ring
    const selRing = group.getObjectByName('selectionRing');
    if (selRing) {
      selRing.visible = !!u.selected;
    }

    // Overhead 3D Health Bar Billboard
    const hpBar = group.getObjectByName('healthBar');
    if (hpBar) {
      const hpRatio = Math.max(0, Math.min(1, u.hp / u.maxHp));
      const hpFill = hpBar.getObjectByName('hpFill') as THREE.Mesh;
      if (hpFill) {
        hpFill.scale.x = hpRatio;
        hpFill.position.x = -11 + (22 * hpRatio) / 2;
        const fillMat = hpFill.material as THREE.MeshBasicMaterial;
        if (hpRatio < 0.25) fillMat.color.setHex(0xef4444);
        else if (hpRatio < 0.55) fillMat.color.setHex(0xf59e0b);
        else fillMat.color.setHex(u.owner === 'p1' ? 0x22c55e : 0xf87171);
      }
    }

    // Forcefield pulse
    const ff = group.getObjectByName('forcefield');
    if (ff) {
      const s = 1 + Math.sin(tick * 0.12) * 0.08;
      ff.scale.set(s, s, s);
    }

    // Walking leg articulation for Dreadnought Titan
    const legL = group.getObjectByName('legL');
    const legR = group.getObjectByName('legR');
    if (legL && legR) {
      if (u.state === 'moving') {
        const stride = Math.sin(tick * 0.3) * 0.4;
        legL.rotation.x = stride;
        legR.rotation.x = -stride;
      } else {
        legL.rotation.x = 0;
        legR.rotation.x = 0;
      }
    }

    // Mortar recoil
    const mortar = group.getObjectByName('mortarCannon');
    if (mortar && u.state === 'attacking') {
      const kick = Math.abs(Math.sin(tick * 0.5)) * 4;
      mortar.position.z = -kick;
    }
  });
}

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
      const geom = new THREE.BoxGeometry(crate.width, 34, crate.height);
      const mat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 17;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const stripeGeom = new THREE.BoxGeometry(crate.width + 1, 6, crate.height + 1);
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
      const stripe = new THREE.Mesh(stripeGeom, stripeMat);
      stripe.position.y = 17;
      group.add(stripe);
    } else if (crate.type === 'ammo_crate') {
      const geom = new THREE.BoxGeometry(crate.width, 18, crate.height);
      const mat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 9;
      mesh.castShadow = true;
      group.add(mesh);
    } else if (crate.type === 'explosive_barrel') {
      const geom = new THREE.CylinderGeometry(crate.width / 2, crate.width / 2, 28, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0xb45309, emissive: 0x78350f, roughness: 0.4 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 14;
      mesh.castShadow = true;
      group.add(mesh);

      const ringGeom = new THREE.TorusGeometry(crate.width / 2 + 0.5, 1.5, 8, 16);
      ringGeom.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.y = 14;
      group.add(ring);
    } else {
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
      const baseGeom = new THREE.BoxGeometry(s.width, 42, s.height);
      const baseMat = new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.4, metalness: 0.6 });
      const baseMesh = new THREE.Mesh(baseGeom, baseMat);
      baseMesh.position.y = 21;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      group.add(baseMesh);

      const domeGeom = new THREE.SphereGeometry(28, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 });
      const domeMesh = new THREE.Mesh(domeGeom, domeMat);
      domeMesh.position.y = 42;
      group.add(domeMesh);

      const dishGroup = new THREE.Group();
      dishGroup.name = 'radarDish';
      const dishGeom = new THREE.CylinderGeometry(15, 2, 6, 16);
      dishGeom.rotateZ(Math.PI / 3);
      const dishMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.3 });
      const dish = new THREE.Mesh(dishGeom, dishMat);
      dishGroup.position.set(0, 68, 0);
      dishGroup.add(dish);
      group.add(dishGroup);

      // HQ Health Bar Billboard
      const hqHpBar = new THREE.Group();
      hqHpBar.name = 'structHpBar';
      hqHpBar.userData = { width: 50 };
      hqHpBar.position.set(0, 84, 0);
      hqHpBar.rotation.x = -Math.PI / 4;
      const hqHpBg = new THREE.Mesh(new THREE.PlaneGeometry(52, 5.5), new THREE.MeshBasicMaterial({ color: 0x090d16, side: THREE.DoubleSide }));
      const hqHpFill = new THREE.Mesh(new THREE.PlaneGeometry(50, 4), new THREE.MeshBasicMaterial({ color: isP1 ? 0x38bdf8 : 0xef4444, side: THREE.DoubleSide }));
      hqHpFill.name = 'hpFill';
      hqHpFill.position.z = 0.1;
      hqHpBar.add(hqHpBg);
      hqHpBar.add(hqHpFill);
      group.add(hqHpBar);
    } else if (s.type === 'tower') {
      const baseGeom = new THREE.CylinderGeometry(18, 24, 44, 8);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 });
      const baseMesh = new THREE.Mesh(baseGeom, baseMat);
      baseMesh.position.y = 22;
      baseMesh.castShadow = true;
      group.add(baseMesh);

      const headGroup = new THREE.Group();
      headGroup.name = 'turretHead';
      headGroup.position.y = 46;

      const headGeom = new THREE.SphereGeometry(14, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({ color: mainColor, metalness: 0.5 });
      const headMesh = new THREE.Mesh(headGeom, headMat);
      headGroup.add(headMesh);

      const barrelGeom = new THREE.CylinderGeometry(2.5, 2.5, 30, 8);
      barrelGeom.rotateX(Math.PI / 2);
      const barrelMat = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.8 });
      const b1 = new THREE.Mesh(barrelGeom, barrelMat);
      b1.position.set(-5, 0, 15);
      const b2 = new THREE.Mesh(barrelGeom, barrelMat);
      b2.position.set(5, 0, 15);
      headGroup.add(b1);
      headGroup.add(b2);

      group.add(headGroup);

      // Tower Health Bar Billboard
      const towerHpBar = new THREE.Group();
      towerHpBar.name = 'structHpBar';
      towerHpBar.userData = { width: 34 };
      towerHpBar.position.set(0, 68, 0);
      towerHpBar.rotation.x = -Math.PI / 4;
      const tHpBg = new THREE.Mesh(new THREE.PlaneGeometry(36, 4.2), new THREE.MeshBasicMaterial({ color: 0x090d16, side: THREE.DoubleSide }));
      const tHpFill = new THREE.Mesh(new THREE.PlaneGeometry(34, 3), new THREE.MeshBasicMaterial({ color: isP1 ? 0x38bdf8 : 0xef4444, side: THREE.DoubleSide }));
      tHpFill.name = 'hpFill';
      tHpFill.position.z = 0.1;
      towerHpBar.add(tHpBg);
      towerHpBar.add(tHpFill);
      group.add(towerHpBar);
    } else if (s.type === 'repair_station') {
      const baseGeom = new THREE.BoxGeometry(s.width, 24, s.height);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.4 });
      const baseMesh = new THREE.Mesh(baseGeom, baseMat);
      baseMesh.position.y = 12;
      group.add(baseMesh);

      const crossGroup = new THREE.Group();
      crossGroup.name = 'medicalCross';
      crossGroup.position.y = 48;

      const crossMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(6, 24, 6), crossMat);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(24, 6, 6), crossMat);
      crossGroup.add(c1);
      crossGroup.add(c2);
      group.add(crossGroup);
    } else if (s.type === 'generator') {
      const baseGeom = new THREE.CylinderGeometry(s.width / 2, s.width / 2 + 4, 34, 16);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x312e81, metalness: 0.7 });
      const baseMesh = new THREE.Mesh(baseGeom, baseMat);
      baseMesh.position.y = 17;
      group.add(baseMesh);

      const coreGeom = new THREE.SphereGeometry(14, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xa5b4fc });
      const core = new THREE.Mesh(coreGeom, coreMat);
      core.position.y = 36;
      group.add(core);
    } else {
      const geom = new THREE.BoxGeometry(s.width, 28, s.height);
      const mat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 14;
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

    const radar = group.getObjectByName('radarDish');
    if (radar) {
      radar.rotation.y = tick * 0.05;
    }

    const cross = group.getObjectByName('medicalCross');
    if (cross) {
      cross.rotation.y = tick * 0.04;
      cross.position.y = 48 + Math.sin(tick * 0.1) * 4;
    }

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

    // Update Structure Health Bar
    const hpBar = group.getObjectByName('structHpBar');
    if (hpBar) {
      const ratio = Math.max(0, Math.min(1, s.hp / s.maxHp));
      const hpFill = hpBar.getObjectByName('hpFill') as THREE.Mesh;
      if (hpFill) {
        const fullW = hpBar.userData.width || 34;
        hpFill.scale.x = ratio;
        hpFill.position.x = -fullW / 2 + (fullW * ratio) / 2;
        const fillMat = hpFill.material as THREE.MeshBasicMaterial;
        if (ratio < 0.25) fillMat.color.setHex(0xef4444);
        else if (ratio < 0.55) fillMat.color.setHex(0xf59e0b);
        else fillMat.color.setHex(s.owner === 'p1' ? 0x38bdf8 : 0xef4444);
      }
    }
  });
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
      const geom = new THREE.SphereGeometry(p.radius * 1.5, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: p.color });
      mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);
      projMapRef.current.set(p.id, mesh);
    }

    const worldX = p.x - MAP_WIDTH / 2;
    const worldZ = p.y - MAP_HEIGHT / 2;

    let heightY = 14;
    if (p.isSiege) {
      const totalDist = Math.hypot(p.targetX - p.x, p.targetY - p.y);
      heightY = 14 + Math.sin(Math.min(1, totalDist / 300) * Math.PI) * 130;
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
