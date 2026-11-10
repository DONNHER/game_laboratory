import React, { useState } from 'react';
import { ScreenState, GameMode, LevelConfig } from './types';
import { LEVELS, createOnlineMatchLevel } from './game/levels';
import { createRandomSeed } from './game/mulberry32';
import { PhoneFrame } from './components/PhoneFrame';
import { TitleScreen } from './screens/TitleScreen';
import { MainMenu } from './screens/MainMenu';
import { ModeSelect } from './screens/ModeSelect';
import { LevelSelect } from './screens/LevelSelect';
import { GodotGameCanvas } from './game/godot/GodotGameCanvas';
import {
  PersistentGodotViewport,
  EngineBootScreen,
} from './game/godot/PersistentGodotViewport';
import { godotBridge, useGodotBootState } from './game/godot/godotBridge';
import { ResultScreen } from './screens/ResultScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CharacterSelect } from './screens/CharacterSelect';
import { PauseModal } from './components/PauseModal';
import { multiplayerClient } from './services/multiplayerClient';

const TRANSIENT_SCREENS: ReadonlySet<ScreenState> = new Set(['PLAYING', 'RESULT']);

const SCREEN_LABELS: Record<ScreenState, string> = {
  TITLE: 'Home Page',
  MAIN_MENU: 'Main Hub',
  MODE_SELECT: 'Select Mode',
  LEVEL_SELECT: 'Solo Campaign',
  CHARACTER_SELECT: 'Runner Locker',
  LOBBY: 'Online Match',
  SETTINGS: 'Settings',
  PLAYING: 'Race',
  RESULT: 'Results',
};

interface NavState {
  current: ScreenState;
  history: ScreenState[];
}

export default function App() {
  const [nav, setNav] = useState<NavState>({ current: 'TITLE', history: [] });
  const [currentMode, setCurrentMode] = useState<GameMode>('SOLO');
  const [selectedLevel, setSelectedLevel] = useState<LevelConfig>(LEVELS[0]);
  const [roomSeed, setRoomSeed] = useState<number | undefined>(undefined);
  const [opponentName, setOpponentName] = useState<string>('Apex Rival');
  const [opponentCharacterId, setOpponentCharacterId] = useState<string | undefined>(undefined);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [runId, setRunId] = useState<number>(0);
  const [runSeed, setRunSeed] = useState<number>(() => createRandomSeed());

  const currentScreen = nav.current;
  const previousScreen: ScreenState =
    nav.history.length > 0 ? nav.history[nav.history.length - 1] : 'TITLE';
  const backLabel = SCREEN_LABELS[previousScreen] || 'Home Page';

  const startPlaying = () => {
    setRunId((prev) => prev + 1);
    setRunSeed(createRandomSeed());
    setIsPaused(false);
    setNav((prev) => ({
      current: 'PLAYING',
      history: TRANSIENT_SCREENS.has(prev.current)
        ? prev.history
        : [...prev.history, prev.current],
    }));
  };

  const navigateTo = (nextScreen: ScreenState) => {
    if (nextScreen === 'PLAYING') {
      startPlaying();
      return;
    }

    setIsPaused(false);
    setNav((prev) => {
      if (nextScreen === prev.current) {
        return prev;
      }

      if (nextScreen === 'TITLE') {
        return { current: 'TITLE', history: [] };
      }

      const baseHistory = TRANSIENT_SCREENS.has(prev.current)
        ? prev.history
        : [...prev.history, prev.current];

      if (!TRANSIENT_SCREENS.has(nextScreen)) {
        const existingIdx = baseHistory.indexOf(nextScreen);
        if (existingIdx !== -1) {
          return {
            current: nextScreen,
            history: baseHistory.slice(0, existingIdx),
          };
        }
      }

      return {
        current: nextScreen,
        history: baseHistory,
      };
    });
  };

  const handleBack = () => {
    setIsPaused(false);
    const targetPrev =
      nav.history.length > 0 ? nav.history[nav.history.length - 1] : 'TITLE';
    if (currentMode === 'ONLINE_MATCH') {
      if (nav.current === 'PLAYING' && targetPrev === 'LOBBY') {
        // Leaving a live race back to Lobby exits the active match cleanly
        multiplayerClient.leaveRoom();
      } else if (targetPrev !== 'LOBBY') {
        multiplayerClient.leaveRoom();
      } else if (nav.current === 'RESULT' && targetPrev === 'LOBBY') {
        multiplayerClient.resetRoomForRematch();
      }
    }
    setNav((prev) => {
      if (prev.history.length === 0) {
        return { current: 'TITLE', history: [] };
      }
      const previous = prev.history[prev.history.length - 1];
      return {
        current: previous,
        history: prev.history.slice(0, -1),
      };
    });
  };

  const handleGoHome = () => {
    setIsPaused(false);
    if (currentMode === 'ONLINE_MATCH') {
      multiplayerClient.leaveRoom();
    }
    setNav({ current: 'TITLE', history: [] });
  };

  const [lastResult, setLastResult] = useState<{
    won: boolean;
    distance: number;
    goalDistance: number;
    stars: number;
    coins: number;
    crashReason?: string;
    opponentDistance?: number;
    opponentWon?: boolean;
  }>({
    won: false,
    distance: 0,
    goalDistance: LEVELS[0].goalDistance,
    stars: 0,
    coins: 0,
  });

  const handleGameOver = (result: {
    won: boolean;
    distance: number;
    goalDistance: number;
    stars: number;
    coins: number;
    crashReason?: string;
    opponentDistance?: number;
    opponentWon?: boolean;
  }) => {
    setLastResult(result);
    navigateTo('RESULT');
  };

  const handleNextLevel = () => {
    const nextIdx = LEVELS.findIndex((l) => l.id === selectedLevel.id) + 1;
    if (nextIdx < LEVELS.length) {
      setSelectedLevel(LEVELS[nextIdx]);
      startPlaying();
    } else {
      navigateTo('LEVEL_SELECT');
    }
  };

  const handleRetry = () => {
    if (currentMode === 'ONLINE_MATCH') {
      multiplayerClient.resetRoomForRematch();
      navigateTo('LOBBY');
      return;
    }
    startPlaying();
  };

  const handleStartRivalRace = () => {
    setCurrentMode('AI_RIVAL');
    setRoomSeed(undefined);
    setOpponentName('Apex Rival');
    setOpponentCharacterId(undefined);
    setSelectedLevel(LEVELS[1]);
    startPlaying();
  };

  const handleStartOnlineMatch = (room: {
    code: string;
    seed: number;
    goalDistance?: number;
    opponentName: string;
    opponentCharacterId?: string;
  }) => {
    setRoomSeed(room.seed);
    setOpponentName(room.opponentName);
    setOpponentCharacterId(room.opponentCharacterId);
    setSelectedLevel(createOnlineMatchLevel(room.code, room.goalDistance ?? 1500));
    setCurrentMode('ONLINE_MATCH');
    startPlaying();
  };

  const godotBoot = useGodotBootState();

  // Preload the entire Godot 4.7 3D engine & scenes on the initial loading page BEFORE Home Page opens
  const isInitialLoadingPage = godotBoot.status !== 'ready';

  const showPersistentGodot =
    isInitialLoadingPage ||
    currentScreen === 'PLAYING' ||
    currentScreen === 'CHARACTER_SELECT';

  return (
    <PhoneFrame>
      {/* Persistent Godot 4.7 (MIT) WebAssembly 3D Viewport — loaded once before Home Page opens */}
      <PersistentGodotViewport visible={showPersistentGodot} />

      {isInitialLoadingPage ? (
        <EngineBootScreen
          progressPct={godotBoot.progressPct}
          stageLabel={godotBoot.stageLabel}
          errorMessage={godotBoot.errorMessage}
          onRetry={() => godotBridge.retryBoot()}
        />
      ) : (
        <div className="relative z-10 w-full h-full flex flex-col overflow-hidden">
          {currentScreen === 'TITLE' && (
            <TitleScreen onNavigate={navigateTo} />
          )}

          {currentScreen === 'MAIN_MENU' && (
            <MainMenu
              onNavigate={navigateTo}
              onBack={handleBack}
              backLabel={backLabel}
              onStartRivalRace={handleStartRivalRace}
            />
          )}

          {currentScreen === 'MODE_SELECT' && (
            <ModeSelect
              onNavigate={navigateTo}
              onBack={handleBack}
              onGoHome={handleGoHome}
              backLabel={backLabel}
              onSelectMode={(mode) => {
                setCurrentMode(mode);
                if (mode !== 'ONLINE_MATCH') {
                  setRoomSeed(undefined);
                }
                if (mode === 'AI_RIVAL') {
                  setOpponentName('Apex Rival');
                  setSelectedLevel(LEVELS[1]);
                }
              }}
              serverError={serverError}
              onClearServerError={() => setServerError(null)}
            />
          )}

          {currentScreen === 'LEVEL_SELECT' && (
            <LevelSelect
              onNavigate={navigateTo}
              onBack={handleBack}
              backLabel={backLabel}
              onSelectLevel={(level) => {
                setCurrentMode('SOLO');
                setRoomSeed(undefined);
                setSelectedLevel(level);
              }}
            />
          )}

          {currentScreen === 'CHARACTER_SELECT' && (
            <CharacterSelect
              onNavigate={navigateTo}
              onBack={handleBack}
              backLabel={backLabel}
            />
          )}

          {currentScreen === 'PLAYING' && (
            <div className="relative w-full h-full">
              <GodotGameCanvas
                runId={runId}
                level={selectedLevel}
                mode={currentMode}
                roomSeed={currentMode === 'ONLINE_MATCH' ? roomSeed : runSeed}
                opponentName={opponentName}
                opponentCharacterId={opponentCharacterId}
                onGameOver={handleGameOver}
                onPauseToggle={() => setIsPaused((prev) => !prev)}
                isPaused={isPaused}
              />

              {isPaused && (
                <PauseModal
                  onResume={() => setIsPaused(false)}
                  onRestart={handleRetry}
                  onBack={handleBack}
                  onGoHome={handleGoHome}
                  backLabel={backLabel}
                  isOnlineMatch={currentMode === 'ONLINE_MATCH'}
                />
              )}
            </div>
          )}

          {currentScreen === 'RESULT' && (
            <ResultScreen
              won={lastResult.won}
              distance={lastResult.distance}
              goalDistance={lastResult.goalDistance}
              stars={lastResult.stars}
              coins={lastResult.coins}
              crashReason={lastResult.crashReason}
              level={selectedLevel}
              mode={currentMode}
              opponentName={opponentName}
              opponentDistance={lastResult.opponentDistance}
              opponentWon={lastResult.opponentWon}
              onBack={handleBack}
              onGoHome={handleGoHome}
              backLabel={backLabel}
              onRetry={handleRetry}
              onNextLevel={handleNextLevel}
            />
          )}

          {currentScreen === 'LOBBY' && (
            <LobbyScreen
              onBack={handleBack}
              onGoHome={handleGoHome}
              backLabel={backLabel}
              onStartMatch={handleStartOnlineMatch}
              onTriggerServerError={(msg) => setServerError(msg)}
            />
          )}

          {currentScreen === 'SETTINGS' && (
            <SettingsScreen
              onBack={handleBack}
              onGoHome={handleGoHome}
              backLabel={backLabel}
            />
          )}
        </div>
      )}
    </PhoneFrame>
  );
}
