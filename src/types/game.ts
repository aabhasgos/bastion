export type PlayerId = 'p1' | 'p2';

export type GamePhase =
  | 'MENU'
  | 'MATCHMAKING'
  | 'ARMY_SELECTION'
  | 'BATTLE_PREP'
  | 'ATTACK_PHASE'
  | 'GAME_OVER';

export type GameMode = 'AI_PRACTICE' | 'ONLINE_MULTIPLAYER' | 'LOCAL_VERSUS';

export type AIDifficulty = 'EASY' | 'NORMAL' | 'HARD';

export type UnitClass =
  | 'scout'
  | 'guardian'
  | 'ranger'
  | 'assault'
  | 'heavy'
  | 'siege';

export type StructureType =
  | 'hq'
  | 'tower'
  | 'barracks'
  | 'generator'
  | 'wall'
  | 'repair_station';

export interface Vector2D {
  x: number;
  y: number;
}

export interface UnitDefinition {
  classType: UnitClass;
  name: string;
  cost: number;
  maxHp: number;
  damage: number;
  attackRange: number; // in pixels
  attackRate: number; // attacks per second
  speed: number; // pixels per second
  radius: number;
  targetPreference: 'hostile' | 'structures' | 'balanced';
  description: string;
  specialAbility: string;
  limit: number;
}

export interface UnitInstance {
  id: string;
  owner: PlayerId;
  classType: UnitClass;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  damage: number;
  attackRange: number;
  attackRate: number;
  speed: number;
  radius: number;
  targetPreference: 'hostile' | 'structures' | 'balanced';
  lastAttackTime: number;
  targetId: string | null;
  targetType: 'unit' | 'structure' | null;
  moveTarget: Vector2D | null;
  state: 'idle' | 'moving' | 'attacking';
  facingAngle: number;
  selected?: boolean;
}

export interface StructureInstance {
  id: string;
  owner: PlayerId;
  type: StructureType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  attackRange: number;
  attackRate: number;
  damage: number;
  lastAttackTime: number;
  targetId: string | null;
  repairInterval?: number;
  lastRepairTime?: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
  owner: PlayerId;
  targetId: string | null;
  targetType: 'unit' | 'structure' | null;
  color: string;
  radius: number;
  isSiege?: boolean;
  splashRadius?: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  vy: number;
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'rock' | 'trench' | 'barricade';
}

export interface MatchStats {
  winner: PlayerId | 'draw';
  winReason: string;
  matchDuration: number;
  p1HQHpPercent: number;
  p2HQHpPercent: number;
  p1TotalBuildingHpPercent: number;
  p2TotalBuildingHpPercent: number;
  p1UnitsDeployed: number;
  p2UnitsDeployed: number;
  p1UnitsLost: number;
  p2UnitsLost: number;
  p1DamageDealt: number;
  p2DamageDealt: number;
  p1StructuresDestroyed: number;
  p2StructuresDestroyed: number;
}

export interface PlayerSelectionState {
  army: UnitClass[];
  locked: boolean;
  ready: boolean;
}
