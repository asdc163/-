
import React from 'react';

const SplashView: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 z-[100] overflow-hidden antialiased">
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] bg-gradient-radial from-primary/5 via-transparent to-transparent opacity-60 dark:opacity-30 rounded-full blur-3xl"></div>
      </div>
      <div className="bg-noise"></div>
      
      <div className="relative z-10 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700">
        <div className="relative mb-12 flex items-center justify-center">
          <div className="absolute w-48 h-48 border border-primary/10 dark:border-primary/5 rounded-full animate-pulse"></div>
          <div className="absolute w-36 h-36 border border-primary/20 dark:border-primary/10 rounded-full animate-pulse" style={{ animationDelay: '500ms' }}></div>
          <div className="relative w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/30 dark:to-primary/10 rounded-2xl animate-float flex items-center justify-center backdrop-blur-sm shadow-xl border border-white/20 dark:border-white/5">
            <div className="-rotate-45 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[48px] drop-shadow-sm">flare</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-text-main dark:text-[#fdf9f6] tracking-tight leading-tight">
            微光 Glimmer
          </h1>
          <div className="flex items-center gap-2">
            <div className="h-[1px] w-8 bg-primary/40"></div>
            <p className="font-body text-text-muted dark:text-primary/80 text-sm font-medium tracking-widest uppercase">
              溫暖守護，隨時相伴
            </p>
            <div className="h-[1px] w-8 bg-primary/40"></div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 flex gap-2 items-center justify-center h-4 z-10">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '200ms' }}></div>
        <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: '400ms' }}></div>
      </div>
    </div>
  );
};

export default SplashView;
