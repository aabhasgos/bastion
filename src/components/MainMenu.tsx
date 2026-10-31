import React, { useState } from 'react';
import type { AIDifficulty } from '../types/game';
import { soundManager } from '../services/soundEffects';
import {
  Bot,
  Laptop,
  HelpCircle,
  Trophy,
  Volume2,
  VolumeX,
  Play,
  Flame,
  X,
  ChevronRight,
  Wifi,
  Swords,
  Zap,
} from 'lucide-react';

interface MainMenuProps {
  onStartAIPractice: (difficulty: AIDifficulty) => void;
  onStartOnlineMultiplayer: () => void;
  onStartLocalVersus: () => void;
  statsRecord: { wins: number; losses: number; streak: number };
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartAIPractice,
  onStartOnlineMultiplayer,
  onStartLocalVersus,
  statsRecord,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>('NORMAL');
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.isMuted);

  const handleMuteToggle = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const winRate =
    statsRecord.wins + statsRecord.losses > 0
      ? Math.round((statsRecord.wins / (statsRecord.wins + statsRecord.losses)) * 100)
      : 0;

  const trophies = (() => {
    try {
      const saved = localStorage.getItem('bastion_player_trophies');
      if (saved) return Math.max(0, parseInt(saved, 10));
    } catch {}
    return Math.max(0, 1000 + statsRecord.wins * 30 - statsRecord.losses * 20);
  })();

  const getLeague = (trophies: number) => {
    if (trophies >= 2000) return { name: 'CHAMPION', color: 'text-purple-400', badge: 'bg-purple-950/80 border-purple-500' };
    if (trophies >= 1500) return { name: 'GOLD LEAGUE', color: 'text-amber-300', badge: 'bg-amber-950/80 border-amber-400' };
    if (trophies >= 1000) return { name: 'SILVER LEAGUE', color: 'text-slate-200', badge: 'bg-slate-800/80 border-slate-400' };
    return { name: 'BRONZE LEAGUE', color: 'text-amber-600', badge: 'bg-amber-950/80 border-amber-800' };
  };
  const league = getLeague(trophies);

  return (
    <div className="relative w-full min-h-screen flex flex-col items-center justify-between p-4 md:p-8 text-slate-100 overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-950/40 via-slate-950 to-slate-950 -z-10" />
      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none -z-10" />

      {/* Top Bar: Profile / Record & Sound Toggle */}
      <div className="w-full max-w-5xl flex items-center justify-between border-b border-slate-800/80 pb-3 gap-2">
        {/* Tactical Profile Stats */}
        <div className="flex items-center gap-3 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-slate-800">
          <div className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono font-black ${league.badge} ${league.color} flex items-center gap-1`}>
            <Trophy className="w-3.5 h-3.5" />
            <span>{league.name}</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400">TROPHIES:</span>{' '}
              <strong className="text-amber-400">{trophies} 🏆</strong>
            </div>
            <span>•</span>
            <div>
              <span className="text-slate-400">RECORD:</span>{' '}
              <strong className="text-cyan-400">{statsRecord.wins}W</strong> -{' '}
              <strong className="text-rose-400">{statsRecord.losses}L</strong>
            </div>
            <span>•</span>
            <div>
              <span className="text-slate-400">WIN:</span>{' '}
              <strong className="text-emerald-400">{winRate}%</strong>
            </div>
            <span>•</span>
            <div>
              <span className="text-slate-400">STREAK:</span>{' '}
              <strong className="text-amber-400">{statsRecord.streak} 🔥</strong>
            </div>
          </div>
        </div>

        {/* Audio Mute & Help */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundManager.playSelect();
              setShowHowToPlay(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 transition border border-slate-800"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>Combat Manual</span>
          </button>
          <button
            onClick={handleMuteToggle}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition border border-slate-800"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </div>

      {/* Hero Section: Game Logo & Core Promise */}
      <div className="flex flex-col items-center text-center max-w-3xl my-auto py-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/60 text-amber-300 text-xs font-mono tracking-widest uppercase mb-3 shadow-lg shadow-amber-950/50">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          Real-Time 1v1 Clan Base Assault • 3D Arena
        </div>

        <h1 className="text-6xl md:text-8xl font-black tracking-tight font-mono uppercase bg-gradient-to-b from-yellow-100 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-2xl">
          BASTION
        </h1>

        <p className="text-base md:text-xl font-mono text-amber-400 tracking-wider mt-2 font-black">
          60s To Recruit • 100s To Conquer • Clash Star System
        </p>

        <p className="text-xs md:text-sm text-slate-300 max-w-lg mt-1 font-mono">
          Decimate enemy headquarters or achieve 50%+ base destruction for 1, 2, or 3 Stars. No Draws — Victory or Defeat!
        </p>

        {/* Primary Action: 2-Player LAN Battle Card */}
        <div className="w-full max-w-lg flex flex-col gap-3.5 mt-6">
          {/* LAN Highlight Card */}
          <div className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-5 rounded-2xl border-2 border-cyan-500/50 shadow-2xl shadow-cyan-950/60 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-cyan-400" />
                <span className="font-bold text-sm font-mono tracking-wide text-cyan-300">
                  PLAY WITH A FRIEND (2 DIFFERENT PCS)
                </span>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                <Wifi className="w-3 h-3 animate-pulse" /> LAN Active
              </span>
            </div>

            <p className="text-xs text-slate-300 text-left font-sans leading-relaxed">
              Play real-time 1v1 with a friend on their laptop or PC over the same Wi-Fi. Player 1 commands Left Blue Base, Player 2 commands Right Red Base.
            </p>

            <button
              onClick={() => {
                soundManager.playSelect();
                onStartOnlineMultiplayer();
              }}
              className="w-full py-3.5 px-4 rounded-xl font-bold font-mono text-sm tracking-wider uppercase bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/70 active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Swords className="w-4 h-4" />
              Launch 2-Player Local LAN Room
            </button>
          </div>

          {/* Secondary Actions: Practice vs AI & Local Sandbox */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Practice vs AI */}
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-200">
                  <Bot className="w-4 h-4 text-amber-400" />
                  <span>SOLO VS AI</span>
                </div>
                <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded border border-slate-800">
                  {(['EASY', 'NORMAL', 'HARD'] as AIDifficulty[]).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => {
                        soundManager.playSelect();
                        setSelectedDifficulty(diff);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition ${
                        selectedDifficulty === diff
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  soundManager.playSelect();
                  onStartAIPractice(selectedDifficulty);
                }}
                className="w-full py-2 px-3 rounded-lg font-bold font-mono text-xs uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Practice Match
              </button>
            </div>

            {/* Local Sandbox */}
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-200">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>LOCAL TEST MATCH</span>
              </div>
              <p className="text-[11px] text-slate-400 text-left font-sans">
                Hotseat sandbox to test unit counters on one device.
              </p>
              <button
                onClick={() => {
                  soundManager.playSelect();
                  onStartLocalVersus();
                }}
                className="w-full py-2 px-3 rounded-lg font-bold font-mono text-xs uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <span>Launch Sandbox</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs font-mono text-slate-500">
        BASTION Engine v1.0 • Top-Down 1v1 Real-Time Tactical Assault
      </div>

      {/* Tactical Manual Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold font-mono uppercase tracking-wider text-slate-100">
                  Field Manual & Rules of Engagement
                </h2>
              </div>
              <button
                onClick={() => setShowHowToPlay(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
              <div>
                <h3 className="text-sm font-bold font-mono text-cyan-400 mb-1">
                  1. Match Flow & Timers
                </h3>
                <p>
                  Every match starts with identical symmetrical bases and 100 Command Points (CP).
                  You have <strong className="text-white">60 seconds</strong> to recruit up to 12 units.
                  Then, a <strong className="text-white">120-second real-time attack phase</strong> begins!
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold font-mono text-cyan-400 mb-1">
                  2. Unit Classes & Roles
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <li className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <strong className="text-amber-400">Scout (5 CP)</strong>: High movement speed, dual ion thruster harasser.
                  </li>
                  <li className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <strong className="text-sky-400">Guardian (10 CP)</strong>: High health tank with 25% ranged shield.
                  </li>
                  <li className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <strong className="text-emerald-400">Ranger (10 CP)</strong>: Long-range sniper with laser sighting. Kites close melee attackers.
                  </li>
                  <li className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <strong className="text-indigo-400">Assault (15 CP)</strong>: Versatile combat trooper with high burst DPS.
                  </li>
                  <li className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <strong className="text-orange-400">Heavy (20 CP)</strong>: Frontline juggernaut with cleave splash damage.
                  </li>
                  <li className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <strong className="text-rose-400">Siege (20 CP)</strong>: Demolitionist dealing 2.5x damage vs towers & HQ.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold font-mono text-cyan-400 mb-1">
                  3. Combat Controls
                </h3>
                <p>
                  • <strong className="text-white">Deploy</strong>: Click unit in bottom reserve bar, then left-click inside your deployment zone (left base for P1, right base for P2).<br />
                  • <strong className="text-white">Select</strong>: Left-click a unit, or click and drag a box to marquee-select multiple units.<br />
                  • <strong className="text-white">Move</strong>: Right-click ground to order tactical march.<br />
                  • <strong className="text-white">Attack</strong>: Right-click an enemy unit or structure to focus-fire!
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold font-mono text-cyan-400 mb-1">
                  4. Victory Conditions
                </h3>
                <p>
                  Destroy the enemy Headquarters to win instantly! If 120 seconds expire, victory goes to:
                  1) Higher HQ health %, 2) Higher total building health %, 3) Total damage dealt.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowHowToPlay(false)}
              className="mt-2 w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold font-mono text-xs uppercase tracking-wider transition"
            >
              Understood, Ready For Combat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
