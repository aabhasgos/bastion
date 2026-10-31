import type {
  GamePhase,
  MatchStats,
  Obstacle,
  Particle,
  FloatingText,
  PlayerId,
  Projectile,
  StructureInstance,
  UnitClass,
  UnitInstance,
} from '../types/game';
import {
  ATTACK_PHASE_TIME,
  ARMY_SELECTION_TIME,
  BATTLE_PREP_TIME,
  BATTLEFIELD_CRATES_AND_PROPS,
  BATTLEFIELD_OBSTACLES,
  CLAN_DEFINITIONS,
  DEPLOYMENT_ZONES,
  INITIAL_STRUCTURES,
  MAP_HEIGHT,
  MAP_WIDTH,
  UNIT_DEFINITIONS,
} from '../constants/gameConfig';
import type { BattlefieldCrate } from '../constants/gameConfig';
import { soundManager } from '../services/soundEffects';

export interface ScorchMark {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

export interface UnitInternal extends UnitInstance {
  lane?: 'top' | 'mid' | 'bot';
  lastPosX?: number;
  lastPosY?: number;
  stuckTimer?: number;
  attackAnimTimer?: number;
}

export class GameSimulation {
  public phase: GamePhase = 'MENU';
  public phaseTimeRemaining: number = 0;
  public totalMatchElapsed: number = 0;

  public p1Army: UnitClass[] = [];
  public p2Army: UnitClass[] = [];
  public p1Reserve: UnitClass[] = [];
  public p2Reserve: UnitClass[] = [];
  public p1Locked: boolean = false;
  public p2Locked: boolean = false;

  // Clan Ultimate Cooldowns
  public p1UltimateCooldown: number = 0;
  public p2UltimateCooldown: number = 0;

  public units: UnitInternal[] = [];
  public structures: StructureInstance[] = [];
  public projectiles: Projectile[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public obstacles: Obstacle[] = [...BATTLEFIELD_OBSTACLES];
  public crates: BattlefieldCrate[] = [...BATTLEFIELD_CRATES_AND_PROPS];
  public scorchMarks: ScorchMark[] = [];

  // Visceral Camera Shake
  public screenShake: number = 0;

  // Slow-Mo Dramatic K.O.
  public isSlowMo: boolean = false;
  public slowMoTimer: number = 0;

  public stats: MatchStats = {
    winner: 'draw',
    winReason: '',
    matchDuration: 0,
    p1HQHpPercent: 100,
    p2HQHpPercent: 100,
    p1TotalBuildingHpPercent: 100,
    p2TotalBuildingHpPercent: 100,
    p1UnitsDeployed: 0,
    p2UnitsDeployed: 0,
    p1UnitsLost: 0,
    p2UnitsLost: 0,
    p1DamageDealt: 0,
    p2DamageDealt: 0,
    p1StructuresDestroyed: 0,
    p2StructuresDestroyed: 0,
  };

  private nextEntityId: number = 1000;
  private onPhaseChangeCallback?: (newPhase: GamePhase) => void;

  constructor(onPhaseChange?: (newPhase: GamePhase) => void) {
    this.onPhaseChangeCallback = onPhaseChange;
    this.resetMatch();
  }

  public resetMatch() {
    this.phase = 'MENU';
    this.phaseTimeRemaining = 0;
    this.totalMatchElapsed = 0;
    this.p1Army = [];
    this.p2Army = [];
    this.p1Reserve = [];
    this.p2Reserve = [];
    this.p1Locked = false;
    this.p2Locked = false;
    this.p1UltimateCooldown = 0;
    this.p2UltimateCooldown = 0;
    this.units = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.scorchMarks = [];
    this.screenShake = 0;
    this.isSlowMo = false;
    this.slowMoTimer = 0;
    this.structures = INITIAL_STRUCTURES.map((s) => ({ ...s }));

    this.stats = {
      winner: 'draw',
      winReason: '',
      matchDuration: 0,
      p1HQHpPercent: 100,
      p2HQHpPercent: 100,
      p1TotalBuildingHpPercent: 100,
      p2TotalBuildingHpPercent: 100,
      p1UnitsDeployed: 0,
      p2UnitsDeployed: 0,
      p1UnitsLost: 0,
      p2UnitsLost: 0,
      p1DamageDealt: 0,
      p2DamageDealt: 0,
      p1StructuresDestroyed: 0,
      p2StructuresDestroyed: 0,
    };
  }

  public startArmySelection() {
    this.resetMatch();
    this.phase = 'ARMY_SELECTION';
    this.phaseTimeRemaining = ARMY_SELECTION_TIME;
    this.onPhaseChangeCallback?.('ARMY_SELECTION');
  }

  public lockArmy(playerId: PlayerId, army: UnitClass[]) {
    if (playerId === 'p1') {
      this.p1Army = [...army];
      this.p1Reserve = [...army];
      this.p1Locked = true;
    } else {
      this.p2Army = [...army];
      this.p2Reserve = [...army];
      this.p2Locked = true;
    }

    if (this.p1Locked && this.p2Locked && this.phase === 'ARMY_SELECTION') {
      this.startBattlePrep();
    }
  }

  public startBattlePrep() {
    this.phase = 'BATTLE_PREP';
    this.phaseTimeRemaining = BATTLE_PREP_TIME;
    soundManager.playCountdownTick();
    this.onPhaseChangeCallback?.('BATTLE_PREP');
  }

  public startAttackPhase() {
    this.phase = 'ATTACK_PHASE';
    this.phaseTimeRemaining = ATTACK_PHASE_TIME;
    this.totalMatchElapsed = 0;
    this.p1UltimateCooldown = 5; // Ready shortly into battle
    this.p2UltimateCooldown = 5;
    soundManager.playBattleStart();
    soundManager.startBattleMusic();
    this.triggerScreenShake(10);
    this.onPhaseChangeCallback?.('ATTACK_PHASE');
  }

  public triggerScreenShake(amount: number) {
    this.screenShake = Math.min(25, this.screenShake + amount);
  }

  // Cast Clan Ultimate Ability (Orbital Strike / Meteor Barrage)
  public castUltimate(playerId: PlayerId, targetX: number, targetY: number): boolean {
    if (this.phase !== 'ATTACK_PHASE') return false;

    if (playerId === 'p1' && this.p1UltimateCooldown > 0) return false;
    if (playerId === 'p2' && this.p2UltimateCooldown > 0) return false;

    if (playerId === 'p1') {
      this.p1UltimateCooldown = CLAN_DEFINITIONS.p1.ultimateCooldown;
    } else {
      this.p2UltimateCooldown = CLAN_DEFINITIONS.p2.ultimateCooldown;
    }

    const blastRadius = 130;
    const damage = 280;
    const isP1 = playerId === 'p1';

    soundManager.playUltimateExplosion();
    this.triggerScreenShake(18);
    this.addScorchMark(targetX, targetY, 48);

    // Visual strike shockwave particles
    for (let i = 0; i < 35; i++) {
      const angle = (i / 35) * Math.PI * 2;
      const speed = 120 + Math.random() * 120;
      this.particles.push({
        id: `ult_${this.nextEntityId++}`,
        x: targetX,
        y: targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.7,
        maxLife: 0.7,
        color: isP1 ? '#38bdf8' : '#ef4444',
        size: 5 + Math.random() * 4,
      });
    }

    this.addFloatingText(isP1 ? '⚡ ORBITAL ION CANNON' : '🔥 METEOR STRIKE', targetX, targetY - 45, isP1 ? '#38bdf8' : '#ef4444');

    // Damage all enemy units and structures inside blast radius
    for (const u of this.units) {
      if (u.owner !== playerId && u.hp > 0) {
        const d = Math.hypot(u.x - targetX, u.y - targetY);
        if (d <= blastRadius) {
          const falloff = 1 - d / blastRadius;
          const dmg = damage * (0.5 + falloff * 0.5);
          u.hp = Math.max(0, u.hp - dmg);
          this.addFloatingText(`CRIT -${Math.round(dmg)}`, u.x, u.y - 15, '#fbbf24');
          if (playerId === 'p1') this.stats.p1DamageDealt += dmg;
          else this.stats.p2DamageDealt += dmg;
        }
      }
    }

    for (const s of this.structures) {
      if (s.owner !== playerId && s.hp > 0) {
        const d = Math.hypot(s.x - targetX, s.y - targetY);
        if (d <= blastRadius + 20) {
          const dmg = damage * 0.8;
          s.hp = Math.max(0, s.hp - dmg);
          this.addFloatingText(`-${Math.round(dmg)}`, s.x, s.y - 20, '#f87171');
          if (playerId === 'p1') this.stats.p1DamageDealt += dmg;
          else this.stats.p2DamageDealt += dmg;
        }
      }
    }

    return true;
  }

  // Deploy Unit with Tactical Lane Assignment
  public deployUnit(playerId: PlayerId, unitClass: UnitClass, targetX: number, targetY: number): boolean {
    if (this.phase !== 'ATTACK_PHASE') return false;

    const reserve = playerId === 'p1' ? this.p1Reserve : this.p2Reserve;
    const index = reserve.indexOf(unitClass);
    if (index === -1) return false;

    const zone = DEPLOYMENT_ZONES[playerId];
    const clampedX = Math.max(zone.minX, Math.min(zone.maxX, targetX));
    const clampedY = Math.max(zone.minY, Math.min(zone.maxY, targetY));

    // Determine Lane based on spawn Y
    let lane: 'top' | 'mid' | 'bot' = 'mid';
    if (clampedY < 350) lane = 'top';
    else if (clampedY > 550) lane = 'bot';

    const def = UNIT_DEFINITIONS[unitClass];
    const unit: UnitInternal = {
      id: `unit_${playerId}_${this.nextEntityId++}`,
      owner: playerId,
      classType: unitClass,
      name: def.name,
      x: clampedX,
      y: clampedY,
      vx: 0,
      vy: 0,
      hp: def.maxHp,
      maxHp: def.maxHp,
      damage: def.damage,
      attackRange: def.attackRange,
      attackRate: def.attackRate,
      speed: def.speed,
      radius: def.radius,
      targetPreference: def.targetPreference,
      lastAttackTime: this.totalMatchElapsed,
      targetId: null,
      targetType: null,
      moveTarget: null,
      state: 'idle',
      facingAngle: playerId === 'p1' ? 0 : Math.PI,
      lane,
      lastPosX: clampedX,
      lastPosY: clampedY,
      stuckTimer: 0,
    };

    reserve.splice(index, 1);
    this.units.push(unit);

    if (playerId === 'p1') {
      this.stats.p1UnitsDeployed++;
    } else {
      this.stats.p2UnitsDeployed++;
    }

    soundManager.playUnitDeploy();
    this.createDeploymentEffect(clampedX, clampedY, playerId === 'p1' ? '#38bdf8' : '#f87171');
    this.triggerScreenShake(2);

    return true;
  }

  // Selection
  public selectUnitsInBox(box: { startX: number; startY: number; endX: number; endY: number }, playerId: PlayerId): string[] {
    const minX = Math.min(box.startX, box.endX);
    const maxX = Math.max(box.startX, box.endX);
    const minY = Math.min(box.startY, box.endY);
    const maxY = Math.max(box.startY, box.endY);

    const selectedIds: string[] = [];
    const isSingleClick = Math.abs(box.endX - box.startX) < 6 && Math.abs(box.endY - box.startY) < 6;

    if (isSingleClick) {
      let clickedUnit: UnitInstance | null = null;
      for (const u of this.units) {
        if (u.owner === playerId && Math.hypot(u.x - box.startX, u.y - box.startY) <= u.radius + 14) {
          clickedUnit = u;
          break;
        }
      }
      for (const u of this.units) {
        if (clickedUnit && u.id === clickedUnit.id) {
          u.selected = true;
          selectedIds.push(u.id);
        } else {
          u.selected = false;
        }
      }
    } else {
      for (const u of this.units) {
        if (u.owner === playerId && u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY) {
          u.selected = true;
          selectedIds.push(u.id);
        } else {
          u.selected = false;
        }
      }
    }

    if (selectedIds.length > 0) {
      soundManager.playSelect();
    }

    return selectedIds;
  }

  // Tactical Movement with formation spacing
  public orderUnitsMove(unitIds: string[], targetX: number, targetY: number) {
    const selected = this.units.filter((u) => unitIds.includes(u.id));
    if (selected.length === 0) return;

    soundManager.playSelect();

    const count = selected.length;
    const spacing = 42;
    const cols = Math.ceil(Math.sqrt(count));

    selected.forEach((unit, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const offsetX = (col - (cols - 1) / 2) * spacing;
      const offsetY = (row - (Math.ceil(count / cols) - 1) / 2) * spacing;

      unit.moveTarget = {
        x: Math.max(30, Math.min(MAP_WIDTH - 30, targetX + offsetX)),
        y: Math.max(30, Math.min(MAP_HEIGHT - 30, targetY + offsetY)),
      };
      unit.targetId = null;
      unit.targetType = null;
      unit.state = 'moving';
      unit.stuckTimer = 0;
    });
  }

  public orderUnitsAttack(unitIds: string[], targetId: string, targetType: 'unit' | 'structure') {
    const selected = this.units.filter((u) => unitIds.includes(u.id));
    if (selected.length === 0) return;

    soundManager.playSelect();

    selected.forEach((unit) => {
      unit.targetId = targetId;
      unit.targetType = targetType;
      unit.moveTarget = null;
      unit.stuckTimer = 0;
    });
  }

  // Master Simulation Tick
  public update(dt: number) {
    if (dt <= 0 || dt > 0.1) dt = 0.016;

    // Slow-Mo effect when game ends
    if (this.isSlowMo) {
      dt *= 0.25;
      this.slowMoTimer -= dt;
      if (this.slowMoTimer <= 0) {
        this.isSlowMo = false;
      }
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Cooldown timers
    if (this.p1UltimateCooldown > 0) this.p1UltimateCooldown = Math.max(0, this.p1UltimateCooldown - dt);
    if (this.p2UltimateCooldown > 0) this.p2UltimateCooldown = Math.max(0, this.p2UltimateCooldown - dt);

    if (this.phase === 'ARMY_SELECTION') {
      this.phaseTimeRemaining -= dt;
      if (this.phaseTimeRemaining <= 0) {
        this.phaseTimeRemaining = 0;
        this.p1Locked = true;
        this.p2Locked = true;
        this.startBattlePrep();
      }
      return;
    }

    if (this.phase === 'BATTLE_PREP') {
      const prevInt = Math.ceil(this.phaseTimeRemaining);
      this.phaseTimeRemaining -= dt;
      const currInt = Math.ceil(this.phaseTimeRemaining);
      if (currInt < prevInt && currInt > 0) {
        soundManager.playCountdownTick();
      }
      if (this.phaseTimeRemaining <= 0) {
        this.startAttackPhase();
      }
      return;
    }

    if (this.phase !== 'ATTACK_PHASE') return;

    this.totalMatchElapsed += dt;
    this.phaseTimeRemaining -= dt;

    if (this.phaseTimeRemaining <= 0) {
      this.phaseTimeRemaining = 0;
      this.evaluateTimeoutVictory();
      return;
    }

    this.updateStructures(dt);
    this.updateUnitsAdvanced(dt);
    this.updateProjectiles(dt);
    this.updateVisualEffects(dt);
    this.checkHQDestruction();
  }

  private updateStructures(dt: number) {
    for (const struct of this.structures) {
      if (struct.hp <= 0) continue;

      if (struct.type === 'repair_station') {
        struct.lastRepairTime = (struct.lastRepairTime || 0) + dt;
        if (struct.lastRepairTime >= (struct.repairInterval || 2.0)) {
          struct.lastRepairTime = 0;
          for (const target of this.structures) {
            if (target.owner === struct.owner && target.hp > 0 && target.hp < target.maxHp && target.id !== struct.id) {
              const dist = Math.hypot(target.x - struct.x, target.y - struct.y);
              if (dist <= 180) {
                target.hp = Math.min(target.maxHp, target.hp + 20);
                this.createHealSpark(target.x, target.y);
              }
            }
          }
        }
      }

      if (struct.attackRange > 0 && struct.damage > 0) {
        struct.lastAttackTime += dt;
        const cooldown = 1 / struct.attackRate;

        let bestTarget: UnitInstance | null = null;
        let minDist = struct.attackRange;

        for (const unit of this.units) {
          if (unit.owner !== struct.owner && unit.hp > 0) {
            const dist = Math.hypot(unit.x - struct.x, unit.y - struct.y);
            if (dist < minDist) {
              minDist = dist;
              bestTarget = unit;
            }
          }
        }

        if (bestTarget) {
          struct.targetId = bestTarget.id;
          if (struct.lastAttackTime >= cooldown) {
            struct.lastAttackTime = 0;
            this.fireProjectile({
              x: struct.x,
              y: struct.y,
              targetX: bestTarget.x,
              targetY: bestTarget.y,
              speed: 560,
              damage: struct.damage,
              owner: struct.owner,
              targetId: bestTarget.id,
              targetType: 'unit',
              color: struct.owner === 'p1' ? '#38bdf8' : '#f87171',
              radius: 5,
            });
            soundManager.playLaserShot(0.9);
            this.createMuzzleFlash(struct.x, struct.y, struct.owner === 'p1' ? '#38bdf8' : '#f87171');
          }
        } else {
          struct.targetId = null;
        }
      }
    }
  }

  // ADVANCED UNIT MOVEMENT & ANTI-STUCK SYSTEM
  private updateUnitsAdvanced(dt: number) {
    const aliveUnits: UnitInternal[] = [];
    for (const unit of this.units) {
      if (unit.hp <= 0) {
        if (unit.owner === 'p1') {
          this.stats.p1UnitsLost++;
        } else {
          this.stats.p2UnitsLost++;
        }
        const isBig = unit.radius > 16;
        this.createExplosion(unit.x, unit.y, isBig ? 'large' : 'small');
        this.addScorchMark(unit.x, unit.y, unit.radius * 1.6);
        this.triggerScreenShake(isBig ? 8 : 4);
        soundManager.playExplosion(isBig ? 'large' : 'small');
      } else {
        aliveUnits.push(unit);
      }
    }
    this.units = aliveUnits;

    for (const unit of this.units) {
      this.acquireUnitTarget(unit);

      // Desired Movement Vector
      let desiredVX = 0;
      let desiredVY = 0;

      if (unit.targetId && unit.targetType) {
        const targetEntity = this.getEntityById(unit.targetId, unit.targetType);

        if (!targetEntity || targetEntity.hp <= 0) {
          unit.targetId = null;
          unit.targetType = null;
          unit.state = 'idle';
        } else {
          const dist = Math.hypot(targetEntity.x - unit.x, targetEntity.y - unit.y);
          const effectiveRange = unit.attackRange + (unit.targetType === 'structure' ? 35 : 0);

          if (dist <= effectiveRange) {
            unit.state = 'attacking';
            unit.facingAngle = Math.atan2(targetEntity.y - unit.y, targetEntity.x - unit.x);

            const cooldown = 1 / unit.attackRate;
            if (this.totalMatchElapsed - unit.lastAttackTime >= cooldown) {
              unit.lastAttackTime = this.totalMatchElapsed;
              this.executeUnitAttack(unit, targetEntity);
            }
          } else {
            unit.state = 'moving';
            const dx = targetEntity.x - unit.x;
            const dy = targetEntity.y - unit.y;
            const d = Math.max(1, dist);
            desiredVX = (dx / d) * unit.speed;
            desiredVY = (dy / d) * unit.speed;
          }
        }
      } else if (unit.moveTarget) {
        const dist = Math.hypot(unit.moveTarget.x - unit.x, unit.moveTarget.y - unit.y);
        if (dist < 14) {
          unit.moveTarget = null;
          unit.state = 'idle';
        } else {
          unit.state = 'moving';
          const dx = unit.moveTarget.x - unit.x;
          const dy = unit.moveTarget.y - unit.y;
          desiredVX = (dx / dist) * unit.speed;
          desiredVY = (dy / dist) * unit.speed;
        }
      } else {
        // AUTONOMOUS MARCH ALONG ASSIGNED LANE
        unit.state = 'idle';
        const isP1 = unit.owner === 'p1';
        const targetX = isP1 ? 1480 : 120;
        let targetY = 450;
        if (unit.lane === 'top') targetY = 250;
        else if (unit.lane === 'bot') targetY = 650;

        const dx = targetX - unit.x;
        const dy = targetY - unit.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 30) {
          desiredVX = (dx / dist) * (unit.speed * 0.9);
          desiredVY = (dy / dist) * (unit.speed * 0.9);
        }
      }

      // 1. REYNOLDS FLOCKING SEPARATION (Stops units from sticking or clumping)
      let sepX = 0;
      let sepY = 0;
      for (const other of this.units) {
        if (other.id === unit.id) continue;
        const dx = unit.x - other.x;
        const dy = unit.y - other.y;
        const distSq = dx * dx + dy * dy;
        const desiredDistance = unit.radius + other.radius + 14;

        if (distSq < desiredDistance * desiredDistance && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const strength = (desiredDistance - dist) / desiredDistance;
          sepX += (dx / dist) * strength * 60;
          sepY += (dy / dist) * strength * 60;
        }
      }

      desiredVX += sepX;
      desiredVY += sepY;

      // 2. SMOOTH TANGENTIAL OBSTACLE SLIDE & PENETRATION RESOLUTION
      for (const crate of this.crates) {
        const closestX = Math.max(crate.x - crate.width / 2, Math.min(crate.x + crate.width / 2, unit.x));
        const closestY = Math.max(crate.y - crate.height / 2, Math.min(crate.y + crate.height / 2, unit.y));
        const distX = unit.x - closestX;
        const distY = unit.y - closestY;
        const distSq = distX * distX + distY * distY;
        const minDist = unit.radius + 6;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const nx = distX / dist;
          const ny = distY / dist;
          const overlap = minDist - dist;

          // Push unit out along contact normal
          unit.x += nx * overlap;
          unit.y += ny * overlap;

          // Remove velocity component pushing into obstacle and project along tangent
          const dot = desiredVX * nx + desiredVY * ny;
          if (dot < 0) {
            desiredVX -= dot * nx;
            desiredVY -= dot * ny;
          }
        } else if (distSq < (minDist + 24) * (minDist + 24)) {
          // Anticipatory gentle steering repulsion
          const dist = Math.sqrt(distSq);
          const repulse = (1 - (dist - minDist) / 24) * 50;
          desiredVX += (distX / dist) * repulse;
          desiredVY += (distY / dist) * repulse;
        }
      }

      // 3. ANTI-STUCK WATCHDOG (Instantly frees any unit if forward progress stalls)
      unit.stuckTimer = (unit.stuckTimer || 0) + dt;
      if (unit.stuckTimer >= 0.25) {
        unit.stuckTimer = 0;
        const distMoved = Math.hypot(unit.x - (unit.lastPosX || unit.x), unit.y - (unit.lastPosY || unit.y));
        if (unit.state === 'moving' && distMoved < 4) {
          // Intelligent lateral detour impulse around obstacle
          const detourSign = (unit.y < 450 ? -1 : 1);
          unit.y += detourSign * 16;
          desiredVY += detourSign * (unit.speed * 0.8);
        }
        unit.lastPosX = unit.x;
        unit.lastPosY = unit.y;
      }

      // Apply integrated velocity
      unit.vx = desiredVX;
      unit.vy = desiredVY;

      if (Math.hypot(unit.vx, unit.vy) > 1) {
        unit.x += unit.vx * dt;
        unit.y += unit.vy * dt;
        unit.facingAngle = Math.atan2(unit.vy, unit.vx);
      }

      // Boundaries
      unit.x = Math.max(unit.radius + 10, Math.min(MAP_WIDTH - unit.radius - 10, unit.x));
      unit.y = Math.max(unit.radius + 10, Math.min(MAP_HEIGHT - unit.radius - 10, unit.y));
    }
  }

  private acquireUnitTarget(unit: UnitInstance) {
    if (unit.targetId) return;

    const isSiege = unit.classType === 'siege';

    if (isSiege) {
      const enemyStructures = this.structures.filter((s) => s.owner !== unit.owner && s.hp > 0);
      let nearestStruct: StructureInstance | null = null;
      let minStructDist = 9999;

      for (const s of enemyStructures) {
        const dist = Math.hypot(s.x - unit.x, s.y - unit.y);
        if (dist < minStructDist) {
          minStructDist = dist;
          nearestStruct = s;
        }
      }

      if (nearestStruct && minStructDist <= 460) {
        unit.targetId = nearestStruct.id;
        unit.targetType = 'structure';
        return;
      }
    }

    let nearestHostile: UnitInstance | null = null;
    let minHostileDist = 260;

    for (const other of this.units) {
      if (other.owner !== unit.owner && other.hp > 0) {
        const dist = Math.hypot(other.x - unit.x, other.y - unit.y);
        if (dist < minHostileDist) {
          minHostileDist = dist;
          nearestHostile = other;
        }
      }
    }

    if (nearestHostile) {
      unit.targetId = nearestHostile.id;
      unit.targetType = 'unit';
      return;
    }

    const nearbyStructure = this.structures.find(
      (s) => s.owner !== unit.owner && s.hp > 0 && Math.hypot(s.x - unit.x, s.y - unit.y) < 240
    );
    if (nearbyStructure) {
      unit.targetId = nearbyStructure.id;
      unit.targetType = 'structure';
    }
  }

  private executeUnitAttack(unit: UnitInstance, target: { x: number; y: number; id: string }) {
    const isSiege = unit.classType === 'siege';
    const isRanger = unit.classType === 'ranger';
    const isAssault = unit.classType === 'assault';
    const isHeavy = unit.classType === 'heavy';

    const color = unit.owner === 'p1' ? '#38bdf8' : '#f87171';

    if (isSiege) {
      soundManager.playArtilleryShot();
      this.fireProjectile({
        x: unit.x,
        y: unit.y,
        targetX: target.x,
        targetY: target.y,
        speed: 380,
        damage: unit.damage,
        owner: unit.owner,
        targetId: target.id,
        targetType: unit.targetType,
        color: unit.owner === 'p1' ? '#60a5fa' : '#f87171',
        radius: 7.5,
        isSiege: true,
      });
      this.createMuzzleFlash(unit.x, unit.y, '#f59e0b');
      this.triggerScreenShake(3);
    } else if (isRanger) {
      soundManager.playSniperShot();
      this.fireProjectile({
        x: unit.x,
        y: unit.y,
        targetX: target.x,
        targetY: target.y,
        speed: 720,
        damage: unit.damage,
        owner: unit.owner,
        targetId: target.id,
        targetType: unit.targetType,
        color,
        radius: 3.5,
      });
      this.createMuzzleFlash(unit.x, unit.y, color);
    } else if (isAssault) {
      soundManager.playLaserShot(1.15);
      this.fireProjectile({
        x: unit.x,
        y: unit.y,
        targetX: target.x,
        targetY: target.y,
        speed: 560,
        damage: unit.damage,
        owner: unit.owner,
        targetId: target.id,
        targetType: unit.targetType,
        color,
        radius: 3,
      });
      this.createMuzzleFlash(unit.x, unit.y, color);
    } else if (isHeavy) {
      soundManager.playHeavyCannon();
      this.applyDamageToTarget(target.id, unit.targetType!, unit.damage, unit.owner, true);
      this.createMeleeSlashEffect(target.x, target.y, color);
      this.triggerScreenShake(4);
    } else {
      soundManager.playLaserShot(0.7);
      this.applyDamageToTarget(target.id, unit.targetType!, unit.damage, unit.owner, false);
      this.createMeleeSlashEffect(target.x, target.y, color);
    }
  }

  private fireProjectile(projectile: Omit<Projectile, 'id'>) {
    this.projectiles.push({
      ...projectile,
      id: `proj_${this.nextEntityId++}`,
    });
  }

  private updateProjectiles(dt: number) {
    const activeProjectiles: Projectile[] = [];

    for (const proj of this.projectiles) {
      const dx = proj.targetX - proj.x;
      const dy = proj.targetY - proj.y;
      const dist = Math.hypot(dx, dy);
      const step = proj.speed * dt;

      if (proj.isSiege) {
        this.particles.push({
          id: `trail_${this.nextEntityId++}`,
          x: proj.x,
          y: proj.y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          life: 0.35,
          maxLife: 0.35,
          color: 'rgba(148, 163, 184, 0.7)',
          size: 4 + Math.random() * 3,
        });
      }

      if (dist <= step || dist < 12) {
        if (proj.targetId && proj.targetType) {
          this.applyDamageToTarget(proj.targetId, proj.targetType, proj.damage, proj.owner, false, proj.isSiege);
        }
        this.createImpactSpark(proj.targetX, proj.targetY, proj.color);
        if (proj.isSiege) {
          this.addScorchMark(proj.targetX, proj.targetY, 28);
          this.triggerScreenShake(5);
        }
      } else {
        proj.x += (dx / dist) * step;
        proj.y += (dy / dist) * step;
        activeProjectiles.push(proj);
      }
    }

    this.projectiles = activeProjectiles;
  }

  private applyDamageToTarget(
    targetId: string,
    targetType: 'unit' | 'structure',
    rawDamage: number,
    attackerOwner: PlayerId,
    isHeavySplash: boolean = false,
    isSiegeBonus: boolean = false
  ) {
    let finalDamage = rawDamage;

    if (targetType === 'structure') {
      const struct = this.structures.find((s) => s.id === targetId);
      if (struct && struct.hp > 0) {
        if (isSiegeBonus) {
          finalDamage *= 2.5; // Cataclysm Mortar Demolitionist bonus!
        }
        struct.hp = Math.max(0, struct.hp - finalDamage);

        if (attackerOwner === 'p1') {
          this.stats.p1DamageDealt += finalDamage;
          if (struct.hp <= 0) this.stats.p1StructuresDestroyed++;
        } else {
          this.stats.p2DamageDealt += finalDamage;
          if (struct.hp <= 0) this.stats.p2StructuresDestroyed++;
        }

        this.addFloatingText(`-${Math.round(finalDamage)}`, struct.x, struct.y - 20, '#f87171');
        if (struct.hp <= 0) {
          this.createExplosion(struct.x, struct.y, 'large');
          this.addScorchMark(struct.x, struct.y, 45);
          this.triggerScreenShake(14);
          soundManager.playExplosion('large');
        }
      }
    } else {
      const unit = this.units.find((u) => u.id === targetId);
      if (unit && unit.hp > 0) {
        if (unit.classType === 'guardian' && !isHeavySplash) {
          finalDamage *= 0.75;
        }

        unit.hp = Math.max(0, unit.hp - finalDamage);

        if (attackerOwner === 'p1') {
          this.stats.p1DamageDealt += finalDamage;
        } else {
          this.stats.p2DamageDealt += finalDamage;
        }

        const isCrit = finalDamage > 30;
        this.addFloatingText(isCrit ? `CRIT -${Math.round(finalDamage)}` : `-${Math.round(finalDamage)}`, unit.x, unit.y - 18, isCrit ? '#f59e0b' : '#38bdf8');

        if (isHeavySplash) {
          for (const splashTarget of this.units) {
            if (splashTarget.owner !== attackerOwner && splashTarget.id !== unit.id && splashTarget.hp > 0) {
              const d = Math.hypot(splashTarget.x - unit.x, splashTarget.y - unit.y);
              if (d <= 55) {
                const splashDmg = finalDamage * 0.4;
                splashTarget.hp = Math.max(0, splashTarget.hp - splashDmg);
                this.addFloatingText(`-${Math.round(splashDmg)}`, splashTarget.x, splashTarget.y - 12, '#fbbf24');
              }
            }
          }
        }
      }
    }
  }

  private checkHQDestruction() {
    const p1HQ = this.structures.find((s) => s.owner === 'p1' && s.type === 'hq');
    const p2HQ = this.structures.find((s) => s.owner === 'p2' && s.type === 'hq');

    if (p1HQ && p1HQ.hp <= 0 && this.phase !== 'GAME_OVER') {
      this.triggerSlowMoKO();
      this.endMatch('p2', 'Alpha Citadel Headquarters Obliterated');
    } else if (p2HQ && p2HQ.hp <= 0 && this.phase !== 'GAME_OVER') {
      this.triggerSlowMoKO();
      this.endMatch('p1', 'Crimson Fortress Headquarters Obliterated');
    }
  }

  private triggerSlowMoKO() {
    this.isSlowMo = true;
    this.slowMoTimer = 1.6;
    this.triggerScreenShake(24);
  }

  private evaluateTimeoutVictory() {
    const p1HQ = this.structures.find((s) => s.owner === 'p1' && s.type === 'hq')!;
    const p2HQ = this.structures.find((s) => s.owner === 'p2' && s.type === 'hq')!;

    const p1HQPercent = (p1HQ.hp / p1HQ.maxHp) * 100;
    const p2HQPercent = (p2HQ.hp / p2HQ.maxHp) * 100;

    let p1BldHp = 0, p1BldMax = 0;
    let p2BldHp = 0, p2BldMax = 0;

    for (const s of this.structures) {
      if (s.owner === 'p1') {
        p1BldHp += s.hp;
        p1BldMax += s.maxHp;
      } else {
        p2BldHp += s.hp;
        p2BldMax += s.maxHp;
      }
    }

    const p1TotalBldPercent = (p1BldHp / p1BldMax) * 100;
    const p2TotalBldPercent = (p2BldHp / p2BldMax) * 100;

    this.stats.p1HQHpPercent = Math.round(p1HQPercent);
    this.stats.p2HQHpPercent = Math.round(p2HQPercent);
    this.stats.p1TotalBuildingHpPercent = Math.round(p1TotalBldPercent);
    this.stats.p2TotalBuildingHpPercent = Math.round(p2TotalBldPercent);

    if (p1HQPercent > p2HQPercent) {
      this.endMatch('p1', `Timer Expired: Higher Headquarters Health (${Math.round(p1HQPercent)}% vs ${Math.round(p2HQPercent)}%)`);
      return;
    } else if (p2HQPercent > p1HQPercent) {
      this.endMatch('p2', `Timer Expired: Higher Headquarters Health (${Math.round(p2HQPercent)}% vs ${Math.round(p1HQPercent)}%)`);
      return;
    }

    if (p1TotalBldPercent > p2TotalBldPercent) {
      this.endMatch('p1', `Timer Expired: Superior Base Infrastructure Integrity (${Math.round(p1TotalBldPercent)}% vs ${Math.round(p2TotalBldPercent)}%)`);
      return;
    } else if (p2TotalBldPercent > p1TotalBldPercent) {
      this.endMatch('p2', `Timer Expired: Superior Base Infrastructure Integrity (${Math.round(p2TotalBldPercent)}% vs ${Math.round(p1TotalBldPercent)}%)`);
      return;
    }

    if (this.stats.p1DamageDealt > this.stats.p2DamageDealt) {
      this.endMatch('p1', `Timer Expired: Greater Base Assault Damage (${Math.round(this.stats.p1DamageDealt)} vs ${Math.round(this.stats.p2DamageDealt)})`);
      return;
    } else if (this.stats.p2DamageDealt > this.stats.p1DamageDealt) {
      this.endMatch('p2', `Timer Expired: Greater Base Assault Damage (${Math.round(this.stats.p2DamageDealt)} vs ${Math.round(this.stats.p1DamageDealt)})`);
      return;
    }

    this.endMatch('draw', 'Timer Expired: Dead Heat Across All Metrics');
  }

  private endMatch(winner: PlayerId | 'draw', reason: string) {
    this.phase = 'GAME_OVER';
    this.stats.winner = winner;
    this.stats.winReason = reason;
    this.stats.matchDuration = Math.round(this.totalMatchElapsed);
    soundManager.stopBattleMusic();

    if (winner === 'p1') {
      soundManager.playVictoryFanfare();
    } else {
      soundManager.playDefeat();
    }

    this.onPhaseChangeCallback?.('GAME_OVER');
  }

  private getEntityById(id: string, type: 'unit' | 'structure') {
    if (type === 'unit') {
      return this.units.find((u) => u.id === id);
    }
    return this.structures.find((s) => s.id === id);
  }

  public addScorchMark(x: number, y: number, radius: number) {
    this.scorchMarks.push({
      x,
      y,
      radius,
      alpha: 0.85,
    });
    if (this.scorchMarks.length > 35) {
      this.scorchMarks.shift();
    }
  }

  private createMuzzleFlash(x: number, y: number, color: string) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        id: `mf_${this.nextEntityId++}`,
        x,
        y,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        life: 0.12,
        maxLife: 0.12,
        color,
        size: 3.5,
      });
    }
  }

  private createExplosion(x: number, y: number, intensity: 'small' | 'large') {
    const count = intensity === 'large' ? 32 : 16;
    const colors = ['#f97316', '#ef4444', '#fbbf24', '#ffffff', '#38bdf8'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * (intensity === 'large' ? 200 : 100);
      this.particles.push({
        id: `p_${this.nextEntityId++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * (intensity === 'large' ? 7 : 3.5),
      });
    }
  }

  private createDeploymentEffect(x: number, y: number, color: string) {
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 70;
      this.particles.push({
        id: `dep_${this.nextEntityId++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45,
        maxLife: 0.45,
        color,
        size: 4.5,
      });
    }
  }

  private createImpactSpark(x: number, y: number, color: string) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        id: `spk_${this.nextEntityId++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25,
        maxLife: 0.25,
        color,
        size: 3,
      });
    }
  }

  private createHealSpark(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        id: `heal_${this.nextEntityId++}`,
        x: x + (Math.random() * 40 - 20),
        y: y + (Math.random() * 40 - 20),
        vx: 0,
        vy: -25,
        life: 0.4,
        maxLife: 0.4,
        color: '#10b981',
        size: 3.5,
      });
    }
  }

  private createMeleeSlashEffect(x: number, y: number, color: string) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        id: `slash_${this.nextEntityId++}`,
        x: x + (Math.random() * 16 - 8),
        y: y + (Math.random() * 16 - 8),
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 50,
        life: 0.22,
        maxLife: 0.22,
        color,
        size: 3.5,
      });
    }
  }

  private addFloatingText(text: string, x: number, y: number, color: string) {
    this.floatingTexts.push({
      id: `flt_${this.nextEntityId++}`,
      text,
      x,
      y,
      life: 0.75,
      maxLife: 0.75,
      color,
      vy: -35,
    });
  }

  private updateVisualEffects(dt: number) {
    const activeParticles: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life > 0) {
        activeParticles.push(p);
      }
    }
    this.particles = activeParticles;

    const activeText: FloatingText[] = [];
    for (const t of this.floatingTexts) {
      t.life -= dt;
      t.y += t.vy * dt;
      if (t.life > 0) {
        activeText.push(t);
      }
    }
    this.floatingTexts = activeText;
  }
}
