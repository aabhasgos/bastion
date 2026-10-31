import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameSimulation } from './engine/gameSimulation';
import { AIController } from './engine/aiController';
import { GameCanvas3D } from './components/GameCanvas3D';
import { ArmySelection } from './components/ArmySelection';
import { BattleHUD } from './components/BattleHUD';
import { ResultScreen } from './components/ResultScreen';
import { MainMenu } from './components/MainMenu';
import { MultiplayerRoom } from './components/MultiplayerRoom';
import type { AIDifficulty, GameMode, GamePhase, UnitClass, UnitInstance, PlayerId } from './types/game';
import { soundManager } from './services/soundEffects';
import { networkManager } from './services/networkManager';
import { COMMANDER_P1, COMMANDER_P2 } from './constants/commanders';

export const App: React.FC = () => {
  const [phase, setPhase] = useState<GamePhase>('MENU');
  const [gameMode, setGameMode] = useState<GameMode>('AI_PRACTICE');
  const [playerRole, setPlayerRole] = useState<PlayerId>('p1');
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('NORMAL');
  const [opponentName, setOpponentName] = useState<string>('Tactical AI');
  const [showMultiplayerModal, setShowMultiplayerModal] = useState<boolean>(false);

  const [activeDeployUnit, setActiveDeployUnit] = useState<UnitClass | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<UnitInstance[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.isMuted);

  const [statsRecord, setStatsRecord] = useState<{ wins: number; losses: number; streak: number }>(() => {
    try {
      const saved = localStorage.getItem('bastion_player_stats');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { wins: 0, losses: 0, streak: 0 };
  });

  const simulationRef = useRef<GameSimulation>(new GameSimulation());
  const aiControllerRef = useRef<AIController>(new AIController('NORMAL'));
  const [, setTick] = useState<number>(0);

  const handlePhaseChange = useCallback((newPhase: GamePhase) => {
    setPhase(newPhase);

    if (newPhase === 'GAME_OVER') {
      const stats = simulationRef.current.stats;
      setStatsRecord((prev) => {
        const isWin = stats.winner === playerRole;
        const nextWins = isWin ? prev.wins + 1 : prev.wins;
        const nextLosses = !isWin && stats.winner !== 'draw' ? prev.losses + 1 : prev.losses;
        const nextStreak = isWin ? prev.streak + 1 : 0;
        const updated = { wins: nextWins, losses: nextLosses, streak: nextStreak };
        try {
          localStorage.setItem('bastion_player_stats', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  }, [playerRole]);

  useEffect(() => {
    simulationRef.current = new GameSimulation(handlePhaseChange);
  }, [handlePhaseChange]);

  // Network subscriber for 2-Player LAN match
  useEffect(() => {
    const unsubscribe = networkManager.subscribe((msg) => {
      const sim = simulationRef.current;

      if (msg.type === 'START_BATTLE_PREP') {
        sim.p1Army = [...msg.p1Army];
        sim.p1Reserve = [...msg.p1Army];
        sim.p2Army = [...msg.p2Army];
        sim.p2Reserve = [...msg.p2Army];
        sim.p1Locked = true;
        sim.p2Locked = true;
        sim.startBattlePrep();
      } else if (msg.type === 'UNIT_DEPLOYED') {
        sim.deployUnit(msg.owner, msg.unitClass, msg.x, msg.y);
      } else if (msg.type === 'REMOTE_COMMAND') {
        const { command } = msg;
        if (command.type === 'MOVE') {
          sim.orderUnitsMove(command.unitIds, command.targetX, command.targetY);
        } else if (command.type === 'ATTACK') {
          sim.orderUnitsAttack(command.unitIds, command.targetId, command.targetType);
        }
      } else if (msg.type === 'OPPONENT_REQUESTED_REMATCH') {
        handleStartLANMatch(networkManager.roomCode, networkManager.role === 'p1');
      }
    });

    return () => unsubscribe();
  }, []);

  // 60 FPS Master Simulation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const sim = simulationRef.current;
      const ai = aiControllerRef.current;

      sim.update(dt);

      if (sim.phase === 'ATTACK_PHASE' && gameMode === 'AI_PRACTICE') {
        const deployOrder = ai.updateDeployment(sim.totalMatchElapsed);
        if (deployOrder) {
          sim.deployUnit('p2', deployOrder.unitClass, deployOrder.x, deployOrder.y);
        }

        const p1Units = sim.units.filter((u) => u.owner === 'p1');
        const aiUnits = sim.units.filter((u) => u.owner === 'p2');
        ai.updateUnitMicro(aiUnits, p1Units, sim.structures);
      }

      setTick(currentTime);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameMode]);

  // Solo AI Practice Match
  const handleStartAIPractice = (difficulty: AIDifficulty) => {
    setAIDifficulty(difficulty);
    setGameMode('AI_PRACTICE');
    setPlayerRole('p1');
    setOpponentName(`Tactical AI (${difficulty})`);

    aiControllerRef.current.setDifficulty(difficulty);
    const aiArmy = aiControllerRef.current.selectArmy();

    simulationRef.current.startArmySelection();
    simulationRef.current.p2Army = [...aiArmy];
    simulationRef.current.p2Reserve = [...aiArmy];
    simulationRef.current.p2Locked = true;

    setPhase('ARMY_SELECTION');
    setActiveDeployUnit(null);
    setSelectedUnits([]);
  };

  // 2-Player LAN Match
  const handleStartLANMatch = (_roomCode: string, isHost: boolean) => {
    setShowMultiplayerModal(false);
    setGameMode('ONLINE_MULTIPLAYER');
    const role: PlayerId = isHost ? 'p1' : 'p2';
    setPlayerRole(role);
    setOpponentName(isHost ? 'Friend (Player 2 - Red Base)' : 'Friend (Player 1 - Blue Base)');

    simulationRef.current.resetMatch();
    simulationRef.current.startArmySelection();

    setPhase('ARMY_SELECTION');
    setActiveDeployUnit(null);
    setSelectedUnits([]);
  };

  // Local Sandbox Match
  const handleStartLocalVersus = () => {
    setGameMode('LOCAL_VERSUS');
    setPlayerRole('p1');
    setOpponentName('Local Player 2');

    aiControllerRef.current.setDifficulty('NORMAL');
    const p2Army = aiControllerRef.current.selectArmy();

    simulationRef.current.startArmySelection();
    simulationRef.current.p2Army = [...p2Army];
    simulationRef.current.p2Reserve = [...p2Army];
    simulationRef.current.p2Locked = true;

    setPhase('ARMY_SELECTION');
  };

  // Player Locks Army
  const handleLockPlayerArmy = (army: UnitClass[]) => {
    if (gameMode === 'ONLINE_MULTIPLAYER') {
      networkManager.lockArmy(army);
      if (playerRole === 'p1') {
        simulationRef.current.p1Army = [...army];
        simulationRef.current.p1Reserve = [...army];
        simulationRef.current.p1Locked = true;
      } else {
        simulationRef.current.p2Army = [...army];
        simulationRef.current.p2Reserve = [...army];
        simulationRef.current.p2Locked = true;
      }
    } else {
      simulationRef.current.lockArmy('p1', army);
    }
  };

  // Deploy Unit
  const handleDeployUnit = (unitClass: UnitClass, x: number, y: number) => {
    if (gameMode === 'ONLINE_MULTIPLAYER') {
      networkManager.deployUnit(unitClass, x, y);
    }

    const success = simulationRef.current.deployUnit(playerRole, unitClass, x, y);
    if (success) {
      const reserve = playerRole === 'p1' ? simulationRef.current.p1Reserve : simulationRef.current.p2Reserve;
      if (!reserve.includes(unitClass)) {
        setActiveDeployUnit(null);
      }
    }
  };

  // Unit Selection
  const handleSelectionChange = (selectedIds: string[]) => {
    const selected = simulationRef.current.units.filter((u) => selectedIds.includes(u.id));
    setSelectedUnits(selected);
  };

  // Rematch
  const handleRematch = () => {
    if (gameMode === 'ONLINE_MULTIPLAYER') {
      networkManager.requestRematch();
    }
    handleStartAIPractice(aiDifficulty);
  };

  // Return to Menu
  const handleReturnToMenu = () => {
    if (gameMode === 'ONLINE_MULTIPLAYER') {
      networkManager.disconnect();
    }
    simulationRef.current.resetMatch();
    setPhase('MENU');
    setActiveDeployUnit(null);
    setSelectedUnits([]);
  };

  const handleMuteToggle = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const sim = simulationRef.current;

  return (
    <div className="w-screen h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center relative font-sans overflow-hidden">
      {/* 1. Main Menu */}
      {phase === 'MENU' && (
        <MainMenu
          onStartAIPractice={handleStartAIPractice}
          onStartOnlineMultiplayer={() => setShowMultiplayerModal(true)}
          onStartLocalVersus={handleStartLocalVersus}
          statsRecord={statsRecord}
        />
      )}

      {/* 2. 2-Player LAN Matchmaking Room Modal */}
      {showMultiplayerModal && (
        <MultiplayerRoom
          onJoinRoom={handleStartLANMatch}
          onCancel={() => setShowMultiplayerModal(false)}
        />
      )}

      {/* 3. 60s Army Selection Screen */}
      {phase === 'ARMY_SELECTION' && (
        <div className="w-full h-full flex items-center justify-center p-4 overflow-y-auto">
          <ArmySelection
            timeRemaining={sim.phaseTimeRemaining}
            onLockArmy={handleLockPlayerArmy}
            opponentName={opponentName}
          />
        </div>
      )}

      {/* 4. TEKKEN-STYLE VERSUS BATTLE PREP SCREEN (3s COUNTDOWN) */}
      {phase === 'BATTLE_PREP' && (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 animate-in fade-in">
          {/* Top VS Header */}
          <div className="text-center mb-6">
            <span className="text-amber-400 font-mono tracking-widest text-sm font-bold uppercase animate-pulse">
              GET READY FOR THE NEXT BATTLE
            </span>
            <h2 className="text-4xl md:text-6xl font-black font-mono tracking-wider uppercase text-white mt-1">
              COMMANDER CLASH
            </h2>
          </div>

          {/* Commander Versus Split Card */}
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center justify-center px-4">
            {/* P1 Commander */}
            <div className="bg-slate-900/90 border-2 border-cyan-400 p-6 rounded-3xl shadow-[0_0_35px_rgba(56,189,248,0.5)] flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-slate-950 border-2 border-cyan-400 shrink-0 overflow-hidden p-1">
                <div dangerouslySetInnerHTML={{ __html: COMMANDER_P1.avatarSvg }} className="w-full h-full" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
                  PLAYER 1 (BLUE HQ)
                </span>
                <h3 className="text-2xl font-black font-mono text-slate-100">{COMMANDER_P1.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-1 font-semibold">{COMMANDER_P1.title}</p>
                <p className="text-[11px] text-cyan-300/80 italic mt-1 font-sans">"{COMMANDER_P1.quote}"</p>
              </div>
            </div>

            {/* P2 Commander */}
            <div className="bg-slate-900/90 border-2 border-rose-500 p-6 rounded-3xl shadow-[0_0_35px_rgba(239,68,68,0.5)] flex items-center gap-4 flex-row-reverse text-right">
              <div className="w-24 h-24 rounded-2xl bg-slate-950 border-2 border-rose-500 shrink-0 overflow-hidden p-1">
                <div dangerouslySetInnerHTML={{ __html: COMMANDER_P2.avatarSvg }} className="w-full h-full" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-widest">
                  PLAYER 2 (RED HQ)
                </span>
                <h3 className="text-2xl font-black font-mono text-slate-100">{COMMANDER_P2.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-1 font-semibold">{COMMANDER_P2.title}</p>
                <p className="text-[11px] text-rose-300/80 italic mt-1 font-sans">"{COMMANDER_P2.quote}"</p>
              </div>
            </div>
          </div>

          {/* Central 3-2-1 Countdown */}
          <div className="mt-8 flex flex-col items-center">
            <span className="text-8xl md:text-9xl font-black font-mono text-amber-400 animate-ping drop-shadow-[0_0_30px_rgba(245,158,11,1)]">
              {Math.max(1, Math.ceil(sim.phaseTimeRemaining))}
            </span>
          </div>
        </div>
      )}

      {/* 5. 100s ATTACK PHASE: REAL 3D VIEWPORT WITH OVERLAID TEKKEN HUD */}
      {(phase === 'ATTACK_PHASE' || phase === 'BATTLE_PREP') && (
        <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
          {/* 3D WebGL Three.js Battlefield Canvas (Full Viewport) */}
          <div className="absolute inset-0 z-0">
            <GameCanvas3D
              simulation={sim}
              activeDeployUnit={activeDeployUnit}
              onDeployUnit={handleDeployUnit}
              onSelectionChange={handleSelectionChange}
              playerRole={playerRole}
            />
          </div>

          {/* Non-overlapping Overlaid Fighting HUD */}
          <div className="relative z-10 w-full h-full flex flex-col justify-between pointer-events-none">
            <BattleHUD
              simulation={sim}
              activeDeployUnit={activeDeployUnit}
              selectedUnits={selectedUnits}
              onSelectDeployUnit={setActiveDeployUnit}
              onMuteToggle={handleMuteToggle}
              isMuted={isMuted}
              onSurrender={handleReturnToMenu}
              playerRole={playerRole}
            />
          </div>
        </div>
      )}

      {/* 6. Result & Match Analytics */}
      {phase === 'GAME_OVER' && (
        <div className="w-full h-full flex items-center justify-center p-4 overflow-y-auto">
          <ResultScreen
            stats={sim.stats}
            onRematch={handleRematch}
            onMainMenu={handleReturnToMenu}
          />
        </div>
      )}
    </div>
  );
};

export default App;
