
import React from 'react';
import { useNavigate } from 'react-router-dom';

const RegisterView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto">
      <header className="flex items-center px-6 pt-6 pb-2 justify-between z-10">
        <button onClick={() => navigate(-1)} className="text-text-main dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1 flex justify-center">
          <div className="flex flex-row items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary/30"></div>
            <div className="h-1.5 w-8 rounded-full bg-primary shadow-[0_0_10px_rgba(209,175,71,0.5)]"></div>
            <div className="h-1.5 w-1.5 rounded-full bg-primary/30"></div>
          </div>
        </div>
        <div className="size-10"></div> 
      </header>

      <main className="flex-1 flex flex-col px-6 pt-4 pb-8">
        <div className="mb-8 relative">
          <div className="absolute -left-2 -top-2 size-8 bg-primary/10 rounded-full blur-xl"></div>
          <h1 className="text-text-main dark:text-white font-display text-[32px] font-bold leading-[1.3] tracking-tight mb-2">
            讓我們守護您的 <span className="text-primary italic relative inline-block">安全
              <svg className="absolute w-full h-2 bottom-1 left-0 text-primary/20" preserveAspectRatio="none" viewBox="0 0 100 10">
                <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="2"></path>
              </svg>
            </span>。
          </h1>
          <p className="text-text-muted dark:text-stone-400 text-base font-medium">建立帳號，即刻開啟微光守護。</p>
        </div>

        <form className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); navigate('/setup-contacts'); }}>
          <div className="space-y-2 group">
            <label className="text-text-main dark:text-white text-sm font-semibold tracking-wide ml-1" htmlFor="fullname">姓名</label>
            <input className="w-full rounded-xl bg-surface-light dark:bg-surface-dark border-stone-200 dark:border-stone-700 text-text-main dark:text-white h-14 px-4 text-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" id="fullname" placeholder="王小明" type="text" required />
          </div>
          
          <div className="space-y-2 group">
            <label className="text-text-main dark:text-white text-sm font-semibold tracking-wide ml-1" htmlFor="phone">手機號碼</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-text-muted text-[20px]">smartphone</span>
              <input className="w-full rounded-xl bg-surface-light dark:bg-surface-dark border-stone-200 dark:border-stone-700 text-text-main dark:text-white h-14 pl-12 pr-4 text-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" id="phone" placeholder="0912-345-678" type="tel" required />
            </div>
          </div>

          <div className="space-y-2 group">
            <label className="text-text-main dark:text-white text-sm font-semibold tracking-wide ml-1" htmlFor="email">電子郵件</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-text-muted text-[20px]">mail</span>
              <input className="w-full rounded-xl bg-surface-light dark:bg-surface-dark border-stone-200 dark:border-stone-700 text-text-main dark:text-white h-14 pl-12 pr-4 text-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" id="email" placeholder="name@example.com" type="email" required />
            </div>
          </div>

          <div className="space-y-2 group">
            <label className="text-text-main dark:text-white text-sm font-semibold tracking-wide ml-1" htmlFor="password">密碼</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-text-muted text-[20px]">lock</span>
              <input className="w-full rounded-xl bg-surface-light dark:bg-surface-dark border-stone-200 dark:border-stone-700 text-text-main dark:text-white h-14 pl-12 pr-4 text-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" id="password" placeholder="••••••••" type="password" required />
            </div>
            <p className="text-xs text-text-muted ml-1">請使用至少 8 個字元的強密碼。</p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
              <span className="material-symbols-outlined text-[14px]">verified_user</span>
              <span>您的資料採用 256 位元加密傳輸</span>
            </div>
            <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-stone-900 font-bold h-14 rounded-xl text-lg shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group">
              建立帳號
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
            <p className="text-center text-sm text-text-muted">
              已有帳號？ <a className="text-text-main dark:text-white font-semibold hover:underline" href="#">登入</a>
            </p>
          </div>
        </form>
      </main>
    </div>
  );
};

export default RegisterView;
