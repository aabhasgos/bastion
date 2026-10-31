import React, { useEffect, useRef } from 'react';
import { GameSimulation } from '../engine/gameSimulation';
import { DEPLOYMENT_ZONES, MAP_HEIGHT, MAP_WIDTH } from '../constants/gameConfig';
import type { UnitClass, Vector2D } from '../types/game';

interface GameCanvasProps {
  simulation: GameSimulation;
  activeDeployUnit: UnitClass | null;
  onDeployUnit: (unitClass: UnitClass, x: number, y: number) => void;
  onSelectionChange: (selectedIds: string[]) => void;
  playerRole?: 'p1' | 'p2';
}

interface ClickFeedback {
  x: number;
  y: number;
  type: 'move' | 'attack';
  radius: number;
  alpha: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  simulation,
  activeDeployUnit,
  onDeployUnit,
  onSelectionChange,
  playerRole = 'p1',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<Vector2D>({ x: 0, y: 0 });
  const currentMouseRef = useRef<Vector2D>({ x: 0, y: 0 });
  const feedbacksRef = useRef<ClickFeedback[]>([]);
  const selectedUnitIdsRef = useRef<string[]>([]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): Vector2D => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = MAP_WIDTH / rect.width;
    const scaleY = MAP_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    currentMouseRef.current = coords;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0 && isDraggingRef.current) {
      isDraggingRef.current = false;
      const coords = getCanvasCoords(e);

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

    // Check if target is enemy unit
    const clickedEnemyUnit = simulation.units.find(
      (u) => u.owner === opponentRole && Math.hypot(u.x - coords.x, u.y - coords.y) <= u.radius + 14
    );

    if (clickedEnemyUnit) {
      simulation.orderUnitsAttack(selectedUnitIdsRef.current, clickedEnemyUnit.id, 'unit');
      addFeedback(coords.x, coords.y, 'attack');
      return;
    }

    // Check if target is enemy structure
    const clickedEnemyStruct = simulation.structures.find(
      (s) =>
        s.owner === opponentRole &&
        s.hp > 0 &&
        Math.abs(s.x - coords.x) <= s.width / 2 + 10 &&
        Math.abs(s.y - coords.y) <= s.height / 2 + 10
    );

    if (clickedEnemyStruct) {
      simulation.orderUnitsAttack(selectedUnitIdsRef.current, clickedEnemyStruct.id, 'structure');
      addFeedback(coords.x, coords.y, 'attack');
      return;
    }

    // Ground move order
    simulation.orderUnitsMove(selectedUnitIdsRef.current, coords.x, coords.y);
    addFeedback(coords.x, coords.y, 'move');
  };

  const addFeedback = (x: number, y: number, type: 'move' | 'attack') => {
    feedbacksRef.current.push({
      x,
      y,
      type,
      radius: 8,
      alpha: 1.0,
    });
  };

  // 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tickCount = 0;

    const render = () => {
      tickCount++;

      // Visceral screen shake
      const shakeX = (Math.random() - 0.5) * simulation.screenShake * 1.8;
      const shakeY = (Math.random() - 0.5) * simulation.screenShake * 1.8;

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // 1. Draw Battlefield Terrain, Panels, Grates & Circuit Conduits
      drawBattlefield(ctx, tickCount);

      // 2. Draw Permanent Scorch Marks & Blast Decals
      drawScorchMarks(ctx, simulation);

      // 3. Draw Detailed Sci-Fi Crates, Barrels & Barricades
      drawCratesAndProps(ctx, simulation, tickCount);

      // 4. Draw Obstacles & Rocks
      drawObstacles(ctx, simulation);

      // 5. Draw Pre-Installed High-Tech Base Structures
      drawStructures(ctx, simulation, tickCount);

      // 6. Draw Detailed Animated Units
      drawUnits(ctx, simulation, tickCount, playerRole);

      // 7. Draw Projectiles, Lasers & Artillery Shells
      drawProjectiles(ctx, simulation);

      // 8. Draw Explosions, Particles & Floating Combat Text
      drawVisualFX(ctx, simulation);

      // 9. Draw Command Ripples & Crosshairs
      drawClickFeedbacks(ctx);

      // 10. Draw Selection Box
      if (isDraggingRef.current) {
        drawSelectionBox(ctx, dragStartRef.current, currentMouseRef.current);
      }

      // 11. Draw Deployment Zone Highlight
      if (activeDeployUnit) {
        drawDeploymentZoneHighlight(ctx, currentMouseRef.current, activeDeployUnit, playerRole);
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [simulation, activeDeployUnit, playerRole]);

  const drawClickFeedbacks = (ctx: CanvasRenderingContext2D) => {
    const active: ClickFeedback[] = [];
    for (const fb of feedbacksRef.current) {
      fb.radius += 1.8;
      fb.alpha -= 0.04;

      if (fb.alpha > 0) {
        ctx.save();
        ctx.strokeStyle = fb.type === 'attack' ? `rgba(239, 68, 68, ${fb.alpha})` : `rgba(56, 189, 248, ${fb.alpha})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(fb.x, fb.y, fb.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (fb.type === 'attack') {
          ctx.beginPath();
          ctx.moveTo(fb.x - fb.radius - 5, fb.y);
          ctx.lineTo(fb.x + fb.radius + 5, fb.y);
          ctx.moveTo(fb.x, fb.y - fb.radius - 5);
          ctx.lineTo(fb.x, fb.y + fb.radius + 5);
          ctx.stroke();
        }
        ctx.restore();
        active.push(fb);
      }
    }
    feedbacksRef.current = active;
  };

  return (
    <div className="relative w-full aspect-[16/9] max-h-[85vh] mx-auto rounded-2xl overflow-hidden border-2 border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.9)] bg-black">
      <canvas
        ref={canvasRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        className="w-full h-full block cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};

// ================= DRAWING FUNCTIONS =================

function drawBattlefield(ctx: CanvasRenderingContext2D, tick: number) {
  // Base metal terrain color
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  // Large industrial steel plates with rivets
  ctx.save();
  const plateW = 100;
  const plateH = 100;

  for (let x = 0; x < MAP_WIDTH; x += plateW) {
    for (let y = 0; y < MAP_HEIGHT; y += plateH) {
      ctx.strokeStyle = '#151f30';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, plateW, plateH);

      // Rivets on corners
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(x + 4, y + 4, 1.8, 0, Math.PI * 2);
      ctx.arc(x + plateW - 4, y + 4, 1.8, 0, Math.PI * 2);
      ctx.arc(x + 4, y + plateH - 4, 1.8, 0, Math.PI * 2);
      ctx.arc(x + plateW - 4, y + plateH - 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Tactical Lane Guidance Decals
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.setLineDash([12, 16]);
  ctx.lineWidth = 2;

  // Top Lane
  ctx.beginPath();
  ctx.moveTo(380, 250);
  ctx.lineTo(1220, 250);
  ctx.stroke();

  // Mid Lane (Tactical Trench)
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
  ctx.beginPath();
  ctx.moveTo(380, 450);
  ctx.lineTo(1220, 450);
  ctx.stroke();

  // Bot Lane
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.beginPath();
  ctx.moveTo(380, 650);
  ctx.lineTo(1220, 650);
  ctx.stroke();
  ctx.setLineDash([]);

  // Glowing Power Conduits from Generators to HQ
  const pulseOffset = (tick * 2) % 30;

  // P1 Conduit (Generator 180,590 to HQ 100,450)
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(180, 590);
  ctx.lineTo(120, 590);
  ctx.lineTo(100, 495);
  ctx.stroke();

  // Glowing energy pulse dot
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(180 - pulseOffset * 2, 590, 3, 0, Math.PI * 2);
  ctx.fill();

  // P2 Conduit (Generator 1420,590 to HQ 1500,450)
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
  ctx.beginPath();
  ctx.moveTo(1420, 590);
  ctx.lineTo(1480, 590);
  ctx.lineTo(1500, 495);
  ctx.stroke();

  ctx.fillStyle = '#f87171';
  ctx.shadowColor = '#f87171';
  ctx.beginPath();
  ctx.arc(1420 + pulseOffset * 2, 590, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Center Battlefield Radar Ring with rotating sweep
  const sweepAngle = (tick * 0.03) % (Math.PI * 2);
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(800, 450, 140, 0, Math.PI * 2);
  ctx.stroke();

  // Sweep line
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.beginPath();
  ctx.moveTo(800, 450);
  ctx.lineTo(800 + Math.cos(sweepAngle) * 140, 450 + Math.sin(sweepAngle) * 140);
  ctx.stroke();

  // Base Territory Glows
  const p1Grad = ctx.createLinearGradient(0, 0, 450, 0);
  p1Grad.addColorStop(0, 'rgba(14, 165, 233, 0.16)');
  p1Grad.addColorStop(1, 'rgba(14, 165, 233, 0.0)');
  ctx.fillStyle = p1Grad;
  ctx.fillRect(0, 0, 450, MAP_HEIGHT);

  const p2Grad = ctx.createLinearGradient(MAP_WIDTH, 0, MAP_WIDTH - 450, 0);
  p2Grad.addColorStop(0, 'rgba(239, 68, 68, 0.16)');
  p2Grad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
  ctx.fillStyle = p2Grad;
  ctx.fillRect(MAP_WIDTH - 450, 0, 450, MAP_HEIGHT);

  ctx.restore();
}

function drawScorchMarks(ctx: CanvasRenderingContext2D, sim: GameSimulation) {
  for (const s of sim.scorchMarks) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();

    // Jagged inner blast rim
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawCratesAndProps(ctx: CanvasRenderingContext2D, sim: GameSimulation, tick: number) {
  for (const prop of sim.crates) {
    ctx.save();
    ctx.translate(prop.x, prop.y);

    if (prop.type === 'cargo_crate') {
      // Large Sci-Fi Shipping Container
      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-prop.width / 2 + 5, -prop.height / 2 + 5, prop.width, prop.height);

      // Main container body
      ctx.fillStyle = '#334155';
      ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);

      // Metal rim and bevel
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.strokeRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);

      // Reinforced corner brackets
      ctx.fillStyle = '#0f172a';
      const bSize = 8;
      ctx.fillRect(-prop.width / 2, -prop.height / 2, bSize, bSize);
      ctx.fillRect(prop.width / 2 - bSize, -prop.height / 2, bSize, bSize);
      ctx.fillRect(-prop.width / 2, prop.height / 2 - bSize, bSize, bSize);
      ctx.fillRect(prop.width / 2 - bSize, prop.height / 2 - bSize, bSize, bSize);

      // Stenciled military label
      if (prop.label) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(prop.label, 0, 3);
      }
    } else if (prop.type === 'ammo_crate') {
      // Munitions Crate with locking latch
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-prop.width / 2 + 3, -prop.height / 2 + 3, prop.width, prop.height);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);

      // Yellow ammo stencil band
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-prop.width / 2, -2, prop.width, 4);

      if (prop.label) {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(prop.label, 0, 2);
      }
    } else if (prop.type === 'explosive_barrel') {
      // High-Hazard Plasma Fuel Drum
      const pulse = Math.sin(tick * 0.1) * 3;

      // Glow shadow
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8 + pulse;

      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(0, 0, prop.width / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glowing core
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 0, prop.width / 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    } else if (prop.type === 'barrier') {
      // Heavy Concrete Blast Barrier with hazard stripes
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-prop.width / 2 + 4, -prop.height / 2 + 4, prop.width, prop.height);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(-prop.width / 2, -prop.height / 2, prop.width, prop.height);

      // Yellow / Black Hazard Chevrons
      const stripeHeight = 15;
      for (let y = -prop.height / 2; y < prop.height / 2; y += stripeHeight * 2) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-prop.width / 2 + 2, y, prop.width - 4, stripeHeight);
      }
    }

    ctx.restore();
  }
}

function drawObstacles(ctx: CanvasRenderingContext2D, sim: GameSimulation) {
  for (const obs of sim.obstacles) {
    ctx.save();
    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(obs.x + 4, obs.y + 4, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Granite rubble boulder
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(obs.x, obs.y, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawStructures(ctx: CanvasRenderingContext2D, sim: GameSimulation, tick: number) {
  for (const s of sim.structures) {
    if (s.hp <= 0) {
      ctx.save();
      ctx.fillStyle = '#111827';
      ctx.fillRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ANNIHILATED', s.x, s.y + 3);
      ctx.restore();
      continue;
    }

    const isP1 = s.owner === 'p1';
    const mainColor = isP1 ? '#0284c7' : '#dc2626';
    const accentColor = isP1 ? '#38bdf8' : '#f87171';
    const glowColor = isP1 ? 'rgba(56, 189, 248, 0.5)' : 'rgba(248, 113, 113, 0.5)';

    ctx.save();

    if (s.type === 'hq') {
      // COMMAND HEADQUARTERS FORTRESS
      // Ambient core glow
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 18;

      ctx.fillStyle = isP1 ? '#0369a1' : '#991b1b';
      ctx.fillRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);

      // Heavy bunker armor plates
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(s.x - 30, s.y - 30, 60, 60);

      // Rotating radar dish on dome
      const radarAngle = tick * 0.05;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(radarAngle);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI);
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.fillRect(0, -3, 16, 6);
      ctx.restore();

      // Blinking command beacons
      const blink = Math.sin(tick * 0.15) > 0;
      ctx.fillStyle = blink ? '#22c55e' : '#15803d';
      ctx.beginPath();
      ctx.arc(s.x - 36, s.y - 36, 4, 0, Math.PI * 2);
      ctx.arc(s.x + 36, s.y - 36, 4, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isP1 ? 'ALPHA HQ' : 'OMEGA HQ', s.x, s.y - s.height / 2 - 10);
    } else if (s.type === 'tower') {
      // DEFENSIVE RAILGUN SENTRY TOWER
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);

      // Turret base
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Aiming cannon
      let aimAngle = isP1 ? 0 : Math.PI;
      if (s.targetId) {
        const target = sim.units.find((u) => u.id === s.targetId);
        if (target) {
          aimAngle = Math.atan2(target.y - s.y, target.x - s.x);
        }
      }

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(aimAngle);

      // Dual railgun barrels
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, -7, 24, 5);
      ctx.fillRect(0, 2, 24, 5);

      // Glowing accelerator coils
      ctx.fillStyle = accentColor;
      ctx.fillRect(10, -8, 4, 16);
      ctx.restore();

      // Range indicator ring (subtle)
      ctx.strokeStyle = isP1 ? 'rgba(56, 189, 248, 0.08)' : 'rgba(248, 113, 113, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.attackRange, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.type === 'repair_station') {
      // NANO-REPAIR BAY WITH ROTATING HOLOGRAPHIC CROSS
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);

      // Pulsing green nano wave
      const waveRadius = 20 + ((tick * 1.5) % 80);
      ctx.strokeStyle = `rgba(16, 185, 129, ${Math.max(0, 1 - waveRadius / 80)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, waveRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating medical cross
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(tick * 0.03);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(-4, -14, 8, 28);
      ctx.fillRect(-14, -4, 28, 8);
      ctx.restore();
    } else if (s.type === 'generator') {
      // PLASMA REACTOR WITH SPINNING TURBINE
      ctx.fillStyle = '#312e81';
      ctx.fillRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);

      // Core
      ctx.shadowColor = '#818cf8';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#c7d2fe';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
      ctx.fill();

      // Turbine blades
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(-tick * 0.08);
      ctx.strokeStyle = '#4338ca';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos((i * Math.PI) / 2) * 14, Math.sin((i * Math.PI) / 2) * 14);
        ctx.stroke();
      }
      ctx.restore();
      ctx.shadowBlur = 0;
    } else {
      // Aegis Wall / Forward Barracks
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - s.width / 2, s.y - s.height / 2, s.width, s.height);
    }

    // Health Bar
    const hpPercent = Math.max(0, s.hp / s.maxHp);
    const barWidth = s.width;
    const barHeight = 6;
    const barX = s.x - barWidth / 2;
    const barY = s.y + s.height / 2 + 6;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpColor = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.restore();
  }
}

function drawUnits(ctx: CanvasRenderingContext2D, sim: GameSimulation, tick: number, localPlayer: 'p1' | 'p2') {
  for (const u of sim.units) {
    const isP1 = u.owner === 'p1';
    const mainColor = isP1 ? '#0ea5e9' : '#ef4444';
    const accentColor = isP1 ? '#7dd3fc' : '#fca5a5';

    ctx.save();
    ctx.translate(u.x, u.y);

    // Selection Halo
    if (u.selected) {
      ctx.strokeStyle = u.owner === localPlayer ? '#38bdf8' : '#f87171';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, u.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Rotate unit towards its facing angle
    ctx.rotate(u.facingAngle);

    // 1. SCOUT VANGUARD: Sleek speeder with dual glowing ion thrusters
    if (u.classType === 'scout') {
      // Thruster exhaust plumes
      ctx.fillStyle = isP1 ? '#38bdf8' : '#f87171';
      ctx.beginPath();
      ctx.arc(-u.radius - 2, -4, 2.5, 0, Math.PI * 2);
      ctx.arc(-u.radius - 2, 4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Dart chassis
      ctx.fillStyle = mainColor;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(u.radius + 5, 0);
      ctx.lineTo(-u.radius, -u.radius * 0.7);
      ctx.lineTo(-u.radius * 0.4, 0);
      ctx.lineTo(-u.radius, u.radius * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cockpit visor
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(2, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // 2. GUARDIAN DEFENDER: Heavy Walker with Hexagonal Aegis Forcefield
    else if (u.classType === 'guardian') {
      // Pulsing Hexagonal Shield
      const shieldAlpha = 0.35 + Math.sin(tick * 0.1) * 0.15;
      ctx.strokeStyle = isP1 ? `rgba(56, 189, 248, ${shieldAlpha})` : `rgba(248, 113, 113, ${shieldAlpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, u.radius + 5, 0, Math.PI * 2);
      ctx.stroke();

      // Heavy armor chassis
      ctx.fillStyle = isP1 ? '#0369a1' : '#991b1b';
      ctx.fillRect(-u.radius, -u.radius, u.radius * 2, u.radius * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(-u.radius, -u.radius, u.radius * 2, u.radius * 2);

      // Front blast shield arc
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(u.radius - 4, -u.radius, 6, u.radius * 2);
    }
    // 3. RANGER MARKSMAN: Sniper with red/blue targeting laser beam
    else if (u.classType === 'ranger') {
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(0, 0, u.radius * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Elongated sniper rifle barrel
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, -2.5, u.radius + 14, 5);

      // Sniper laser sight
      ctx.strokeStyle = isP1 ? 'rgba(56, 189, 248, 0.6)' : 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(u.radius + 14, 0);
      ctx.lineTo(u.radius + 180, 0);
      ctx.stroke();
    }
    // 4. HEAVY TITAN: Massive twin-cannon siege tank with treads
    else if (u.classType === 'heavy') {
      // Tank treads
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-u.radius, -u.radius - 4, u.radius * 2, 6);
      ctx.fillRect(-u.radius, u.radius - 2, u.radius * 2, 6);

      // Tank Hull
      ctx.fillStyle = isP1 ? '#0369a1' : '#7f1d1d';
      ctx.fillRect(-u.radius + 2, -u.radius, u.radius * 2 - 4, u.radius * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-u.radius + 2, -u.radius, u.radius * 2 - 4, u.radius * 2);

      // Dual heavy cannons
      ctx.fillStyle = '#334155';
      ctx.fillRect(2, -9, 20, 6);
      ctx.fillRect(2, 3, 20, 6);
    }
    // 5. SIEGE MORTAR: Heavy quad-leg artillery platform
    else if (u.classType === 'siege') {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, u.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Huge Mortar Barrel
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, -6, u.radius + 12, 12);
    }
    // 6. ASSAULT SPECIALIST: Rapid burst infantry mech
    else {
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(0, 0, u.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Assault Rifle with double barrel
      ctx.fillStyle = accentColor;
      ctx.fillRect(2, -4, u.radius + 8, 8);
    }

    ctx.restore();

    // Unit Health Bar
    const hpPercent = Math.max(0, u.hp / u.maxHp);
    const barWidth = u.radius * 2.4;
    const barHeight = 4.5;
    const barX = u.x - barWidth / 2;
    const barY = u.y - u.radius - 10;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpColor = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, sim: GameSimulation) {
  for (const p of sim.projectiles) {
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;

    if (p.isSiege) {
      // Arcing Artillery Mortar Shell
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Laser bolt
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawVisualFX(ctx: CanvasRenderingContext2D, sim: GameSimulation) {
  for (const p of sim.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const t of sim.floatingTexts) {
    const alpha = Math.max(0, t.life / t.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = t.color;
    ctx.font = 'black 13px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 5;
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, start: Vector2D, current: Vector2D) {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const w = Math.abs(current.x - start.x);
  const h = Math.abs(current.y - start.y);

  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawDeploymentZoneHighlight(
  ctx: CanvasRenderingContext2D,
  mouse: Vector2D,
  unitClass: UnitClass,
  role: 'p1' | 'p2'
) {
  const zone = DEPLOYMENT_ZONES[role];
  const inZone =
    mouse.x >= zone.minX && mouse.x <= zone.maxX && mouse.y >= zone.minY && mouse.y <= zone.maxY;

  ctx.save();
  ctx.strokeStyle = inZone ? '#22c55e' : '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 8]);
  ctx.fillStyle = inZone ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.08)';
  ctx.fillRect(zone.minX, zone.minY, zone.maxX - zone.minX, zone.maxY - zone.minY);
  ctx.strokeRect(zone.minX, zone.minY, zone.maxX - zone.minX, zone.maxY - zone.minY);
  ctx.setLineDash([]);

  // Ghost indicator under cursor
  ctx.fillStyle = inZone ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(inZone ? `Deploy ${unitClass.toUpperCase()}` : 'Invalid Deployment Area', mouse.x, mouse.y - 25);

  ctx.restore();
}
