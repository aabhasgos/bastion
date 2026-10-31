import React, { useEffect, useState } from 'react';
import { GameSimulation } from '../engine/gameSimulation';
import type { UnitClass, UnitInstance, PlayerId } from '../types/game';
import { soundManager } from '../services/soundEffects';
import { CLAN_DEFINITIONS, UNIT_DEFINITIONS } from '../constants/gameConfig';
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
  Star,
  Sparkles,
} from 'lucide-react';

interface BattleHUDProps {
  simulation: GameSimulation;
  activeDeployUnit: UnitClass | null;
  activeUltimate: boolean;
  selectedUnits: UnitInstance[];
  onSelectDeployUnit: (unitClass: UnitClass | null) => void;
  onToggleUltimate: () => void;
  onMuteToggle: () => void;
  isMuted: boolean;
  onSurrender: () => void;
  playerRole?: PlayerId;
}

export const BattleHUD: React.FC<BattleHUDProps> = ({
  simulation,
  activeDeployUnit,
  activeUltimate,
  selectedUnits,
  onSelectDeployUnit,
  onToggleUltimate,
  onMuteToggle,
  isMuted,
  onSurrender,
  playerRole = 'p1',
}) => {
  const isP1 = playerRole === 'p1';
  const oppRole: PlayerId = isP1 ? 'p2' : 'p1';
  const clan = isP1 ? CLAN_DEFINITIONS.p1 : CLAN_DEFINITIONS.p2;

  // Real-time Clash of Clans Metrics
  const myDestruction = simulation.getDestructionPercent(playerRole);
  const oppDestruction = simulation.getDestructionPercent(oppRole);
  const myStars = simulation.getPlayerStars(playerRole);
  const oppStars = simulation.getPlayerStars(oppRole);

  const p1HQ = simulation.structures.find((s) => s.owner === 'p1' && s.type === 'hq');
  const p2HQ = simulation.structures.find((s) => s.owner === 'p2' && s.type === 'hq');
  const p1HpPercent = p1HQ ? Math.max(0, Math.round((p1HQ.hp / p1HQ.maxHp) * 100)) : 0;
  const p2HpPercent = p2HQ ? Math.max(0, Math.round((p2HQ.hp / p2HQ.maxHp) * 100)) : 0;

  // Trailing damage health bar animation
  const [p1TrailHp, setP1TrailHp] = useState(p1HpPercent);
  const [p2TrailHp, setP2TrailHp] = useState(p2HpPercent);

  useEffect(() => {
    const timer = setTimeout(() => {
      setP1TrailHp((prev) => (p1HpPercent < prev ? prev - 1.5 : p1HpPercent));
      setP2TrailHp((prev) => (p2HpPercent < prev ? prev - 1.5 : p2HpPercent));
    }, 100);
    return () => clearTimeout(timer);
  }, [p1HpPercent, p2HpPercent, p1TrailHp, p2TrailHp]);

  // Audio Star Earn Trigger
  const [prevStars, setPrevStars] = useState(0);
  useEffect(() => {
    if (myStars > prevStars) {
      soundManager.playStarEarn(myStars);
      setPrevStars(myStars);
    }
  }, [myStars, prevStars]);

  const timeRemaining = Math.max(0, Math.ceil(simulation.phaseTimeRemaining));
  const myReserve = isP1 ? simulation.p1Reserve : simulation.p2Reserve;
  const myUltimateCd = isP1 ? simulation.p1UltimateCooldown : simulation.p2UltimateCooldown;
  const isUltimateReady = myUltimateCd <= 0;

  // Battle Start Splash
  const [showFightBanner, setShowFightBanner] = useState<boolean>(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFightBanner(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Group reserve troops into Clash of Clans deck
  const reserveCounts = myReserve.reduce<Record<UnitClass, number>>((acc, uClass) => {
    acc[uClass] = (acc[uClass] || 0) + 1;
    return acc;
  }, {} as Record<UnitClass, number>);

  const armyClasses = isP1 ? simulation.p1Army : simulation.p2Army;
  const uniqueArmyClasses = Array.from(new Set(armyClasses));

  const getUnitIcon = (type: UnitClass) => {
    switch (type) {
      case 'scout':
        return <Zap className="w-5 h-5 text-amber-300" />;
      case 'guardian':
        return <Shield className="w-5 h-5 text-sky-300" />;
      case 'ranger':
        return <Crosshair className="w-5 h-5 text-emerald-300" />;
      case 'assault':
        return <Swords className="w-5 h-5 text-indigo-300" />;
      case 'heavy':
        return <Flame className="w-5 h-5 text-orange-400" />;
      case 'siege':
        return <Bomb className="w-5 h-5 text-rose-400" />;
    }
  };

  return (
    <div className="w-full flex flex-col justify-between pointer-events-none select-none h-full relative">
      {/* 1. CLASH OF CLANS "BATTLE START" SPLASH */}
      {showFightBanner && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50 pointer-events-none animate-out fade-out duration-700 delay-1000 fill-mode-forwards">
          <div className="text-center bg-slate-950/80 p-8 rounded-3xl border-2 border-amber-400/80 shadow-[0_0_50px_rgba(245,158,11,0.6)]">
            <span className="text-2xl md:text-3xl font-black font-mono tracking-widest uppercase text-amber-400 drop-shadow">
              ⚔️ 1V1 CLAN WAR ASSAULT ⚔️
            </span>
            <h1 className="text-6xl md:text-8xl font-black italic tracking-wider uppercase bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(245,158,11,1)] animate-bounce mt-1">
              DESTROY THE BASE!
            </h1>
            <p className="text-sm font-mono text-slate-300 mt-2 font-bold tracking-widest">
              Earn Stars • Highest Destruction % Wins • No Draws!
            </p>
          </div>
        </div>
      )}

      {/* 2. CLASH OF CLANS TOP WAR HEADER */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between pt-2 px-3 pointer-events-auto">
        {/* Attacker (Player): Clan Badge, Stars, Destruction % */}
        <div className="flex items-center gap-3 w-[40%] bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border-2 border-cyan-500/80 shadow-lg shadow-cyan-950/50">
          <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-xl bg-slate-950 border-2 border-cyan-400 shrink-0 overflow-hidden p-1 shadow-inner">
            <div dangerouslySetInnerHTML={{ __html: isP1 ? COMMANDER_P1.avatarSvg : COMMANDER_P2.avatarSvg }} className="w-full h-full" />
            <span className="absolute bottom-0 inset-x-0 bg-cyan-950 text-[8px] font-mono text-center font-bold text-cyan-300 uppercase">
              YOU
            </span>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-0.5">
              <span className="font-black text-xs md:text-sm font-mono tracking-wider text-cyan-300 uppercase truncate">
                {isP1 ? COMMANDER_P1.name : COMMANDER_P2.name}
              </span>
              {/* 3 Golden Stars */}
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((starIdx) => (
                  <div
                    key={starIdx}
                    className={`transition-all duration-300 ${
                      myStars >= starIdx
                        ? 'text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,1)]'
                        : 'text-slate-700'
                    }`}
                  >
                    <Star
                      className={`w-4 h-4 md:w-5 md:h-5 ${myStars >= starIdx ? 'fill-amber-400' : 'fill-slate-800'}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Clash of Clans Destruction Meter */}
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-300 mb-1">
              <span className="text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                {myDestruction}% DAMAGE
              </span>
              <span className="text-[10px] text-slate-400">HQ: {isP1 ? p1HpPercent : p2HpPercent}%</span>
            </div>

            <div className="relative w-full h-2.5 bg-slate-950 border border-slate-700 rounded-full overflow-hidden shadow-inner">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${myDestruction}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center Clash Battle Timer & Controls */}
        <div className="relative mx-2 flex flex-col items-center justify-center shrink-0">
          <div className="px-4 py-2 rounded-2xl bg-gradient-to-b from-amber-600 via-amber-800 to-slate-950 border-2 border-amber-400/90 shadow-[0_0_25px_rgba(245,158,11,0.5)] flex flex-col items-center justify-center">
            <span className="text-[9px] font-black font-mono tracking-widest text-yellow-200 uppercase">
              BATTLE TIME
            </span>
            <span
              className={`text-2xl md:text-3xl font-black font-mono leading-none ${
                timeRemaining <= 25 ? 'text-rose-400 animate-pulse' : 'text-white'
              }`}
            >
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1">
            <button
              onClick={onMuteToggle}
              className="p-1 rounded-md bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
            <button
              onClick={onSurrender}
              className="px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-950/90 hover:bg-rose-900 text-rose-300 rounded-md border border-rose-700 transition"
            >
              END BATTLE
            </button>
          </div>
        </div>

        {/* Defender (Opponent): Clan Badge, Stars, Destruction % */}
        <div className="flex items-center gap-3 w-[40%] bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border-2 border-rose-500/80 shadow-lg shadow-rose-950/50 flex-row-reverse">
          <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-xl bg-slate-950 border-2 border-rose-500 shrink-0 overflow-hidden p-1 shadow-inner">
            <div dangerouslySetInnerHTML={{ __html: !isP1 ? COMMANDER_P1.avatarSvg : COMMANDER_P2.avatarSvg }} className="w-full h-full" />
            <span className="absolute bottom-0 inset-x-0 bg-rose-950 text-[8px] font-mono text-center font-bold text-rose-300 uppercase">
              ENEMY
            </span>
          </div>

          <div className="flex-1 flex flex-col text-right">
            <div className="flex justify-between items-center mb-0.5 flex-row-reverse">
              <span className="font-black text-xs md:text-sm font-mono tracking-wider text-rose-400 uppercase truncate">
                {!isP1 ? COMMANDER_P1.name : COMMANDER_P2.name}
              </span>
              {/* Opponent Stars */}
              <div className="flex items-center gap-1 flex-row-reverse">
                {[1, 2, 3].map((starIdx) => (
                  <div
                    key={starIdx}
                    className={`transition-all duration-300 ${
                      oppStars >= starIdx
                        ? 'text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,1)]'
                        : 'text-slate-700'
                    }`}
                  >
                    <Star
                      className={`w-4 h-4 md:w-5 md:h-5 ${oppStars >= starIdx ? 'fill-amber-400' : 'fill-slate-800'}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-300 mb-1 flex-row-reverse">
              <span className="text-rose-400 flex items-center gap-1">
                {oppDestruction}% DAMAGE
              </span>
              <span className="text-[10px] text-slate-400">HQ: {!isP1 ? p1HpPercent : p2HpPercent}%</span>
            </div>

            <div className="relative w-full h-2.5 bg-slate-950 border border-slate-700 rounded-full overflow-hidden shadow-inner">
              <div
                className="absolute inset-y-0 right-0 bg-gradient-to-l from-rose-600 to-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${oppDestruction}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. CLASH OF CLANS BOTTOM DECK TRAY (EASY 1-CLICK DEPLOYMENT) */}
      <div className="w-full max-w-5xl mx-auto pb-3 px-3 pointer-events-auto">
        <div className="bg-gradient-to-t from-slate-950 via-slate-900/95 to-slate-900/90 backdrop-blur-2xl border-2 border-amber-500/40 rounded-3xl p-3 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Clan Ultimate Spell Card (Clash of Clans Lightning / Rage Spell Style) */}
          <div className="shrink-0 flex items-center">
            <button
              onClick={() => {
                if (isUltimateReady) {
                  soundManager.playSelect();
                  onToggleUltimate();
                }
              }}
              disabled={!isUltimateReady}
              className={`relative px-4 py-3 rounded-2xl border-2 font-mono font-black text-xs uppercase tracking-wider flex items-center gap-3 transition-all shadow-xl ${
                activeUltimate
                  ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white border-amber-300 shadow-[0_0_25px_rgba(239,68,68,0.9)] scale-105 animate-pulse'
                  : isUltimateReady
                  ? 'bg-gradient-to-b from-amber-500 via-orange-600 to-slate-950 text-white border-amber-300 hover:border-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.6)] active:scale-95 cursor-pointer'
                  : 'bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
              }`}
            >
              <div className="relative w-9 h-9 rounded-xl bg-slate-950 border border-amber-400/80 flex items-center justify-center shrink-0 overflow-hidden">
                <Sparkles className={`w-5 h-5 ${isUltimateReady ? 'text-amber-300 animate-spin' : 'text-slate-600'}`} style={{ animationDuration: '4s' }} />
                {!isUltimateReady && (
                  <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-[10px] font-mono font-black text-amber-400">
                    {Math.ceil(myUltimateCd)}s
                  </div>
                )}
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="text-[12px] font-black text-amber-200 drop-shadow">
                  {clan.ultimateName}
                </span>
                <span className="text-[9px] text-amber-300/90 font-mono font-semibold">
                  {isUltimateReady ? (activeUltimate ? 'CLICK FIELD TO BLAST!' : 'SPELL READY • TAP TO CAST') : `RECHARGING (${Math.ceil(myUltimateCd)}s)`}
                </span>
              </div>
            </button>
          </div>

          {/* Clash Troop Deck: Grouped Cards with Big Quantity Badges */}
          <div className="flex-1 flex flex-col gap-1 w-full">
            <div className="flex items-center justify-between text-xs font-mono px-1">
              <span className="font-bold text-amber-400 tracking-wider flex items-center gap-1.5 uppercase text-[11px]">
                🛡️ BATTLE DECK ({myReserve.length} TROOPS REMAINING)
              </span>
              {activeDeployUnit ? (
                <span className="text-emerald-400 animate-pulse font-black text-[11px]">
                  TAP ANYWHERE IN YOUR BLUE ZONE TO DROP {UNIT_DEFINITIONS[activeDeployUnit].name.toUpperCase()}!
                </span>
              ) : (
                <span className="text-slate-400 text-[10px]">
                  Select a card below, then tap the field to deploy!
                </span>
              )}
            </div>

            {/* Troop Deck Horizontal Row */}
            <div className="flex items-center gap-2.5 overflow-x-auto py-1 px-1">
              {uniqueArmyClasses.map((uClass) => {
                const def = UNIT_DEFINITIONS[uClass];
                const count = reserveCounts[uClass] || 0;
                const isActive = activeDeployUnit === uClass;
                const isDepleted = count === 0;

                return (
                  <button
                    key={uClass}
                    onClick={() => {
                      if (isDepleted) return;
                      soundManager.playSelect();
                      onSelectDeployUnit(isActive ? null : uClass);
                    }}
                    disabled={isDepleted}
                    className={`relative shrink-0 flex flex-col items-center justify-between w-24 h-24 p-2 rounded-2xl border-2 transition-all select-none ${
                      isActive
                        ? 'bg-gradient-to-b from-cyan-600 to-blue-900 border-amber-300 shadow-[0_0_20px_rgba(56,189,248,0.8)] -translate-y-2 scale-105 ring-2 ring-amber-400'
                        : isDepleted
                        ? 'bg-slate-950/60 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed'
                        : 'bg-gradient-to-b from-slate-800 to-slate-950 border-slate-700 hover:border-cyan-400 text-slate-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-950/50 cursor-pointer active:scale-95'
                    }`}
                  >
                    {/* Clash-Style Quantity Badge (Top Right Corner) */}
                    <div
                      className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-black font-mono border-2 shadow-md ${
                        count > 0
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}
                    >
                      x{count}
                    </div>

                    {/* Troop Icon */}
                    <div className="p-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 mt-0.5">
                      {getUnitIcon(uClass)}
                    </div>

                    {/* Troop Name */}
                    <span className="text-[10px] font-black font-mono leading-tight tracking-wide text-center uppercase truncate w-full text-slate-200">
                      {def.name.split(' ')[0]}
                    </span>

                    {/* CP Pill / Deploying Status */}
                    <div className="w-full text-center">
                      {isActive ? (
                        <span className="text-[8px] font-mono font-black text-amber-300 uppercase tracking-wider animate-pulse">
                          DEPLOYING
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/80">
                          {def.cost} CP
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Micro Squad Inspector */}
          {selectedUnits.length > 0 && (
            <div className="shrink-0 bg-slate-950/90 p-2.5 rounded-2xl border border-cyan-400/80 shadow-md flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-cyan-950 border border-cyan-700">
                {getUnitIcon(selectedUnits[0].classType)}
              </div>
              <div className="flex flex-col text-xs font-mono">
                <span className="font-black text-cyan-300">
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
