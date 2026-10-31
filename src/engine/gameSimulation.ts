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

  public units: UnitInstance[] = [];
  public structures: StructureInstance[] = [];
  public projectiles: Projectile[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public obstacles: Obstacle[] = [...BATTLEFIELD_OBSTACLES];
  public crates: BattlefieldCrate[] = [...BATTLEFIELD_CRATES_AND_PROPS];
  public scorchMarks: ScorchMark[] = [];

  // Visceral Camera Shake (trauma system)
  public screenShake: number = 0;

  // Tactical combat statistics
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
    this.units = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.scorchMarks = [];
    this.screenShake = 0;
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

    // If both players have locked, or when timer expires
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
    soundManager.playBattleStart();
    this.triggerScreenShake(8);
    this.onPhaseChangeCallback?.('ATTACK_PHASE');
  }

  public triggerScreenShake(amount: number) {
    this.screenShake = Math.min(22, this.screenShake + amount);
  }

  // Unit deployment validation and execution
  public deployUnit(playerId: PlayerId, unitClass: UnitClass, targetX: number, targetY: number): boolean {
    if (this.phase !== 'ATTACK_PHASE') return false;

    // Check if player has this unit in reserve
    const reserve = playerId === 'p1' ? this.p1Reserve : this.p2Reserve;
    const index = reserve.indexOf(unitClass);
    if (index === -1) return false;

    // Verify deployment area boundary
    const zone = DEPLOYMENT_ZONES[playerId];
    const clampedX = Math.max(zone.minX, Math.min(zone.maxX, targetX));
    const clampedY = Math.max(zone.minY, Math.min(zone.maxY, targetY));

    const def = UNIT_DEFINITIONS[unitClass];
    const unit: UnitInstance = {
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

  // Marquee selection or single selection
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
        if (u.owner === playerId && Math.hypot(u.x - box.startX, u.y - box.startY) <= u.radius + 8) {
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

  // Command selected units to move
  public orderUnitsMove(unitIds: string[], targetX: number, targetY: number) {
    const selected = this.units.filter((u) => unitIds.includes(u.id));
    if (selected.length === 0) return;

    soundManager.playSelect();

    const count = selected.length;
    const spacing = 36;
    const cols = Math.ceil(Math.sqrt(count));

    selected.forEach((unit, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const offsetX = (col - (cols - 1) / 2) * spacing;
      const offsetY = (row - (Math.ceil(count / cols) - 1) / 2) * spacing;

      unit.moveTarget = {
        x: Math.max(20, Math.min(MAP_WIDTH - 20, targetX + offsetX)),
        y: Math.max(20, Math.min(MAP_HEIGHT - 20, targetY + offsetY)),
      };
      unit.targetId = null;
      unit.targetType = null;
      unit.state = 'moving';
    });
  }

  // Command selected units to attack a specific target
  public orderUnitsAttack(unitIds: string[], targetId: string, targetType: 'unit' | 'structure') {
    const selected = this.units.filter((u) => unitIds.includes(u.id));
    if (selected.length === 0) return;

    soundManager.playSelect();

    selected.forEach((unit) => {
      unit.targetId = targetId;
      unit.targetType = targetType;
      unit.moveTarget = null;
    });
  }

  // Main simulation tick
  public update(dt: number) {
    if (dt <= 0 || dt > 0.1) dt = 0.016;

    // Camera shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Handle timers
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
    this.updateUnits(dt);
    this.updateProjectiles(dt);
    this.updateVisualEffects(dt);
    this.checkHQDestruction();
  }

  private updateStructures(dt: number) {
    for (const struct of this.structures) {
      if (struct.hp <= 0) continue;

      // Repair station logic
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

      // Defensive tower & HQ defense turret attack logic
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
              speed: 520,
              damage: struct.damage,
              owner: struct.owner,
              targetId: bestTarget.id,
              targetType: 'unit',
              color: struct.owner === 'p1' ? '#38bdf8' : '#f87171',
              radius: 5,
            });
            soundManager.playLaserShot(0.85);
            this.createMuzzleFlash(struct.x, struct.y, struct.owner === 'p1' ? '#38bdf8' : '#f87171');
          }
        } else {
          struct.targetId = null;
        }
      }
    }
  }

  private updateUnits(dt: number) {
    const aliveUnits: UnitInstance[] = [];
    for (const unit of this.units) {
      if (unit.hp <= 0) {
        if (unit.owner === 'p1') {
          this.stats.p1UnitsLost++;
        } else {
          this.stats.p2UnitsLost++;
        }
        const isBig = unit.radius > 16;
        this.createExplosion(unit.x, unit.y, isBig ? 'large' : 'small');
        this.addScorchMark(unit.x, unit.y, unit.radius * 1.5);
        this.triggerScreenShake(isBig ? 7 : 3);
        soundManager.playExplosion(isBig ? 'large' : 'small');
      } else {
        aliveUnits.push(unit);
      }
    }
    this.units = aliveUnits;

    for (const unit of this.units) {
      this.acquireUnitTarget(unit);

      if (unit.targetId && unit.targetType) {
        const targetEntity = this.getEntityById(unit.targetId, unit.targetType);

        if (!targetEntity || targetEntity.hp <= 0) {
          unit.targetId = null;
          unit.targetType = null;
          unit.state = 'idle';
        } else {
          const dist = Math.hypot(targetEntity.x - unit.x, targetEntity.y - unit.y);
          const effectiveRange = unit.attackRange + (unit.targetType === 'structure' ? 30 : 0);

          if (dist <= effectiveRange) {
            unit.state = 'attacking';
            unit.vx = 0;
            unit.vy = 0;
            unit.facingAngle = Math.atan2(targetEntity.y - unit.y, targetEntity.x - unit.x);

            const cooldown = 1 / unit.attackRate;
            if (this.totalMatchElapsed - unit.lastAttackTime >= cooldown) {
              unit.lastAttackTime = this.totalMatchElapsed;
              this.executeUnitAttack(unit, targetEntity);
            }
          } else {
            unit.state = 'moving';
            this.moveUnitTowards(unit, targetEntity.x, targetEntity.y, dt);
          }
        }
      } else if (unit.moveTarget) {
        const dist = Math.hypot(unit.moveTarget.x - unit.x, unit.moveTarget.y - unit.y);
        if (dist < 12) {
          unit.moveTarget = null;
          unit.state = 'idle';
          unit.vx = 0;
          unit.vy = 0;
        } else {
          unit.state = 'moving';
          this.moveUnitTowards(unit, unit.moveTarget.x, unit.moveTarget.y, dt);
        }
      } else {
        unit.state = 'idle';
        unit.vx = 0;
        unit.vy = 0;

        const enemyHQ = this.structures.find((s) => s.owner !== unit.owner && s.type === 'hq' && s.hp > 0);
        if (enemyHQ) {
          this.moveUnitTowards(unit, enemyHQ.x, enemyHQ.y, dt);
        }
      }

      // Unit soft repulsion
      for (const other of this.units) {
        if (other.id === unit.id) continue;
        const dist = Math.hypot(other.x - unit.x, other.y - unit.y);
        const minDist = unit.radius + other.radius + 2;
        if (dist < minDist && dist > 0.001) {
          const overlap = (minDist - dist) * 0.5;
          const nx = (unit.x - other.x) / dist;
          const ny = (unit.y - other.y) / dist;
          unit.x += nx * overlap;
          unit.y += ny * overlap;
        }
      }

      // Crate & Barrel obstacle avoidance/collision
      for (const crate of this.crates) {
        const halfW = crate.width / 2;
        const halfH = crate.height / 2;
        const dx = unit.x - crate.x;
        const dy = unit.y - crate.y;
        if (Math.abs(dx) < halfW + unit.radius && Math.abs(dy) < halfH + unit.radius) {
          const pushX = (halfW + unit.radius - Math.abs(dx)) * Math.sign(dx);
          const pushY = (halfH + unit.radius - Math.abs(dy)) * Math.sign(dy);
          if (Math.abs(pushX) < Math.abs(pushY)) {
            unit.x += pushX * 0.5;
          } else {
            unit.y += pushY * 0.5;
          }
        }
      }

      unit.x = Math.max(unit.radius, Math.min(MAP_WIDTH - unit.radius, unit.x));
      unit.y = Math.max(unit.radius, Math.min(MAP_HEIGHT - unit.radius, unit.y));
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

      if (nearestStruct && minStructDist <= 420) {
        unit.targetId = nearestStruct.id;
        unit.targetType = 'structure';
        return;
      }
    }

    let nearestHostile: UnitInstance | null = null;
    let minHostileDist = 240;

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
      (s) => s.owner !== unit.owner && s.hp > 0 && Math.hypot(s.x - unit.x, s.y - unit.y) < 220
    );
    if (nearbyStructure) {
      unit.targetId = nearbyStructure.id;
      unit.targetType = 'structure';
    }
  }

  private moveUnitTowards(unit: UnitInstance, targetX: number, targetY: number, dt: number) {
    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      const dirX = dx / dist;
      const dirY = dy / dist;

      unit.vx = dirX * unit.speed;
      unit.vy = dirY * unit.speed;
      unit.x += unit.vx * dt;
      unit.y += unit.vy * dt;
      unit.facingAngle = Math.atan2(dirY, dirX);
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
        speed: 360,
        damage: unit.damage,
        owner: unit.owner,
        targetId: target.id,
        targetType: unit.targetType,
        color: unit.owner === 'p1' ? '#60a5fa' : '#f87171',
        radius: 7,
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
        speed: 680,
        damage: unit.damage,
        owner: unit.owner,
        targetId: target.id,
        targetType: unit.targetType,
        color,
        radius: 3.5,
      });
      this.createMuzzleFlash(unit.x, unit.y, color);
    } else if (isAssault) {
      soundManager.playLaserShot(1.1);
      this.fireProjectile({
        x: unit.x,
        y: unit.y,
        targetX: target.x,
        targetY: target.y,
        speed: 540,
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
      // Scout / Guardian
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

      // Spawn smoke trail for artillery mortar
      if (proj.isSiege) {
        this.particles.push({
          id: `trail_${this.nextEntityId++}`,
          x: proj.x,
          y: proj.y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 0.35,
          maxLife: 0.35,
          color: 'rgba(148, 163, 184, 0.6)',
          size: 4 + Math.random() * 3,
        });
      }

      if (dist <= step || dist < 12) {
        if (proj.targetId && proj.targetType) {
          this.applyDamageToTarget(proj.targetId, proj.targetType, proj.damage, proj.owner, false, proj.isSiege);
        }
        this.createImpactSpark(proj.targetX, proj.targetY, proj.color);
        if (proj.isSiege) {
          this.addScorchMark(proj.targetX, proj.targetY, 26);
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
          finalDamage *= 2.5;
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
          this.triggerScreenShake(12);
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

        this.addFloatingText(`-${Math.round(finalDamage)}`, unit.x, unit.y - 15, '#fbbf24');

        if (isHeavySplash) {
          for (const splashTarget of this.units) {
            if (splashTarget.owner !== attackerOwner && splashTarget.id !== unit.id && splashTarget.hp > 0) {
              const d = Math.hypot(splashTarget.x - unit.x, splashTarget.y - unit.y);
              if (d <= 50) {
                const splashDmg = finalDamage * 0.4;
                splashTarget.hp = Math.max(0, splashTarget.hp - splashDmg);
                this.addFloatingText(`-${Math.round(splashDmg)}`, splashTarget.x, splashTarget.y - 10, '#f59e0b');
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

    if (p1HQ && p1HQ.hp <= 0) {
      this.endMatch('p2', 'Enemy Command Headquarters Annihilated');
    } else if (p2HQ && p2HQ.hp <= 0) {
      this.endMatch('p1', 'Enemy Command Headquarters Annihilated');
    }
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
    this.triggerScreenShake(15);

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

  // Visual FX Helpers
  public addScorchMark(x: number, y: number, radius: number) {
    this.scorchMarks.push({
      x,
      y,
      radius,
      alpha: 0.8,
    });
    // Keep up to 30 scorch marks
    if (this.scorchMarks.length > 30) {
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
    const count = intensity === 'large' ? 28 : 14;
    const colors = ['#f97316', '#ef4444', '#fbbf24', '#ffffff'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * (intensity === 'large' ? 180 : 90);
      this.particles.push({
        id: `p_${this.nextEntityId++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * (intensity === 'large' ? 6 : 3),
      });
    }
  }

  private createDeploymentEffect(x: number, y: number, color: string) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      this.particles.push({
        id: `dep_${this.nextEntityId++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45,
        maxLife: 0.45,
        color,
        size: 4,
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
        size: 2.8,
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
        size: 3,
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
      life: 0.7,
      maxLife: 0.7,
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
