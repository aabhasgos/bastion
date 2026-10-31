import React, { useState } from 'react';
import type { UnitClass } from '../types/game';
import { MAX_ARMY_SIZE, MAX_CP, UNIT_DEFINITIONS, CLAN_DEFINITIONS } from '../constants/gameConfig';
import { soundManager } from '../services/soundEffects';
import {
  Shield,
  Crosshair,
  Zap,
  Swords,
  Bomb,
  Flame,
  CheckCircle,
  AlertTriangle,
  Clock,
  Coins,
  Users,
  Sparkles,
} from 'lucide-react';

interface ArmySelectionProps {
  timeRemaining: number;
  onLockArmy: (army: UnitClass[]) => void;
  opponentName?: string;
}

export const ArmySelection: React.FC<ArmySelectionProps> = ({
  timeRemaining,
  onLockArmy,
  opponentName = 'Neural Tactical AI',
}) => {
  const [selectedArmy, setSelectedArmy] = useState<UnitClass[]>([]);

  const classCounts: Record<UnitClass, number> = {
    scout: 0,
    guardian: 0,
    ranger: 0,
    assault: 0,
    heavy: 0,
    siege: 0,
  };

  let usedCP = 0;
  for (const u of selectedArmy) {
    classCounts[u]++;
    usedCP += UNIT_DEFINITIONS[u].cost;
  }

  const remainingCP = MAX_CP - usedCP;

  const handleAddUnit = (unitClass: UnitClass) => {
    const def = UNIT_DEFINITIONS[unitClass];
    if (selectedArmy.length >= MAX_ARMY_SIZE) return;
    if (usedCP + def.cost > MAX_CP) return;
    if (classCounts[unitClass] >= def.limit) return;

    soundManager.playSelect();
    setSelectedArmy([...selectedArmy, unitClass]);
  };

  const handleRemoveUnit = (index: number) => {
    soundManager.playSelect();
    const updated = [...selectedArmy];
    updated.splice(index, 1);
    setSelectedArmy(updated);
  };

  const handleClearArmy = () => {
    soundManager.playSelect();
    setSelectedArmy([]);
  };

  const handleAutoFill = () => {
    soundManager.playSelect();
    const preset: UnitClass[] = [
      'guardian', 'guardian',
      'ranger', 'ranger',
      'heavy',
      'siege',
      'scout', 'scout', 'scout', 'scout',
    ];
    setSelectedArmy(preset);
  };

  const handleLock = () => {
    if (selectedArmy.length === 0) return;
    soundManager.playSelect();
    onLockArmy(selectedArmy);
  };

  const getUnitIcon = (type: UnitClass) => {
    switch (type) {
      case 'scout':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'guardian':
        return <Shield className="w-5 h-5 text-sky-400" />;
      case 'ranger':
        return <Crosshair className="w-5 h-5 text-emerald-400" />;
      case 'assault':
        return <Swords className="w-5 h-5 text-indigo-400" />;
      case 'heavy':
        return <Flame className="w-5 h-5 text-orange-400" />;
      case 'siege':
        return <Bomb className="w-5 h-5 text-rose-400" />;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl text-slate-100 flex flex-col gap-6">
      {/* Top Header: Phase & Countdown */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-2xl md:text-3xl font-black tracking-wider uppercase font-mono bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              {CLAN_DEFINITIONS.p1.name} • WAR RECRUITMENT
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Opponent Clan: <span className="text-rose-400 font-bold">{opponentName}</span> (Secret Composition)
          </p>
        </div>

        {/* 60s Countdown Timer */}
        <div className="flex items-center gap-3 bg-slate-950 px-5 py-2.5 rounded-2xl border border-slate-800">
          <Clock className="w-5 h-5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-400 font-mono tracking-wider">SELECTION TIME</span>
            <span
              className={`text-2xl font-black font-mono ${
                timeRemaining <= 10 ? 'text-rose-500 animate-pulse' : 'text-cyan-400'
              }`}
            >
              {Math.ceil(timeRemaining)}s
            </span>
          </div>
        </div>
      </div>

      {/* Main Selection Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Section: Unit Recruitment Depot (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wider uppercase font-mono text-slate-300">
              Troop Arsenal & Clan Specializations
            </h2>
            <button
              onClick={handleAutoFill}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition underline underline-offset-2 font-mono"
            >
              Load Meta Preset
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(UNIT_DEFINITIONS) as UnitClass[]).map((uClass) => {
              const def = UNIT_DEFINITIONS[uClass];
              const count = classCounts[uClass];
              const isMaxClass = count >= def.limit;
              const cannotAfford = def.cost > remainingCP;
              const isMaxArmy = selectedArmy.length >= MAX_ARMY_SIZE;
              const disabled = isMaxClass || cannotAfford || isMaxArmy;

              return (
                <div
                  key={uClass}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    disabled
                      ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                      : 'bg-slate-950/90 border-slate-800 hover:border-cyan-500/60 hover:shadow-xl hover:shadow-cyan-950/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {getUnitIcon(uClass)}
                        <span className="font-bold text-sm font-mono text-slate-100">{def.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800">
                        {def.cost} CP
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-sans mb-2.5">
                      {def.description}
                    </p>

                    <div className="p-2 bg-slate-900/80 rounded-xl mb-2.5 border border-slate-800/80 flex items-center gap-1.5 text-[11px] font-mono text-cyan-300">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{def.specialAbility}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[11px] font-mono text-slate-400 bg-slate-900/40 p-1.5 rounded-lg mb-2">
                      <div>HP: <span className="text-slate-200 font-bold">{def.maxHp}</span></div>
                      <div>DMG: <span className="text-slate-200 font-bold">{def.damage}</span></div>
                      <div>RNG: <span className="text-slate-200 font-bold">{def.attackRange}</span></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-900">
                    <span className="text-xs text-slate-400 font-mono">
                      Recruited: <span className="text-cyan-400 font-bold">{count}</span> / {def.limit}
                    </span>
                    <button
                      onClick={() => handleAddUnit(uClass)}
                      disabled={disabled}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition flex items-center gap-1 ${
                        disabled
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md active:scale-95'
                      }`}
                    >
                      + Recruit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Section: Army Slot Visualizer & Command Points (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 bg-slate-950/80 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wider uppercase font-mono text-slate-300">
              Command Points & Deployment
            </h2>
            {selectedArmy.length > 0 && (
              <button
                onClick={handleClearArmy}
                className="text-xs text-rose-400 hover:text-rose-300 transition font-mono"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Budget Meters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1 font-mono">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>COMMAND POINTS</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black font-mono text-cyan-400">{remainingCP}</span>
                <span className="text-xs text-slate-400 font-mono">/ 100 CP</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="bg-cyan-400 h-full transition-all duration-300"
                  style={{ width: `${(usedCP / MAX_CP) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1 font-mono">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>ARMY CAPACITY</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black font-mono text-emerald-400">
                  {selectedArmy.length}
                </span>
                <span className="text-xs text-slate-400 font-mono">/ 12 Troops</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="bg-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${(selectedArmy.length / MAX_ARMY_SIZE) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Selected Slots Grid (12 Slots) */}
          <div className="flex-1 flex flex-col gap-2">
            <span className="text-xs text-slate-400 font-mono tracking-wider">
              BATTLE CARRIER ROSTER (CLICK TO DISMISS)
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {Array.from({ length: MAX_ARMY_SIZE }).map((_, idx) => {
                const uClass = selectedArmy[idx];
                if (uClass) {
                  const def = UNIT_DEFINITIONS[uClass];
                  return (
                    <button
                      key={idx}
                      onClick={() => handleRemoveUnit(idx)}
                      className="group relative aspect-square bg-slate-900 border border-cyan-500/40 rounded-xl flex flex-col items-center justify-center p-1 hover:border-rose-500 transition shadow-sm"
                      title={`Dismiss ${def.name}`}
                    >
                      {getUnitIcon(uClass)}
                      <span className="text-[10px] font-bold text-slate-200 mt-1 truncate max-w-full font-mono">
                        {def.name.split(' ')[0]}
                      </span>
                      <span className="text-[9px] font-mono text-cyan-400">{def.cost} CP</span>
                      <div className="absolute inset-0 bg-rose-950/85 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-300 font-bold text-xs transition">
                        ✕
                      </div>
                    </button>
                  );
                }
                return (
                  <div
                    key={idx}
                    className="aspect-square bg-slate-900/40 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-600 text-xs font-mono"
                  >
                    #{idx + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {remainingCP >= 20 && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-950/40 border border-amber-800/40 rounded-xl text-xs text-amber-300 font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>You have {remainingCP} CP unused! Unspent points will not roll over.</span>
            </div>
          )}

          {/* Lock Army Button */}
          <button
            onClick={handleLock}
            disabled={selectedArmy.length === 0}
            className={`w-full py-4 px-4 rounded-2xl font-bold font-mono tracking-wider uppercase text-sm flex items-center justify-center gap-2 transition shadow-xl ${
              selectedArmy.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950/60 active:scale-[0.98]'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            Lock Army Composition ({selectedArmy.length} Troops)
          </button>
        </div>
      </div>
    </div>
  );
};
