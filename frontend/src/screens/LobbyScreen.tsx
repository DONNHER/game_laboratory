import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Users,
  PlusCircle,
  LogIn,
  Loader2,
  Copy,
  Check,
  Home,
  Play,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { multiplayerClient, useOnlineRoom } from '../services/multiplayerClient';
import { gameStore, useGameStore } from '../store/gameStore';
import { getCharacterMeta } from '../game/characters';

interface LobbyScreenProps {
  onBack: () => void;
  onGoHome: () => void;
  backLabel: string;
  onStartMatch: (room: {
    code: string;
    seed: number;
    goalDistance?: number;
    opponentName: string;
    opponentCharacterId?: string;
  }) => void;
  onTriggerServerError: (msg: string) => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  onBack,
  onGoHome,
  backLabel,
  onStartMatch,
}) => {
  const store = useGameStore();
  const room = useOnlineRoom();

  const [tab, setTab] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [inputCode, setInputCode] = useState('');
  const [callsign, setCallsign] = useState(store.playerName || 'Striker');
  const [pendingAction, setPendingAction] = useState<'CREATE' | 'JOIN' | 'START' | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    multiplayerClient.connect();
  }, []);

  // Clear pending spinner when room state or error arrives
  useEffect(() => {
    if (room.code || room.error || room.closedNotice) {
      setPendingAction((prev) => (prev === 'START' && !room.error ? prev : null));
    }
  }, [room.code, room.error, room.closedNotice]);

  // Listen for authoritative match launch from Node.js WebSocket server
  useEffect(() => {
    const unsubscribe = multiplayerClient.onEvent((event) => {
      if (event.type === 'match:started') {
        setPendingAction(null);
        const opponent = event.players.find((p) => p.id !== room.clientId);
        onStartMatch({
          code: event.code,
          seed: event.seed,
          goalDistance: event.goalDistance,
          opponentName: opponent?.name || 'Challenger',
          opponentCharacterId: opponent?.characterId,
        });
      }
    });
    return unsubscribe;
  }, [onStartMatch, room.clientId]);

  const commitCallsign = (raw: string) => {
    const trimmed = raw.trim().slice(0, 16) || 'Striker';
    setCallsign(trimmed);
    gameStore.setPlayerName(trimmed);
    multiplayerClient.updateProfile(trimmed, store.selectedCharacterId);
    return trimmed;
  };

  const handleCreateRoom = () => {
    const cleanName = commitCallsign(callsign);
    setPendingAction('CREATE');
    multiplayerClient.createRoom(cleanName, store.selectedCharacterId);
  };

  const handleJoinRoom = () => {
    const cleanCode = inputCode.trim().toUpperCase();
    if (cleanCode.length < 4) return;
    const cleanName = commitCallsign(callsign);
    setPendingAction('JOIN');
    multiplayerClient.joinRoom(cleanCode, cleanName, store.selectedCharacterId);
  };

  const handleLaunchMatch = () => {
    if (!room.code || room.players.length < 2) return;
    setPendingAction('START');
    multiplayerClient.startMatch();
  };

  const handleLeaveActiveRoom = () => {
    setPendingAction(null);
    multiplayerClient.leaveRoom();
  };

  const handleCopyCode = async () => {
    if (!room.code) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleBackClick = () => {
    multiplayerClient.leaveRoom();
    onBack();
  };

  const handleHomeClick = () => {
    multiplayerClient.leaveRoom();
    onGoHome();
  };

  const showHomeShortcut = backLabel !== 'Home Page';
  const inRoom = Boolean(room.code);
  const isHost = room.hostId === room.clientId;
  const hostPlayer = room.players.find((p) => p.isHost) || room.players[0] || null;
  const guestPlayer = room.players.find((p) => !p.isHost) || null;
  const canLaunch = inRoom && isHost && room.players.length >= 2 && pendingAction !== 'START';

  return (
    <div className="relative w-full h-full flex flex-col px-5 py-5 md:px-8 md:py-7 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-y-auto cyber-grid">
      <div className="w-full max-w-lg mx-auto flex flex-col flex-1">
        {/* Top Header */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-4 border-b border-slate-800/80">
          <button
            onClick={handleBackClick}
            title={`Back to ${backLabel}`}
            className="justify-self-start min-h-[44px] px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center space-x-1.5 text-slate-300 hover:text-white active:scale-95 transition-all"
            aria-label={`Back to ${backLabel}`}
          >
            <ArrowLeft size={18} />
            <span className="text-xs font-semibold">Back</span>
          </button>

          <h1 className="font-display font-extrabold text-base md:text-lg text-indigo-400 tracking-wider uppercase text-center">
            Online Match
          </h1>

          <div className="justify-self-end">
            {showHomeShortcut && (
              <button
                onClick={handleHomeClick}
                title="Home Page"
                aria-label="Home Page"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-indigo-400 active:scale-95 transition-all"
              >
                <Home size={18} />
              </button>
            )}
          </div>
        </header>

        {/* Runner Callsign Bar */}
        <div className="mt-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
          <label
            htmlFor="runner-callsign-input"
            className="text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap"
          >
            Runner Name
          </label>
          <input
            id="runner-callsign-input"
            type="text"
            maxLength={16}
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
            onBlur={() => commitCallsign(callsign)}
            placeholder="Striker"
            className="w-40 md:w-48 text-right py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-700 focus:border-indigo-500 text-slate-100 font-display font-bold text-sm outline-none transition-colors"
          />
        </div>

        {/* Host / Join Tabs (hidden while inside an active waiting room) */}
        {!inRoom && (
          <div className="mt-4 grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setTab('CREATE');
                multiplayerClient.clearNotices();
              }}
              className={`min-h-[44px] py-2.5 rounded-lg font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
                tab === 'CREATE'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlusCircle size={15} />
              <span>Host Room</span>
            </button>
            <button
              onClick={() => {
                setTab('JOIN');
                multiplayerClient.clearNotices();
              }}
              className={`min-h-[44px] py-2.5 rounded-lg font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
                tab === 'JOIN'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn size={15} />
              <span>Join Room</span>
            </button>
          </div>
        )}

        {/* Inline Notice / Error Feedback */}
        {(room.error || room.closedNotice) && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-100 text-xs flex items-start space-x-2.5">
            <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{room.error || room.closedNotice}</span>
            <button
              onClick={() => multiplayerClient.clearNotices()}
              className="text-rose-300 hover:text-white font-bold px-1"
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Lobby Card */}
        <div className="my-auto py-5">
          {(pendingAction === 'CREATE' || pendingAction === 'JOIN') && !inRoom && (
            <div className="p-8 rounded-2xl bg-slate-900/95 border border-indigo-500/40 flex flex-col items-center text-center shadow-xl">
              <Loader2 size={36} className="text-indigo-400 animate-spin mb-3" />
              <h2 className="font-display font-bold text-lg text-slate-100">
                {pendingAction === 'CREATE'
                  ? 'Opening private race room...'
                  : `Joining room ${inputCode.trim().toUpperCase()}...`}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Syncing starting line...
              </p>
            </div>
          )}

          {!inRoom && !pendingAction && tab === 'CREATE' && (
            <div className="p-6 md:p-8 rounded-2xl bg-slate-900/95 border border-slate-800 flex flex-col items-center text-center shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30 mb-4">
                <Users size={30} />
              </div>

              <h2 className="font-display font-bold text-2xl text-slate-100">
                Host a Private Race
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                Create a live 2-player room and share your 4-character invite code so a friend can join your starting line.
              </p>

              <button
                onClick={handleCreateRoom}
                className="mt-6 w-full min-h-[52px] py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 active:scale-[0.98] font-display font-extrabold text-base text-slate-950 uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all"
              >
                Create Room
              </button>
            </div>
          )}

          {!inRoom && !pendingAction && tab === 'JOIN' && (
            <div className="p-6 md:p-8 rounded-2xl bg-slate-900/95 border border-slate-800 flex flex-col items-center text-center shadow-xl">
              <h2 className="font-display font-bold text-2xl text-slate-100">
                Enter Invite Code
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-1.5 max-w-xs">
                Enter the 4-character code from the room host to step onto the starting line.
              </p>

              <div className="my-5 w-full max-w-xs">
                <input
                  type="text"
                  maxLength={4}
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase());
                    if (room.error) multiplayerClient.clearNotices();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputCode.trim().length === 4) {
                      handleJoinRoom();
                    }
                  }}
                  placeholder="RZ84"
                  className="w-full text-center py-3.5 px-4 rounded-xl bg-slate-950 border-2 border-slate-700 focus:border-indigo-500 text-slate-100 font-display font-extrabold text-3xl tracking-[0.22em] uppercase outline-none transition-all placeholder:text-slate-700"
                />
              </div>

              <button
                disabled={inputCode.trim().length < 4}
                onClick={handleJoinRoom}
                className={`w-full min-h-[52px] py-3.5 rounded-xl font-display font-extrabold text-base uppercase tracking-wider transition-all ${
                  inputCode.trim().length === 4
                    ? 'bg-indigo-500 hover:bg-indigo-400 active:scale-[0.98] text-slate-950 shadow-lg shadow-indigo-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                Join Race
              </button>
            </div>
          )}

          {inRoom && room.code && (
            <div className="p-6 md:p-7 rounded-2xl bg-slate-900/95 border border-indigo-500/40 flex flex-col items-center text-center shadow-xl">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Room Invite Code
              </div>

              <div className="my-3 flex items-center space-x-2">
                <div className="px-6 py-2.5 rounded-2xl bg-slate-950 border border-indigo-500/60 font-display font-extrabold text-4xl md:text-5xl text-indigo-300 tracking-[0.2em] tabular-nums">
                  {room.code}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="min-w-[48px] min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 active:scale-95 transition-all"
                  aria-label="Copy room code"
                >
                  {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                </button>
              </div>

              {/* Live 2-Player Starting Lineup */}
              <div className="mt-2 w-full space-y-2.5 text-left">
                {/* Host Slot */}
                <div className="p-3.5 rounded-xl bg-slate-950/85 border border-cyan-500/35 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
                      <UserCheck size={18} />
                    </div>
                    <div>
                      <div className="font-display font-bold text-sm text-slate-100 flex items-center space-x-2">
                        <span>{hostPlayer?.name || 'Host'}</span>
                        {hostPlayer?.id === room.clientId && (
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-cyan-400">
                            · You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {getCharacterMeta(hostPlayer?.characterId).name} · Room Host
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-display font-bold uppercase tracking-wider text-emerald-400">
                    Ready
                  </span>
                </div>

                {/* Challenger Slot */}
                {guestPlayer ? (
                  <div className="p-3.5 rounded-xl bg-slate-950/85 border border-emerald-500/45 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                        <UserCheck size={18} />
                      </div>
                      <div>
                        <div className="font-display font-bold text-sm text-slate-100 flex items-center space-x-2">
                          <span>{guestPlayer.name}</span>
                          {guestPlayer.id === room.clientId && (
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400">
                              · You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          {getCharacterMeta(guestPlayer.characterId).name} · Challenger
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-display font-bold uppercase tracking-wider text-emerald-400">
                      Ready
                    </span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-950/50 border border-dashed border-slate-700 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-indigo-400" />
                      </div>
                      <div>
                        <div className="font-display font-bold text-sm text-slate-300">
                          Waiting for Challenger...
                        </div>
                        <div className="text-xs text-slate-500">
                          Share code {room.code} to fill slot 2
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-display font-semibold uppercase tracking-wider text-slate-500">
                      Open
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 w-full flex flex-col space-y-2.5">
                {isHost ? (
                  <button
                    disabled={!canLaunch}
                    onClick={handleLaunchMatch}
                    className={`w-full min-h-[52px] py-3.5 rounded-xl font-display font-extrabold text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
                      canLaunch
                        ? 'bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 shadow-lg shadow-emerald-500/25'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {pendingAction === 'START' ? (
                      <>
                        <Loader2 size={17} className="animate-spin" />
                        <span>Launching Race...</span>
                      </>
                    ) : guestPlayer ? (
                      <>
                        <Play size={17} className="fill-slate-950" />
                        <span>Launch 2,000 m Race</span>
                      </>
                    ) : (
                      <span>Waiting for Challenger...</span>
                    )}
                  </button>
                ) : (
                  <div className="w-full min-h-[52px] py-3 px-4 rounded-xl bg-indigo-500/15 border border-indigo-500/35 text-indigo-200 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2">
                    <Loader2 size={16} className="animate-spin text-indigo-400" />
                    <span>Waiting for {hostPlayer?.name || 'Host'} to start...</span>
                  </div>
                )}

                <button
                  onClick={handleLeaveActiveRoom}
                  className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-all"
                >
                  {isHost ? 'Close Room' : 'Leave Room'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Bottom Back Button */}
        <div className="mt-auto pt-3 border-t border-slate-800/80 md:hidden">
          <button
            onClick={handleBackClick}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 active:scale-[0.98]"
          >
            <ArrowLeft size={16} />
            <span>Back to {backLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
