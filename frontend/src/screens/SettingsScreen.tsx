import React, { useState } from 'react';
import { useGameStore, gameStore } from '../store/gameStore';
import { ArrowLeft, Volume2, VolumeX, Music, User, RotateCcw, Home } from 'lucide-react';

interface SettingsScreenProps {
  onBack: () => void;
  onGoHome: () => void;
  backLabel: string;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onGoHome,
  backLabel,
}) => {
  const store = useGameStore();
  const [nameInput, setNameInput] = useState(store.playerName);
  const [savedNameSuccess, setSavedNameSuccess] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const showHomeShortcut = backLabel !== 'Home Page';

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    gameStore.setPlayerName(nameInput);
    setSavedNameSuccess(true);
    setTimeout(() => setSavedNameSuccess(false), 2000);
  };

  const handleReset = () => {
    gameStore.resetProgress();
    setNameInput(gameStore.getState().playerName);
    setConfirmReset(false);
  };

  return (
    <div className="relative w-full h-full flex flex-col px-5 py-5 md:px-8 md:py-7 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-y-auto cyber-grid">
      <div className="w-full max-w-2xl mx-auto flex flex-col flex-1">
        {/* Top Header */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-4 border-b border-slate-800/80">
          <button
            onClick={onBack}
            title={`Back to ${backLabel}`}
            className="justify-self-start min-h-[44px] px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center space-x-1.5 text-slate-300 hover:text-white active:scale-95 transition-all"
            aria-label={`Back to ${backLabel}`}
          >
            <ArrowLeft size={18} />
            <span className="text-xs font-semibold">Back</span>
          </button>

          <h1 className="font-display font-extrabold text-base md:text-lg text-cyan-400 tracking-wider uppercase text-center">
            Settings
          </h1>

          <div className="justify-self-end">
            {showHomeShortcut && (
              <button
                onClick={onGoHome}
                title="Home Page"
                aria-label="Home Page"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-cyan-400 active:scale-95 transition-all"
              >
                <Home size={18} />
              </button>
            )}
          </div>
        </header>

        <div className="mt-5 flex flex-col space-y-4 flex-1">
          {/* Audio Settings */}
          <section className="p-5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-md">
            <h2 className="font-display font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">
              Audio
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="text-cyan-400">
                    {store.soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Sound Effects</div>
                    <div className="text-xs text-slate-400">
                      Jump, slide, core pickups, and impact audio
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => gameStore.toggleSound()}
                  role="switch"
                  aria-checked={store.soundOn}
                  aria-label="Toggle Sound Effects"
                  className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-1 flex-shrink-0 ${
                    store.soundOn ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      store.soundOn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="h-px bg-slate-800/80" />

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="text-indigo-400">
                    <Music size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Background Music</div>
                    <div className="text-xs text-slate-400">
                      Electronic sprint soundtrack during menus and races
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => gameStore.toggleMusic()}
                  role="switch"
                  aria-checked={store.musicOn}
                  aria-label="Toggle Background Music"
                  className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-1 flex-shrink-0 ${
                    store.musicOn ? 'bg-indigo-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      store.musicOn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Player Profile */}
          <section className="p-5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-md">
            <h2 className="font-display font-bold text-xs text-slate-400 uppercase tracking-wider mb-3">
              Player Profile
            </h2>
            <form onSubmit={handleSaveName} className="space-y-2.5">
              <label className="text-xs text-slate-300 flex items-center space-x-1.5">
                <User size={14} className="text-cyan-400" />
                <span>Display Name</span>
              </label>
              <div className="flex space-x-2.5">
                <input
                  type="text"
                  maxLength={16}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter display name"
                  className="flex-1 min-h-[44px] py-2 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-cyan-500 outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[44px] py-2 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-display font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Save
                </button>
              </div>
              {savedNameSuccess && (
                <div className="text-xs text-emerald-400 font-medium">Display name saved.</div>
              )}
            </form>
          </section>

          {/* Reset Progress */}
          <section className="p-5 rounded-2xl bg-slate-900/95 border border-rose-900/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-rose-300">Reset Progress</div>
                <div className="text-xs text-slate-400">
                  Clear unlocked stages, star ratings, cores, and distance records
                </div>
              </div>
              {confirmReset ? (
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    onClick={handleReset}
                    className="min-h-[44px] py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all"
                  >
                    Confirm Reset
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="min-h-[44px] py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="min-h-[44px] py-2 px-4 rounded-xl bg-rose-950/60 border border-rose-500/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold flex items-center justify-center space-x-1.5 flex-shrink-0 transition-all"
                >
                  <RotateCcw size={14} />
                  <span>Reset</span>
                </button>
              )}
            </div>
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
