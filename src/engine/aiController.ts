import type { AIDifficulty, UnitClass, UnitInstance, StructureInstance } from '../types/game';
import { MAX_CP, UNIT_DEFINITIONS } from '../constants/gameConfig';

export class AIController {
  private difficulty: AIDifficulty;
  private army: UnitClass[] = [];
  private deploymentQueue: UnitClass[] = [];
  private lastDeployTime: number = 0;
  private deployInterval: number = 2.5; // seconds between deployments
  public activeStrategy: 'wave_push' | 'split_push' | 'rush' = 'wave_push';

  constructor(difficulty: AIDifficulty = 'NORMAL') {
    this.difficulty = difficulty;
    this.deployInterval = difficulty === 'HARD' ? 1.8 : difficulty === 'NORMAL' ? 2.5 : 3.5;
  }

  public setDifficulty(difficulty: AIDifficulty) {
    this.difficulty = difficulty;
    this.deployInterval = difficulty === 'HARD' ? 1.8 : difficulty === 'NORMAL' ? 2.5 : 3.5;
  }

  // Generates valid army adhering strictly to 100 CP and roster restrictions
  public selectArmy(): UnitClass[] {
    if (this.difficulty === 'EASY') {
      // Balanced / semi-random army
      this.army = this.generateRandomArmy();
    } else if (this.difficulty === 'NORMAL') {
      // Balanced meta: 2 Guardians (20) + 2 Rangers (20) + 1 Heavy (20) + 1 Siege (20) + 4 Scouts (20) = 100 CP (10 units)
      this.army = [
        'guardian', 'guardian',
        'ranger', 'ranger',
        'heavy',
        'siege',
        'scout', 'scout', 'scout', 'scout',
      ];
    } else {
      // HARD: Devastating Heavy Siege Deathball:
      // 2 Heavy (40) + 2 Siege (40) + 2 Guardians (20) = 100 CP (6 super-elite frontline & demolishers)
      // Alternates with: 2 Heavy (40) + 1 Siege (20) + 2 Rangers (20) + 1 Assault (15) + 1 Scout (5) = 100 CP (7 units)
      const strategies: UnitClass[][] = [
        ['heavy', 'heavy', 'siege', 'siege', 'guardian', 'guardian'],
        ['heavy', 'heavy', 'siege', 'ranger', 'ranger', 'assault', 'scout'],
        ['guardian', 'guardian', 'ranger', 'ranger', 'ranger', 'ranger', 'heavy'], // 20+40+20=80 + 1 Assault (15) + 1 Scout (5) = 100
      ];
      this.army = strategies[Math.floor(Math.random() * strategies.length)];
    }

    this.deploymentQueue = [...this.army];
    return [...this.army];
  }

  private generateRandomArmy(): UnitClass[] {
    const units: UnitClass[] = [];
    let currentCP = 0;
    const counts: Record<UnitClass, number> = {
      scout: 0,
      guardian: 0,
      ranger: 0,
      assault: 0,
      heavy: 0,
      siege: 0,
    };

    const classKeys: UnitClass[] = ['scout', 'guardian', 'ranger', 'assault', 'heavy', 'siege'];

    let attempts = 0;
    while (currentCP < MAX_CP && units.length < 12 && attempts < 100) {
      attempts++;
      const randomClass = classKeys[Math.floor(Math.random() * classKeys.length)];
      const def = UNIT_DEFINITIONS[randomClass];

      if (currentCP + def.cost <= MAX_CP && counts[randomClass] < def.limit) {
        units.push(randomClass);
        currentCP += def.cost;
        counts[randomClass]++;
      }
    }

    // Fill any remaining points with Scouts if possible
    while (currentCP + 5 <= MAX_CP && units.length < 12 && counts.scout < 4) {
      units.push('scout');
      currentCP += 5;
      counts.scout++;
    }

    return units;
  }

  // Returns next unit to deploy and the spawn position (x, y)
  public updateDeployment(currentTime: number): { unitClass: UnitClass; x: number; y: number } | null {
    if (this.deploymentQueue.length === 0) return null;

    if (currentTime - this.lastDeployTime < this.deployInterval) {
      return null;
    }

    this.lastDeployTime = currentTime;

    // Tactical ordering: Hard & Normal deploy tanks first, then ranged/siege behind
    let nextUnitIndex = 0;
    if (this.difficulty !== 'EASY') {
      const preferredOrder: UnitClass[] = ['guardian', 'heavy', 'assault', 'scout', 'ranger', 'siege'];
      for (const pref of preferredOrder) {
        const found = this.deploymentQueue.findIndex((u) => u === pref);
        if (found !== -1) {
          nextUnitIndex = found;
          break;
        }
      }
    }

    const [unitClass] = this.deploymentQueue.splice(nextUnitIndex, 1);

    // AI Base spawn zone: X around 1250 to 1480, Y distributed across Top (240), Mid (450), Bot (660)
    let y = 450;
    if (this.difficulty === 'HARD') {
      // Split into lanes
      const lanes = [250, 450, 650];
      y = lanes[Math.floor(Math.random() * lanes.length)] + (Math.random() * 60 - 30);
    } else {
      y = 200 + Math.random() * 500;
    }

    const x = 1260 + Math.random() * 180;

    return { unitClass, x, y };
  }

  // Update micro AI orders for deployed units
  public updateUnitMicro(
    aiUnits: UnitInstance[],
    playerUnits: UnitInstance[],
    playerStructures: StructureInstance[]
  ) {
    // Enemy (P1) HQ is at (100, 450)
    const p1HQ = playerStructures.find((s) => s.type === 'hq' && s.owner === 'p1');

    for (const unit of aiUnits) {
      if (unit.owner !== 'p2') continue;

      // If unit has no manual order or finished target
      if (unit.classType === 'siege') {
        // Siege units prioritize enemy defensive towers and HQ!
        const towers = playerStructures.filter((s) => s.owner === 'p1' && s.hp > 0);
        if (towers.length > 0) {
          // Find nearest tower or HQ
          let nearest = towers[0];
          let minDist = 99999;
          for (const s of towers) {
            const dist = Math.hypot(s.x - unit.x, s.y - unit.y);
            // Prioritize closer towers over HQ unless HQ is in range
            const priorityWeight = s.type === 'tower' ? dist * 0.8 : dist;
            if (priorityWeight < minDist) {
              minDist = priorityWeight;
              nearest = s;
            }
          }
          unit.targetId = nearest.id;
          unit.targetType = 'structure';
          unit.moveTarget = { x: nearest.x + 100, y: nearest.y };
        }
      } else if (unit.classType === 'ranger' && this.difficulty !== 'EASY') {
        // Kiting: Check if any melee hostile is too close (< 80px)
        const closeEnemy = playerUnits.find(
          (pu) => pu.hp > 0 && Math.hypot(pu.x - unit.x, pu.y - unit.y) < 80
        );
        if (closeEnemy) {
          // Step back towards right side
          unit.moveTarget = { x: Math.min(unit.x + 80, 1500), y: unit.y };
          unit.targetId = closeEnemy.id;
          unit.targetType = 'unit';
        } else if (!unit.targetId && p1HQ) {
          unit.moveTarget = { x: p1HQ.x + 150, y: p1HQ.y };
        }
      } else if (!unit.targetId) {
        // Default attack-march towards enemy base
        if (p1HQ) {
          unit.moveTarget = { x: p1HQ.x + 80, y: p1HQ.y + (Math.random() * 80 - 40) };
        }
      }
    }
  }

  public getRemainingQueue(): UnitClass[] {
    return [...this.deploymentQueue];
  }
}
