
import React from 'react';
import { useNavigate } from 'react-router-dom';

const ContactSetupView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto">
      <header className="flex w-full flex-row items-center justify-between px-6 pt-12 pb-4">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined text-2xl text-text-main dark:text-white">arrow_back</span>
        </button>
        <div className="flex flex-row items-center gap-2">
          <div className="h-1.5 w-6 rounded-full bg-primary shadow-[0_0_10px_rgba(209,175,71,0.4)]"></div>
          <div className="h-1.5 w-1.5 rounded-full bg-black/10 dark:bg-white/20"></div>
          <div className="h-1.5 w-1.5 rounded-full bg-black/10 dark:bg-white/20"></div>
        </div>
        <div className="w-10"></div> 
      </header>

      <main className="flex-1 flex flex-col px-6 pb-8">
        <div className="mt-4 mb-8 text-center animate-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary">
            <span className="material-symbols-outlined text-3xl">shield_person</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-main dark:text-white mb-2">設定緊急聯絡人</h1>
          <p className="text-text-muted dark:text-stone-400 text-base leading-relaxed">
            步驟 1：建立您的信任圈
          </p>
        </div>

        <div className="relative w-full overflow-hidden rounded-2xl shadow-lg group cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99] mb-6">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10"></div>
            <img alt="Connection" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="https://picsum.photos/seed/trust/600/400" />
          </div>
          <div className="relative z-20 p-6 pt-32 flex flex-col items-start gap-4">
            <div className="flex flex-col gap-1 text-left">
              <h2 className="text-white text-2xl font-bold font-display">同步通訊錄</h2>
              <p className="text-white/90 text-sm font-medium leading-relaxed max-w-[280px]">
                微光 Glimmer 需要存取權限以協助您快速選擇信任的守護人。我們絕不會儲存您未選擇的聯絡人。
              </p>
            </div>
            <button className="w-full mt-2 flex items-center justify-center gap-2 h-12 rounded-xl bg-primary hover:bg-primary-dark text-stone-900 text-sm font-bold transition-all shadow-lg shadow-primary/40">
              <span className="material-symbols-outlined text-[20px]">sync</span>
              <span>從通訊錄匯入</span>
            </button>
          </div>
        </div>

        <div className="relative flex items-center py-4">
          <div className="flex-grow border-t border-black/10 dark:border-white/10"></div>
          <span className="flex-shrink-0 mx-4 text-xs font-semibold tracking-widest text-text-muted uppercase">或</span>
          <div className="flex-grow border-t border-black/10 dark:border-white/10"></div>
        </div>

        <div className="w-full flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-text-muted text-sm">edit</span>
            <span className="text-sm font-bold text-text-main dark:text-white">手動輸入資料</span>
          </div>
          <div className="space-y-4">
            <input className="w-full rounded-xl border-stone-200 dark:border-stone-700 bg-surface-light dark:bg-surface-dark px-4 h-14 text-text-main dark:text-white focus:border-primary focus:ring-primary shadow-sm" placeholder="守護人姓名" type="text" />
            <input className="w-full rounded-xl border-stone-200 dark:border-stone-700 bg-surface-light dark:bg-surface-dark px-4 h-14 text-text-main dark:text-white focus:border-primary focus:ring-primary shadow-sm" placeholder="電話號碼" type="tel" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 rounded-lg bg-surface-light dark:bg-surface-dark border dark:border-white/5 flex flex-col gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">lock</span>
            <div>
              <p className="text-xs font-bold">隱私保護</p>
              <p className="text-[10px] text-text-muted leading-tight mt-0.5">您的資料僅儲存於裝置中。</p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-surface-light dark:bg-surface-dark border dark:border-white/5 flex flex-col gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
            <div>
              <p className="text-xs font-bold">全程加密</p>
              <p className="text-[10px] text-text-muted leading-tight mt-0.5">採用端對端加密技術。</p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => navigate('/setup-frequency')}
          className="mt-auto w-full h-14 rounded-xl bg-text-main dark:bg-white text-white dark:text-text-main font-bold text-base tracking-wide flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg"
        >
          下一步
          <span className="material-symbols-outlined text-xl">arrow_forward</span>
        </button>
      </main>
    </div>
  );
};

export default ContactSetupView;
