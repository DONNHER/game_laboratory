import React, { useEffect, useRef, useState } from 'react';
import { ScreenState } from '../types';
import { useGameStore, gameStore } from '../store/gameStore';
import { PREMADE_CHARACTERS, CharacterMeta, getCharacterMeta } from '../game/characters';
import { godotBridge, useGodotBootState } from '../game/godot/godotBridge';
import { ArrowLeft, Check, Zap, Shield, Wind } from 'lucide-react';

interface CharacterSelectProps {
  onNavigate: (screen: ScreenState) => void;
  onBack: () => void;
  backLabel: string;
}

type PreviewPose = 'RUN' | 'JUMP' | 'SLIDE' | 'FLY' | 'IDLE';

export const CharacterSelect: React.FC<CharacterSelectProps> = ({
  onNavigate,
  onBack,
  backLabel,
}) => {
  const store = useGameStore();
  const godotBoot = useGodotBootState();

  const [selectedId, setSelectedId] = useState<string>(store.selectedCharacterId || 'kai');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'BOY' | 'GIRL'>('ALL');
  const [activePose, setActivePose] = useState<PreviewPose>('RUN');
  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  const isDraggingRef = useRef(false);
  const prevPointerRef = useRef({ x: 0, y: 0 });
  const rotAngleRef = useRef({ yaw: 0.35, pitch: 0.14 });

  const activeMeta: CharacterMeta = getCharacterMeta(selectedId);
  const godotShowcaseActive = godotBoot.status === 'ready';

  const filteredCharacters = PREMADE_CHARACTERS.filter((c) => {
    if (genderFilter === 'ALL') return true;
    return c.gender === genderFilter;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopLayout(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      godotBridge.sendCommand({ type: 'stop_showcase' });
    };
  }, []);

  useEffect(() => {
    if (!godotShowcaseActive) return;
    godotBridge.sendCommand({
      type: 'start_showcase',
      characterId: selectedId,
      pose: activePose,
      isDesktop: isDesktopLayout,
      yaw: rotAngleRef.current.yaw,
      pitch: rotAngleRef.current.pitch,
    });
  }, [selectedId, activePose, isDesktopLayout, godotShowcaseActive]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    prevPointerRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevPointerRef.current.x;
    const dy = e.clientY - prevPointerRef.current.y;
    prevPointerRef.current = { x: e.clientX, y: e.clientY };

    rotAngleRef.current.yaw += dx * 0.014;
    rotAngleRef.current.pitch = Math.max(
      -0.18,
      Math.min(0.45, rotAngleRef.current.pitch + dy * 0.01)
    );

    if (godotShowcaseActive) {
      godotBridge.sendCommand({
        type: 'showcase_rotate',
        yaw: rotAngleRef.current.yaw,
        pitch: rotAngleRef.current.pitch,
      });
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    gameStore.selectCharacter(id);
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col px-4 py-4 md:px-8 md:py-6 overflow-y-auto ${
        godotShowcaseActive
          ? 'bg-transparent'
          : 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 cyber-grid'
      }`}
    >
      <div className="w-full max-w-5xl mx-auto flex flex-col flex-1">
        {/* Top Bar */}
        <header className="flex items-center justify-between pb-3.5 px-3 py-2 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-slate-800/80 gap-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              title={`Back to ${backLabel}`}
              className="min-h-[44px] px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center space-x-1.5 text-slate-300 hover:text-white active:scale-95 transition-all"
              aria-label={`Back to ${backLabel}`}
            >
              <ArrowLeft size={18} />
              <span className="text-xs font-semibold hidden sm:inline">Back</span>
            </button>
            <h1 className="font-display font-extrabold text-base md:text-lg text-slate-100 tracking-wider uppercase">
              Runner Locker
            </h1>
          </div>

          {/* Segmented Roster Filter */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
            {(['ALL', 'BOY', 'GIRL'] as const).map((filterKey) => {
              const label = filterKey === 'ALL' ? 'All' : filterKey === 'BOY' ? 'Boys' : 'Girls';
              return (
                <button
                  key={filterKey}
                  onClick={() => setGenderFilter(filterKey)}
                  className={`min-h-[36px] px-3 rounded-lg transition-all ${
                    genderFilter === filterKey
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </header>

        {/* Responsive 2-Column Showcase Layout */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch">
          {/* Left: Interactive Godot 4.7 3D Character Viewport */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="lg:col-span-7 relative min-h-[280px] sm:min-h-[340px] lg:min-h-[440px] rounded-2xl border border-cyan-500/35 bg-transparent overflow-hidden shadow-xl flex flex-col touch-none cursor-grab active:cursor-grabbing"
          >
            {/* Top-Left Minimal Nameplate */}
            <div className="relative z-10 p-4 pointer-events-none flex items-start justify-between">
              <div>
                <div
                  className={`font-display font-extrabold text-2xl md:text-3xl tracking-tight ${activeMeta.textColorClass}`}
                >
                  {activeMeta.name}
                </div>
                <div className="text-xs font-medium text-slate-300">
                  {activeMeta.title}
                </div>
              </div>
              <span className="text-[11px] text-slate-300 bg-slate-950/85 px-2.5 py-1 rounded-lg border border-slate-800">
                Godot 4.7 · Drag to rotate
              </span>
            </div>

            {/* Bottom Unified Pose Control Bar */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="relative z-10 mt-auto p-3 flex items-center justify-center"
            >
              <div className="inline-flex items-center space-x-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800">
                {(['RUN', 'JUMP', 'SLIDE', 'FLY', 'IDLE'] as PreviewPose[]).map((pose) => (
                  <button
                    key={pose}
                    onClick={() => setActivePose(pose)}
                    className={`min-h-[36px] px-3 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all ${
                      activePose === pose
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {pose}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Roster Picker, Ratings & Equip CTA */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            {/* Character Roster Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {filteredCharacters.map((char) => {
                const isSelected = char.id === selectedId;
                const isEquipped = store.selectedCharacterId === char.id;

                return (
                  <button
                    key={char.id}
                    onClick={() => handleSelect(char.id)}
                    className={`min-h-[68px] p-3 rounded-xl border text-left transition-all relative backdrop-blur-md ${
                      isSelected
                        ? 'bg-slate-800/95 border-cyan-400 shadow-md shadow-cyan-500/15'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${char.dotColorClass}`}
                        />
                        <span className="font-display font-bold text-sm text-slate-100">
                          {char.name}
                        </span>
                      </div>

                      {isEquipped && (
                        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-cyan-400">
                          Equipped
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 truncate">
                      {char.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bio & Attributes Card */}
            <div className="p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-800 space-y-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display font-bold text-lg text-slate-100">
                    {activeMeta.name}
                  </h2>
                  <span className="text-xs font-medium text-slate-400">
                    {activeMeta.subtitle}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {activeMeta.description}
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  {activeMeta.tags.join(' · ')}
                </p>
              </div>

              {/* Attribute Bars */}
              <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="flex items-center space-x-1.5">
                      <Wind size={13} className="text-cyan-400" />
                      <span>Top Speed</span>
                    </span>
                    <span className="font-display font-bold text-slate-200 tabular-nums">
                      {activeMeta.speedRating}
                    </span>
                  </div>
                  <progress
                    value={activeMeta.speedRating}
                    max={100}
                    className="w-full h-1.5 rounded-full overflow-hidden bg-slate-800 [&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-cyan-400 [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="flex items-center space-x-1.5">
                      <Zap size={13} className="text-amber-400" />
                      <span>Agility</span>
                    </span>
                    <span className="font-display font-bold text-slate-200 tabular-nums">
                      {activeMeta.agilityRating}
                    </span>
                  </div>
                  <progress
                    value={activeMeta.agilityRating}
                    max={100}
                    className="w-full h-1.5 rounded-full overflow-hidden bg-slate-800 [&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-amber-400 [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-amber-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="flex items-center space-x-1.5">
                      <Shield size={13} className="text-emerald-400" />
                      <span>Stability</span>
                    </span>
                    <span className="font-display font-bold text-slate-200 tabular-nums">
                      {activeMeta.armorRating}
                    </span>
                  </div>
                  <progress
                    value={activeMeta.armorRating}
                    max={100}
                    className="w-full h-1.5 rounded-full overflow-hidden bg-slate-800 [&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-emerald-400 [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-emerald-400"
                  />
                </div>
              </div>
            </div>

            {/* Primary Equip & Play CTA */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  gameStore.selectCharacter(selectedId);
                  onNavigate('MODE_SELECT');
                }}
                className="w-full min-h-[52px] py-3.5 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-slate-950 font-display font-extrabold text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all"
              >
                <Check size={18} />
                <span>Play as {activeMeta.name}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Back Button */}
        <div className="mt-5 pt-3 border-t border-slate-800/80 md:hidden">
          <button
            onClick={onBack}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-slate-900/95 border border-slate-800 text-slate-300 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 active:scale-[0.98]"
          >
            <ArrowLeft size={16} />
            <span>Back to {backLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
