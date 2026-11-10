import React from 'react';
import { ScreenState } from '../types';
import { useGameStore, gameStore } from '../store/gameStore';
import {
  ArrowLeft,
  Trophy,
  Swords,
  Users,
  Settings,
  Coins,
  Volume2,
  VolumeX,
  Flame,
  User,
  ChevronRight,
  Star,
} from 'lucide-react';
import { getCharacterMeta } from '../game/characters';
import { NeonAccountButton } from '../components/NeonAccount';

interface MainMenuProps {
  onNavigate: (screen: ScreenState) => void;
  onBack: () => void;
  backLabel: string;
  onStartRivalRace: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onNavigate,
  onBack,
  backLabel,
  onStartRivalRace,
}) => {
  const store = useGameStore();
  const activeCharacter = getCharacterMeta(store.selectedCharacterId || 'kai');
  const totalStars = Object.values(store.bestStars).reduce((a, b) => a + b, 0);

  return (
    <div className="relative w-full h-full flex flex-col px-5 py-5 md:px-8 md:py-7 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-y-auto cyber-grid">
      <div className="w-full max-w-5xl mx-auto flex flex-col flex-1">
        {/* Top Bar */}
        <header className="flex items-center justify-between pb-4 border-b border-slate-800/80">
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
            <h1 className="font-display font-extrabold text-lg md:text-xl text-slate-100 tracking-wide uppercase">
              Main Hub
            </h1>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="flex items-center space-x-1.5 px-3.5 min-h-[44px] rounded-xl bg-slate-900 border border-slate-800 text-amber-400">
              <Coins size={16} />
              <span className="font-display font-bold text-sm tabular-nums">
                {store.coins.toLocaleString()}
              </span>
            </div>

            <button
              onClick={() => gameStore.toggleSound()}
              className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-cyan-400 active:scale-95 transition-all"
              aria-label={store.soundOn ? 'Mute sound' : 'Enable sound'}
            >
              {store.soundOn ? (
                <Volume2 size={18} />
              ) : (
                <VolumeX size={18} className="text-rose-400" />
              )}
            </button>

            <NeonAccountButton />

            <button
              onClick={() => onNavigate('SETTINGS')}
              className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-cyan-400 active:scale-95 transition-all"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Responsive Content Grid */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
          {/* Left Column: Player & Active Runner Card */}
          <section className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-400 font-medium">Player Profile</div>
                  <div className="font-display font-extrabold text-2xl text-slate-100 mt-0.5">
                    {store.playerName}
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('SETTINGS')}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 py-1.5 px-2.5 rounded-lg hover:bg-slate-800/80 transition-colors"
                >
                  Edit Name
                </button>
              </div>

              {/* Active Runner Row */}
              <button
                onClick={() => onNavigate('CHARACTER_SELECT')}
                className="mt-4 w-full p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between text-left transition-all group"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-base text-slate-950 ${activeCharacter.dotColorClass}`}
                  >
                    {activeCharacter.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-display font-bold text-sm text-slate-100 group-hover:text-cyan-300">
                      {activeCharacter.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {activeCharacter.title} · {activeCharacter.subtitle}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-cyan-400 flex items-center space-x-0.5">
                  <span>Swap</span>
                  <ChevronRight size={15} />
                </span>
              </button>
            </div>

            {/* Career Stats */}
            <div className="grid grid-cols-3 gap-2.5 mt-5 pt-4 border-t border-slate-800/80">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
                <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                  <Trophy size={13} className="text-cyan-400" />
                  <span>Stage</span>
                </div>
                <div className="font-display font-bold text-sm text-slate-100 tabular-nums mt-1">
                  {store.unlockedLevel} / 5
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
                <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                  <Star size={13} className="text-amber-400 fill-amber-400" />
                  <span>Stars</span>
                </div>
                <div className="font-display font-bold text-sm text-slate-100 tabular-nums mt-1">
                  {totalStars} / 15
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
                <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                  <Flame size={13} className="text-rose-400" />
                  <span>Record</span>
                </div>
                <div className="font-display font-bold text-sm text-slate-100 tabular-nums mt-1">
                  {store.highDistance.toLocaleString()} m
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Primary Game Modes & Locker */}
          <section className="lg:col-span-7 flex flex-col space-y-3">
            {/* Solo Campaign */}
            <button
              onClick={() => onNavigate('LEVEL_SELECT')}
              className="w-full min-h-[76px] p-4 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-500/35 hover:border-cyan-400 active:scale-[0.99] flex items-center justify-between text-left transition-all group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/30 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Trophy size={24} />
                </div>
                <div>
                  <div className="font-display font-bold text-base md:text-lg text-slate-100 group-hover:text-cyan-300">
                    Solo Campaign
                  </div>
                  <div className="text-xs md:text-sm text-slate-400">
                    Conquer 5 neon districts with rising speed and hazards
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-cyan-400 font-display font-bold text-xs uppercase tracking-wider flex-shrink-0 ml-2">
                <span className="tabular-nums">Stage {store.unlockedLevel}</span>
                <ChevronRight size={18} />
              </div>
            </button>

            {/* Rival Race */}
            <button
              onClick={onStartRivalRace}
              className="w-full min-h-[76px] p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/35 hover:border-emerald-400 active:scale-[0.99] flex items-center justify-between text-left transition-all group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Swords size={24} />
                </div>
                <div>
                  <div className="font-display font-bold text-base md:text-lg text-slate-100 group-hover:text-emerald-300">
                    Rival Race
                  </div>
                  <div className="text-xs md:text-sm text-slate-400">
                    Sprint head-to-head and outlast an agile challenger
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-emerald-400 font-display font-bold text-xs uppercase tracking-wider flex-shrink-0 ml-2">
                <span>Race</span>
                <ChevronRight size={18} />
              </div>
            </button>

            {/* Online Match */}
            <button
              onClick={() => onNavigate('LOBBY')}
              className="w-full min-h-[76px] p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-slate-900 border border-indigo-500/35 hover:border-indigo-400 active:scale-[0.99] flex items-center justify-between text-left transition-all group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Users size={24} />
                </div>
                <div>
                  <div className="font-display font-bold text-base md:text-lg text-slate-100 group-hover:text-indigo-300">
                    Online Match
                  </div>
                  <div className="text-xs md:text-sm text-slate-400">
                    Host a private room or join a friend with a 4-letter code
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-indigo-400 font-display font-bold text-xs uppercase tracking-wider flex-shrink-0 ml-2">
                <span>Lobby</span>
                <ChevronRight size={18} />
              </div>
            </button>

            {/* Runner Locker */}
            <button
              onClick={() => onNavigate('CHARACTER_SELECT')}
              className="w-full min-h-[76px] p-4 rounded-2xl bg-gradient-to-r from-pink-950/50 to-slate-900 border border-pink-500/35 hover:border-pink-400 active:scale-[0.99] flex items-center justify-between text-left transition-all group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-pink-500/15 text-pink-400 flex items-center justify-center border border-pink-500/30 group-hover:scale-105 transition-transform flex-shrink-0">
                  <User size={24} />
                </div>
                <div>
                  <div className="font-display font-bold text-base md:text-lg text-slate-100 group-hover:text-pink-300">
                    Runner Locker
                  </div>
                  <div className="text-xs md:text-sm text-slate-400">
                    Choose between Kai, Blaze, Nova, and Luna
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-pink-400 font-display font-bold text-xs uppercase tracking-wider flex-shrink-0 ml-2">
                <span>Roster</span>
                <ChevronRight size={18} />
              </div>
            </button>
          </section>
        </div>

        {/* Mobile Bottom Back Button */}
        <div className="mt-6 pt-3 border-t border-slate-800/80 md:hidden">
          <button
            onClick={onBack}
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
