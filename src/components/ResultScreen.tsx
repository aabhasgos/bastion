import React, { useEffect } from 'react';
import type { MatchStats } from '../types/game';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Skull,
  RotateCcw,
  Home,
  ShieldAlert,
  Flame,
  Swords,
  Timer,
  BarChart3,
  Award,
} from 'lucide-react';

interface ResultScreenProps {
  stats: MatchStats;
  onRematch: () => void;
  onMainMenu: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ stats, onRematch, onMainMenu }) => {
  const isVictory = stats.winner === 'p1';
  const isDraw = stats.winner === 'draw';

  useEffect(() => {
    if (isVictory) {
      // Fire victory fireworks
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
      const timeout = setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 400);

      return () => clearTimeout(timeout);
    }
  }, [isVictory]);

  // Compute tactical performance rating
  const calculateRating = (): { grade: string; color: string; desc: string } => {
    if (isDraw) return { grade: 'B', color: 'text-amber-400', desc: 'Evenly Matched Stand-off' };
    if (!isVictory) return { grade: 'C', color: 'text-rose-400', desc: 'Tactical Defeat' };

    if (stats.matchDuration < 60 && stats.p1StructuresDestroyed >= 2) {
      return { grade: 'S+', color: 'text-amber-300', desc: 'Blitzkrieg Mastermind' };
    }
    if (stats.p1HQHpPercent > 80) {
      return { grade: 'S', color: 'text-cyan-400', desc: 'Impenetrable Fortress' };
    }
    if (stats.p1DamageDealt > 1500) {
      return { grade: 'A', color: 'text-emerald-400', desc: 'Superior Firepower' };
    }
    return { grade: 'B+', color: 'text-blue-400', desc: 'Hard-Fought Triumph' };
  };

  const rating = calculateRating();

  return (
    <div className="w-full max-w-4xl mx-auto p-6 md:p-8 bg-slate-900/95 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-2xl text-slate-100 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Result Banner Header */}
      <div className="flex flex-col items-center text-center gap-3 border-b border-slate-800/80 pb-6">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl ${
            isVictory
              ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-400 shadow-cyan-500/30'
              : isDraw
              ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-400'
              : 'bg-rose-500/20 text-rose-500 border-2 border-rose-500 shadow-rose-500/30'
          }`}
        >
          {isVictory ? (
            <Trophy className="w-10 h-10 animate-bounce" />
          ) : isDraw ? (
            <ShieldAlert className="w-10 h-10" />
          ) : (
            <Skull className="w-10 h-10" />
          )}
        </div>

        <div>
          <h1
            className={`text-4xl md:text-5xl font-black tracking-wider uppercase font-mono ${
              isVictory
                ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent'
                : isDraw
                ? 'bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent'
                : 'bg-gradient-to-r from-rose-500 to-red-600 bg-clip-text text-transparent'
            }`}
          >
            {isVictory ? 'VICTORY ACHIEVED' : isDraw ? 'MATCH DRAW' : 'DEFEAT'}
          </h1>
          <p className="text-sm font-mono text-slate-400 mt-1">{stats.winReason}</p>
        </div>

        {/* Performance Grade Badge */}
        <div className="flex items-center gap-2 bg-slate-950 px-4 py-1.5 rounded-full border border-slate-800">
          <Award className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-slate-400 font-mono">TACTICAL RATING:</span>
          <span className={`text-base font-black font-mono ${rating.color}`}>{rating.grade}</span>
          <span className="text-xs text-slate-400">({rating.desc})</span>
        </div>
      </div>

      {/* Comparative Combat Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Player 1 (Blue) Performance */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-cyan-900/40 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-sm font-bold font-mono text-cyan-400">PLAYER 1 (YOU)</span>
            <span className="text-xs text-slate-400 font-mono">HQ Health: {stats.p1HQHpPercent}%</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-cyan-400" /> Damage Inflicted:
              </span>
              <span className="font-bold text-slate-200">{Math.round(stats.p1DamageDealt)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" /> Structures Destroyed:
              </span>
              <span className="font-bold text-slate-200">{stats.p1StructuresDestroyed}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-400" /> Units Deployed:
              </span>
              <span className="font-bold text-slate-200">{stats.p1UnitsDeployed}</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Skull className="w-3.5 h-3.5 text-rose-400" /> Casualties Sustained:
              </span>
              <span className="font-bold text-slate-200">{stats.p1UnitsLost}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Player 2 (Red) Performance */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-rose-900/40 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-sm font-bold font-mono text-rose-400">OPPONENT</span>
            <span className="text-xs text-slate-400 font-mono">HQ Health: {stats.p2HQHpPercent}%</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-rose-400" /> Damage Inflicted:
              </span>
              <span className="font-bold text-slate-200">{Math.round(stats.p2DamageDealt)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" /> Structures Destroyed:
              </span>
              <span className="font-bold text-slate-200">{stats.p2StructuresDestroyed}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-400" /> Units Deployed:
              </span>
              <span className="font-bold text-slate-200">{stats.p2UnitsDeployed}</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Skull className="w-3.5 h-3.5 text-rose-400" /> Casualties Sustained:
              </span>
              <span className="font-bold text-slate-200">{stats.p2UnitsLost}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Match Duration & Meta Info */}
      <div className="flex items-center justify-center gap-4 text-xs font-mono text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
        <span className="flex items-center gap-1.5">
          <Timer className="w-4 h-4 text-cyan-400" /> Match Combat Duration: <strong className="text-slate-200">{stats.matchDuration}s</strong>
        </span>
        <span>•</span>
        <span className="flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-emerald-400" /> Symmetrical 100 CP Budget Enforced
        </span>
      </div>

      {/* Action Buttons: Rematch & Main Menu */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
        <button
          onClick={onRematch}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold font-mono tracking-wider uppercase text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/60 active:scale-95 transition flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Request Rematch
        </button>
        <button
          onClick={onMainMenu}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold font-mono tracking-wider uppercase text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 transition flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          Return to Main Menu
        </button>
      </div>
    </div>
  );
};
