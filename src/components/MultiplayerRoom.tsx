import React, { useState, useEffect } from 'react';
import { networkManager } from '../services/networkManager';
import type { LANInfo } from '../services/networkManager';
import { soundManager } from '../services/soundEffects';
import {
  Wifi,
  Laptop,
  Copy,
  Check,
  ArrowRight,
  X,
  Users,
  Radio,
  Share2,
} from 'lucide-react';

interface MultiplayerRoomProps {
  onJoinRoom: (roomCode: string, isHost: boolean) => void;
  onCancel: () => void;
}

export const MultiplayerRoom: React.FC<MultiplayerRoomProps> = ({ onJoinRoom, onCancel }) => {
  const [lanInfo, setLanInfo] = useState<LANInfo>({
    lanIp: window.location.hostname || '10.12.41.113',
    lanUrl: `${window.location.protocol}//${window.location.host}`,
  });
  const [createdRoomCode, setCreatedRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isWaitingForFriend, setIsWaitingForFriend] = useState<boolean>(false);

  useEffect(() => {
    networkManager.fetchLANInfo().then((info) => {
      setLanInfo(info);
    });
  }, []);

  const handleCreateRoom = () => {
    soundManager.playSelect();
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    setCreatedRoomCode(code);
    setIsWaitingForFriend(true);
    networkManager.connect(code, true);
  };

  const handleCopyLink = () => {
    soundManager.playSelect();
    const fullShare = `${lanInfo.lanUrl} (Room: ${createdRoomCode})`;
    navigator.clipboard.writeText(fullShare);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleJoinExisting = () => {
    if (!joinCodeInput.trim()) return;
    soundManager.playSelect();
    const code = joinCodeInput.trim().toUpperCase();
    networkManager.connect(code, false);
    onJoinRoom(code, false);
  };

  // Listen to network manager for opponent arrival
  useEffect(() => {
    const unsubscribe = networkManager.subscribe((msg) => {
      if (msg.type === 'MATCH_START') {
        soundManager.playBattleStart();
        onJoinRoom(networkManager.roomCode, networkManager.role === 'p1');
      }
    });
    return () => unsubscribe();
  }, [onJoinRoom]);

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl flex flex-col gap-6 text-slate-100 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-mono tracking-wider uppercase text-slate-100">
                1v1 Local LAN Battle
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Play on 2 Different PCs over the same Local Network / Wi-Fi
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              networkManager.disconnect();
              onCancel();
            }}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Local Network Info Bar */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs font-mono">
            <Wifi className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div>
              <span className="text-slate-400">YOUR LOCAL LAN ADDRESS:</span>
              <div className="text-sm font-bold text-cyan-400 select-all font-mono">
                {lanInfo.lanUrl}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
            Network Online
          </span>
        </div>

        {/* Main 2-Player Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Host a Game (PC 1) */}
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-cyan-900/40 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-sm font-mono text-cyan-400">HOST ON THIS PC (P1)</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                You command the <strong className="text-cyan-400">Blue HQ (Left Base)</strong>. Generate a code for your friend.
              </p>
            </div>

            {!isWaitingForFriend ? (
              <button
                onClick={handleCreateRoom}
                className="w-full py-3 px-4 rounded-xl font-bold font-mono text-xs uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/60 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Create Room & Invite
              </button>
            ) : (
              <div className="flex flex-col gap-2 bg-slate-900 p-3 rounded-xl border border-cyan-700/60">
                <span className="text-[10px] font-mono text-slate-400">SHARE WITH FRIEND:</span>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black font-mono tracking-widest text-cyan-400">
                    {createdRoomCode}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-amber-300 mt-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Waiting for Player 2 to join...</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Join a Game (PC 2) */}
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-rose-900/40 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-rose-400" />
                <h3 className="font-bold text-sm font-mono text-rose-400">JOIN FRIEND'S PC (P2)</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                You command the <strong className="text-rose-400">Red HQ (Right Base)</strong>. Enter your friend's code.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <input
                type="text"
                maxLength={6}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="ROOM CODE (E.G. 7X9K)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 font-mono text-sm text-rose-400 uppercase tracking-widest focus:outline-none focus:border-rose-500 placeholder:text-slate-600"
              />
              <button
                onClick={handleJoinExisting}
                disabled={!joinCodeInput.trim()}
                className="w-full py-2.5 px-4 rounded-xl font-bold font-mono text-xs uppercase tracking-wider bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 disabled:opacity-50 text-white shadow-lg shadow-rose-950/60 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <span>Connect & Battle</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Help Instructions */}
        <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between">
          <span>💡 Ensure both PCs are on the same Wi-Fi or router connection.</span>
        </div>
      </div>
    </div>
  );
};
