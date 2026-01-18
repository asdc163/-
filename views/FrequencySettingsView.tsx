
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FrequencySettingsView: React.FC = () => {
  const [frequency, setFrequency] = useState(12);
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-md mx-auto">
      <header className="flex items-center justify-between px-6 pt-12 pb-4">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-light dark:bg-surface-dark shadow-sm text-stone-600 dark:text-stone-300">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <span className="text-sm font-bold tracking-widest uppercase text-stone-400 font-sans">步驟 2 / 3</span>
        <div className="w-10"></div> 
      </header>

      <main className="flex-1 flex flex-col px-6 pb-28">
        <div className="mt-4 mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight text-stone-900 dark:text-stone-50">
            回報頻率設定
          </h1>
        </div>

        <div className="w-full bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg p-8 mb-6 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-500"></div>
          <div className="flex flex-col items-center justify-center relative z-10">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-xl font-medium text-stone-400">每</span>
              <span className="text-6xl font-bold text-primary tabular-nums tracking-tighter">{frequency}</span>
              <span className="text-xl font-medium text-stone-400">小時</span>
            </div>
            <p className="text-center text-sm text-stone-500 dark:text-stone-400 mb-8 max-w-[240px]">
              我們會發送推播通知以確認您的安全。
            </p>
            <div className="w-full relative py-4">
              <input 
                className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-primary" 
                max="24" min="2" step="2" type="range" 
                value={frequency} 
                onChange={(e) => setFrequency(parseInt(e.target.value))}
              />
              <div className="flex justify-between w-full mt-4 text-xs font-bold text-stone-400 uppercase tracking-wider">
                <span>2小時</span>
                <span>12小時</span>
                <span>24小時</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg p-5 mb-4 border dark:border-stone-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1 text-left">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
                <h3 className="text-lg font-bold">自動發送 SOS</h3>
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                若逾時未回報，我們將等待 <strong className="text-stone-700 dark:text-stone-300">15 分鐘</strong> 後通知聯絡人。
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
              <input checked className="sr-only peer" type="checkbox" readOnly />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg p-5 border dark:border-stone-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 font-sans">緊急聯絡人</h3>
            <button className="text-primary text-sm font-bold hover:text-primary/80">編輯</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-3 overflow-hidden">
              <img className="inline-block h-10 w-10 rounded-full ring-2 ring-white dark:ring-surface-dark object-cover" src="https://picsum.photos/seed/person1/100/100" alt="Person 1" />
              <img className="inline-block h-10 w-10 rounded-full ring-2 ring-white dark:ring-surface-dark object-cover" src="https://picsum.photos/seed/person2/100/100" alt="Person 2" />
            </div>
            <div className="h-8 w-[1px] bg-stone-200 dark:bg-stone-700 mx-1"></div>
            <div className="flex flex-col text-left">
              <span className="text-xs text-stone-400">通知對象</span>
              <span className="text-sm font-bold text-stone-800 dark:text-stone-200">媽媽與伴侶</span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark pointer-events-none h-32 flex items-end justify-center z-50">
        <button 
          onClick={() => navigate('/dashboard')}
          className="pointer-events-auto w-full max-w-md bg-primary hover:bg-primary-dark active:scale-[0.98] text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 group"
        >
          <span>儲存並開始監控</span>
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

export default FrequencySettingsView;
