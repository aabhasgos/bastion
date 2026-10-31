import React, { useEffect, useState } from 'react';
import type { MatchStats } from '../types/game';
import confetti from 'canvas-confetti';
import { soundManager } from '../services/soundEffects';
import {
  Trophy,
  RotateCcw,
  Home,
  Star,
  Flame,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface ResultScreenProps {
  stats: MatchStats;
  onRematch: () => void;
  onMainMenu: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ stats, onRematch, onMainMenu }) => {
  const isVictory = stats.winner === 'p1';
  const earnedStars = isVictory ? Math.max(1, stats.p1Stars) : stats.p1Stars;
  const destruction = stats.p1DestructionPercent;
  const trophies = isVictory ? 30 : -20;
  const cpLooted = isVictory ? 500 + destruction * 5 : Math.round(destruction * 3);

  // Staggered star animation
  const [revealedStars, setRevealedStars] = useState<number>(0);

  useEffect(() => {
    if (isVictory) {
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.55 },
      });

      const burstTimer = setTimeout(() => {
        confetti({
          particleCount: 90,
          angle: 60,
          spread: 60,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 90,
          angle: 120,
          spread: 60,
          origin: { x: 1 },
        });
      }, 500);

      return () => clearTimeout(burstTimer);
    }
  }, [isVictory]);

  // Sequenced Star Sound & Animation
  useEffect(() => {
    const t1 = setTimeout(() => {
      if (earnedStars >= 1) {
        setRevealedStars(1);
        soundManager.playStarEarn(1);
      }
    }, 400);

    const t2 = setTimeout(() => {
      if (earnedStars >= 2) {
        setRevealedStars(2);
        soundManager.playStarEarn(2);
      }
    }, 900);

    const t3 = setTimeout(() => {
      if (earnedStars >= 3) {
        setRevealedStars(3);
        soundManager.playStarEarn(3);
      }
    }, 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [earnedStars]);

  return (
    <div className="w-full max-w-3xl mx-auto p-6 md:p-8 bg-slate-950/95 backdrop-blur-2xl border-2 border-amber-500/60 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.9)] text-slate-100 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300 relative select-none">
      
      {/* Decorative Top Glow */}
      <div
        className={`absolute -top-12 inset-x-0 mx-auto w-72 h-20 rounded-full blur-3xl opacity-40 pointer-events-none ${
          isVictory ? 'bg-amber-400' : 'bg-rose-600'
        }`}
      />

      {/* 1. CLASH OF CLANS VICTORY / DEFEAT BANNER */}
      <div className="flex flex-col items-center text-center gap-2">
        <span className="text-xs font-mono font-black tracking-widest uppercase text-amber-400/90">
          ⚔️ CLAN WAR BATTLE REPORT ⚔️
        </span>

        <h1
          className={`text-5xl md:text-7xl font-black italic tracking-wider uppercase font-mono drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] ${
            isVictory
              ? 'bg-gradient-to-b from-yellow-200 via-amber-400 to-orange-500 bg-clip-text text-transparent'
              : 'bg-gradient-to-b from-slate-200 via-slate-400 to-rose-600 bg-clip-text text-transparent'
          }`}
        >
          {isVictory ? 'VICTORY!' : 'DEFEAT'}
        </h1>

        <p className="text-xs md:text-sm font-mono text-slate-400 max-w-md">
          {stats.winReason}
        </p>
      </div>

      {/* 2. THE 3 GIANT CLASH OF CLANS STARS */}
      <div className="flex items-center justify-center gap-4 md:gap-6 my-1">
        {/* Star 1 */}
        <div
          className={`relative flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-3xl border-2 transition-all duration-500 ${
            revealedStars >= 1
              ? 'bg-gradient-to-b from-amber-400 to-yellow-600 border-yellow-200 shadow-[0_0_30px_rgba(245,158,11,0.9)] scale-105'
              : 'bg-slate-900/80 border-slate-800 text-slate-700'
          }`}
        >
          <Star
            className={`w-12 h-12 md:w-14 md:h-14 ${
              revealedStars >= 1
                ? 'fill-yellow-100 text-yellow-200 drop-shadow animate-in zoom-in-75 duration-300'
                : 'fill-slate-950 text-slate-800'
            }`}
          />
          <span className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-slate-950 text-[9px] font-mono font-black text-amber-300 border border-amber-500/60">
            50%
          </span>
        </div>

        {/* Star 2 (Middle - Elevated) */}
        <div
          className={`relative flex items-center justify-center w-24 h-24 md:w-28 md:h-28 -translate-y-3 rounded-3xl border-2 transition-all duration-500 ${
            revealedStars >= 2
              ? 'bg-gradient-to-b from-amber-300 via-yellow-500 to-orange-600 border-yellow-100 shadow-[0_0_40px_rgba(245,158,11,1)] scale-110'
              : 'bg-slate-900/80 border-slate-800 text-slate-700'
          }`}
        >
          <Star
            className={`w-16 h-16 md:w-18 md:h-18 ${
              revealedStars >= 2
                ? 'fill-yellow-100 text-yellow-200 drop-shadow animate-in zoom-in-75 duration-300'
                : 'fill-slate-950 text-slate-800'
            }`}
          />
          <span className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-slate-950 text-[9px] font-mono font-black text-amber-300 border border-amber-500/60 uppercase">
            HQ DOWN
          </span>
        </div>

        {/* Star 3 */}
        <div
          className={`relative flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-3xl border-2 transition-all duration-500 ${
            revealedStars >= 3
              ? 'bg-gradient-to-b from-amber-400 to-yellow-600 border-yellow-200 shadow-[0_0_30px_rgba(245,158,11,0.9)] scale-105'
              : 'bg-slate-900/80 border-slate-800 text-slate-700'
          }`}
        >
          <Star
            className={`w-12 h-12 md:w-14 md:h-14 ${
              revealedStars >= 3
                ? 'fill-yellow-100 text-yellow-200 drop-shadow animate-in zoom-in-75 duration-300'
                : 'fill-slate-950 text-slate-800'
            }`}
          />
          <span className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-slate-950 text-[9px] font-mono font-black text-amber-300 border border-amber-500/60">
            100%
          </span>
        </div>
      </div>

      {/* 3. CLASH OF CLANS DESTRUCTION PERCENTAGE GAUGE */}
      <div className="w-full max-w-lg bg-slate-900/90 border-2 border-slate-800 rounded-2xl p-4 flex flex-col gap-2 shadow-inner">
        <div className="flex items-center justify-between font-mono">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-400" />
            TOTAL BASE DAMAGE:
          </span>
          <span className="text-2xl font-black text-amber-400 font-mono">
            {destruction}%
          </span>
        </div>

        {/* High Contrast Clash Health Bar */}
        <div className="relative w-full h-4 bg-slate-950 rounded-full border border-slate-700 overflow-hidden shadow-inner">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-yellow-300 rounded-full transition-all duration-700"
            style={{ width: `${destruction}%` }}
          />
        </div>
      </div>

      {/* 4. TROPHIES & LOOT BAR (CLASH STYLE) */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-3">
        {/* Trophies Won / Lost */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className={`w-6 h-6 ${isVictory ? 'text-amber-400' : 'text-slate-500'}`} />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">TROPHIES</span>
              <span className="text-xs font-mono text-slate-300">Clan Rank</span>
            </div>
          </div>
          <span
            className={`text-xl font-black font-mono ${
              isVictory ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {trophies > 0 ? `+${trophies}` : trophies} 🏆
          </span>
        </div>

        {/* Command Points Looted */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">RESOURCES</span>
              <span className="text-xs font-mono text-slate-300">CP Looted</span>
            </div>
          </div>
          <span className="text-xl font-black font-mono text-cyan-400">
            +{cpLooted} ⚡
          </span>
        </div>
      </div>

      {/* 5. STAR BREAKDOWN CHECKLIST */}
      <div className="w-full max-w-lg bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col gap-2 font-mono text-xs">
        <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
          <div className="flex items-center gap-2 text-slate-300">
            {destruction >= 50 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-slate-600 shrink-0" />
            )}
            <span>50% Base Infrastructure Demolition</span>
          </div>
          <span className={destruction >= 50 ? 'text-amber-400 font-bold' : 'text-slate-600'}>
            +1 STAR ⭐
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
          <div className="flex items-center gap-2 text-slate-300">
            {stats.p1HQDestroyed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-slate-600 shrink-0" />
            )}
            <span>Enemy Central Citadel Obliterated</span>
          </div>
          <span className={stats.p1HQDestroyed ? 'text-amber-400 font-bold' : 'text-slate-600'}>
            +1 STAR ⭐
          </span>
        </div>

        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 text-slate-300">
            {destruction >= 85 || stats.p1HQDestroyed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-slate-600 shrink-0" />
            )}
            <span>100% Complete Base Annihilation</span>
          </div>
          <span className={destruction >= 85 || stats.p1HQDestroyed ? 'text-amber-400 font-bold' : 'text-slate-600'}>
            +1 STAR ⭐
          </span>
        </div>
      </div>

      {/* 6. CLASH ACTION BUTTONS */}
      <div className="w-full max-w-lg flex items-center gap-4 mt-2">
        <button
          onClick={onMainMenu}
          className="flex-1 py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border-2 border-slate-700 text-slate-200 font-mono font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 shadow-lg"
        >
          <Home className="w-4 h-4 text-slate-400" />
          <span>RETURN HOME</span>
        </button>

        <button
          onClick={onRematch}
          className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 border-2 border-emerald-300 text-slate-950 font-mono font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 shadow-[0_0_25px_rgba(16,185,129,0.5)]"
        >
          <RotateCcw className="w-4 h-4 text-slate-950 stroke-[3]" />
          <span>BATTLE AGAIN</span>
        </button>
      </div>
    </div>
  );
};
