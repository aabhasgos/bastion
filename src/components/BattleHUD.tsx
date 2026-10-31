import React, { useEffect, useState } from 'react';
import { GameSimulation } from '../engine/gameSimulation';
import type { UnitClass, UnitInstance, PlayerId } from '../types/game';
import { soundManager } from '../services/soundEffects';
import { UNIT_DEFINITIONS } from '../constants/gameConfig';
import { COMMANDER_P1, COMMANDER_P2 } from '../constants/commanders';
import {
  Shield,
  Crosshair,
  Zap,
  Swords,
  Bomb,
  Flame,
  Volume2,
  VolumeX,
  Radio,
} from 'lucide-react';

interface BattleHUDProps {
  simulation: GameSimulation;
  activeDeployUnit: UnitClass | null;
  selectedUnits: UnitInstance[];
  onSelectDeployUnit: (unitClass: UnitClass | null) => void;
  onMuteToggle: () => void;
  isMuted: boolean;
  onSurrender: () => void;
  playerRole?: PlayerId;
}

export const BattleHUD: React.FC<BattleHUDProps> = ({
  simulation,
  activeDeployUnit,
  selectedUnits,
  onSelectDeployUnit,
  onMuteToggle,
  isMuted,
  onSurrender,
  playerRole = 'p1',
}) => {
  const isP1 = playerRole === 'p1';

  const p1HQ = simulation.structures.find((s) => s.owner === 'p1' && s.type === 'hq');
  const p2HQ = simulation.structures.find((s) => s.owner === 'p2' && s.type === 'hq');

  const p1HpPercent = p1HQ ? Math.max(0, Math.round((p1HQ.hp / p1HQ.maxHp) * 100)) : 0;
  const p2HpPercent = p2HQ ? Math.max(0, Math.round((p2HQ.hp / p2HQ.maxHp) * 100)) : 0;

  // Tekken-style trailing yellow health bar
  const [p1TrailHp, setP1TrailHp] = useState(p1HpPercent);
  const [p2TrailHp, setP2TrailHp] = useState(p2HpPercent);

  useEffect(() => {
    const timer = setTimeout(() => {
      setP1TrailHp((prev) => (p1HpPercent < prev ? prev - 1.5 : p1HpPercent));
      setP2TrailHp((prev) => (p2HpPercent < prev ? prev - 1.5 : p2HpPercent));
    }, 100);
    return () => clearTimeout(timer);
  }, [p1HpPercent, p2HpPercent, p1TrailHp, p2TrailHp]);

  const timeRemaining = Math.max(0, Math.ceil(simulation.phaseTimeRemaining));
  const myReserve = isP1 ? simulation.p1Reserve : simulation.p2Reserve;

  // "ROUND 1 - FIGHT!" Announcement Splash
  const [showFightBanner, setShowFightBanner] = useState<boolean>(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFightBanner(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

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
    <div className="w-full flex flex-col justify-between pointer-events-none select-none h-full relative">
      {/* 1. TEKKEN-STYLE "ROUND 1 - FIGHT!" CINEMATIC SPLASH */}
      {showFightBanner && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50 pointer-events-none animate-out fade-out duration-700 delay-1000 fill-mode-forwards">
          <div className="text-center">
            <span className="text-3xl md:text-5xl font-black font-mono tracking-widest uppercase text-cyan-400 drop-shadow-[0_0_25px_rgba(56,189,248,0.8)] animate-pulse">
              ROUND 1
            </span>
            <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter uppercase text-amber-400 drop-shadow-[0_0_40px_rgba(245,158,11,1)] animate-bounce mt-2">
              FIGHT!
            </h1>
          </div>
        </div>
      )}

      {/* 2. TEKKEN FIGHTING GAME TOP HEALTH BAR & FIGHT CLOCK */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between pt-2 px-2 pointer-events-auto">
        {/* P1 Commander (Victor Vance - Iron Fist) */}
        <div className="flex items-center gap-3 w-[42%]">
          {/* Avatar Box */}
          <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-xl bg-slate-900 border-2 border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.5)] overflow-hidden shrink-0">
            <div dangerouslySetInnerHTML={{ __html: COMMANDER_P1.avatarSvg }} className="w-full h-full p-1" />
            <span className="absolute bottom-0 inset-x-0 bg-cyan-950/90 text-[8px] font-mono text-center font-bold text-cyan-300">
              P1 {isP1 ? '(YOU)' : ''}
            </span>
          </div>

          {/* Name & Lifebar */}
          <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-black text-sm md:text-base font-mono tracking-wider text-cyan-300 uppercase drop-shadow">
                {COMMANDER_P1.name}
              </span>
              <span className="text-xs font-mono font-bold text-slate-300">{p1HpPercent}%</span>
            </div>

            {/* Tekken Lifebar (Gradient + Yellow Chip Damage Trail) */}
            <div className="relative w-full h-4 bg-slate-950 border-2 border-slate-700 rounded-sm overflow-hidden shadow-inner">
              {/* Trailing Yellow Bar */}
              <div
                className="absolute inset-y-0 left-0 bg-amber-400 transition-all duration-300"
                style={{ width: `${p1TrailHp}%` }}
              />
              {/* Active Cyan Life Bar */}
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 transition-all duration-150"
                style={{ width: `${p1HpPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center Metal Battle Clock (100 Seconds) */}
        <div className="relative mx-3 flex flex-col items-center justify-center shrink-0">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-amber-400/80 shadow-[0_0_25px_rgba(245,158,11,0.4)] flex flex-col items-center justify-center">
            <span className="text-[9px] font-black font-mono tracking-widest text-amber-400 uppercase">
              BATTLE
            </span>
            <span
              className={`text-2xl md:text-3xl font-black font-mono leading-none ${
                timeRemaining <= 20 ? 'text-rose-500 animate-pulse' : 'text-slate-100'
              }`}
            >
              {timeRemaining}
            </span>
          </div>
        </div>

        {/* P2 Commander (Raven Kuro - Blood Reaper) */}
        <div className="flex items-center gap-3 w-[42%] flex-row-reverse">
          {/* Avatar Box */}
          <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-xl bg-slate-900 border-2 border-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] overflow-hidden shrink-0">
            <div dangerouslySetInnerHTML={{ __html: COMMANDER_P2.avatarSvg }} className="w-full h-full p-1" />
            <span className="absolute bottom-0 inset-x-0 bg-rose-950/90 text-[8px] font-mono text-center font-bold text-rose-300">
              P2 {!isP1 ? '(YOU)' : ''}
            </span>
          </div>

          {/* Name & Lifebar */}
          <div className="flex-1 flex flex-col text-right">
            <div className="flex justify-between items-baseline mb-1 flex-row-reverse">
              <span className="font-black text-sm md:text-base font-mono tracking-wider text-rose-400 uppercase drop-shadow">
                {COMMANDER_P2.name}
              </span>
              <span className="text-xs font-mono font-bold text-slate-300">{p2HpPercent}%</span>
            </div>

            {/* Tekken Lifebar */}
            <div className="relative w-full h-4 bg-slate-950 border-2 border-slate-700 rounded-sm overflow-hidden shadow-inner">
              <div
                className="absolute inset-y-0 right-0 bg-amber-400 transition-all duration-300"
                style={{ width: `${p2TrailHp}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-gradient-to-l from-red-600 via-rose-500 to-amber-500 transition-all duration-150"
                style={{ width: `${p2HpPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Right Mini Buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-auto z-10">
        <button
          onClick={onMuteToggle}
          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
        </button>
        <button
          onClick={onSurrender}
          className="px-2.5 py-1 text-xs font-mono bg-slate-900/80 hover:bg-rose-950/80 hover:text-rose-300 text-slate-400 rounded-lg border border-slate-700 transition"
        >
          Surrender
        </button>
      </div>

      {/* 3. BOTTOM CARRIER DOCK: CLEAN, INTUITIVE & NON-OVERLAPPING */}
      <div className="w-full max-w-5xl mx-auto pb-3 px-2 pointer-events-auto">
        <div className="bg-slate-950/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Reserve Carrier Header & Units Grid */}
          <div className="flex-1 flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-wider">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>
                  DEPLOYMENT CARRIER ({myReserve.length} UNITS READY)
                </span>
              </div>
              {activeDeployUnit && (
                <span className="text-amber-400 animate-pulse font-bold text-[11px]">
                  Click inside friendly base to deploy {activeDeployUnit.toUpperCase()}!
                </span>
              )}
            </div>

            {/* Unit Cards Row */}
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {myReserve.length === 0 ? (
                <div className="w-full py-2 text-center text-xs text-slate-500 font-mono">
                  All combat units deployed into the 3D battlefield!
                </div>
              ) : (
                myReserve.map((uClass, idx) => {
                  const def = UNIT_DEFINITIONS[uClass];
                  const isActive = activeDeployUnit === uClass;

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        soundManager.playSelect();
                        onSelectDeployUnit(isActive ? null : uClass);
                      }}
                      className={`shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400 shadow-lg shadow-cyan-950/80 scale-105'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-cyan-500/50'
                      }`}
                    >
                      {getUnitIcon(uClass)}
                      <div className="flex flex-col items-start text-left">
                        <span className="text-xs font-bold font-mono leading-none">{def.name.split(' ')[0]}</span>
                        <span className="text-[10px] font-mono text-cyan-400 mt-1">Ready</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Unit Mini Inspector */}
          {selectedUnits.length > 0 && (
            <div className="shrink-0 bg-slate-900 p-2.5 rounded-xl border border-cyan-500/40 flex items-center gap-3">
              {getUnitIcon(selectedUnits[0].classType)}
              <div className="flex flex-col text-xs font-mono">
                <span className="font-bold text-cyan-300">
                  {selectedUnits.length}x {UNIT_DEFINITIONS[selectedUnits[0].classType].name.split(' ')[0]}
                </span>
                <span className="text-[10px] text-slate-400">
                  HP: {Math.round(selectedUnits[0].hp)} / {selectedUnits[0].maxHp}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
