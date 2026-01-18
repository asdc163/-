
import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacySettingsView: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // 建立一個優雅的登出回饋
    const toast = document.createElement('div');
    toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-stone-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-2xl z-[200] animate-in fade-in zoom-in duration-300 flex items-center gap-3";
    toast.innerHTML = `<span class="material-symbols-outlined text-primary animate-spin">sync</span> 正在登出並重置角色...`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
      navigate('/'); // 返回初始的角色選擇頁面
    }, 1000);
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-background-light dark:bg-background-dark font-body">
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-100 dark:border-stone-800 flex items-center justify-between px-4 h-14 shrink-0">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <h1 className="text-base font-display font-bold">隱私與安全</h1>
        <div className="w-8"></div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-6 space-y-8 text-left pb-32">
        {/* 隱私區域設定 */}
        <section>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">隱私區域</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-100/50 dark:border-green-800 text-[8px] font-bold text-green-600">
              <span className="size-1 rounded-full bg-green-500 animate-pulse"></span>已啟用
            </span>
          </div>
          <div className="bg-white dark:bg-stone-800/60 rounded-2xl overflow-hidden shadow-sm border border-stone-50 dark:border-stone-800">
            <div className="relative h-32 w-full bg-stone-100 dark:bg-stone-900">
              <img className="w-full h-full object-cover opacity-50 grayscale" src="https://picsum.photos/seed/home_map/400/200" alt="Home Map" />
              <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-stone-800/80 to-transparent"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><div className="size-16 rounded-full bg-primary/20 border border-primary/30 animate-pulse"></div></div>
              <div className="absolute bottom-2.5 left-3 px-2 py-0.5 bg-white/90 dark:bg-black/60 backdrop-blur-sm rounded text-[9px] font-bold">住家 • 半徑 200m</div>
            </div>
            <div className="p-4 flex items-center justify-between active:bg-stone-50 dark:active:bg-stone-800 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-stone-50 dark:bg-stone-900 flex items-center justify-center text-primary"><span className="material-symbols-outlined text-[18px]">security</span></div>
                <div className="flex flex-col"><span className="text-xs font-bold">管理區域</span><span className="text-[9px] text-stone-400 font-medium">已設定 2 個安全區</span></div>
              </div>
              <span className="material-symbols-outlined text-stone-300 text-[20px]">chevron_right</span>
            </div>
          </div>
        </section>

        {/* 帳號權限 */}
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3 px-0.5">系統權限</h2>
          <div className="bg-white dark:bg-stone-800/60 rounded-2xl shadow-sm border border-stone-50 dark:border-stone-800 divide-y divide-stone-50 dark:divide-stone-800">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-[#e3ecf8] dark:bg-blue-900/10 flex items-center justify-center text-[#3498db]"><span className="material-symbols-outlined text-[18px]">location_on</span></div>
                <div className="flex flex-col"><span className="text-xs font-bold">精確位置存取</span><span className="text-[9px] text-stone-400 font-medium">永遠允許</span></div>
              </div>
              <div className="w-10 h-5 bg-primary rounded-full relative"><div className="absolute right-0.5 top-0.5 size-4 bg-white rounded-full shadow-sm"></div></div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-[#fde8dc] dark:bg-orange-900/10 flex items-center justify-center text-[#e67e22]"><span className="material-symbols-outlined text-[18px]">notifications_active</span></div>
                <div className="flex flex-col"><span className="text-xs font-bold">緊急推播通知</span><span className="text-[9px] text-stone-400 font-medium">已開啟高優先權</span></div>
              </div>
              <div className="w-10 h-5 bg-primary rounded-full relative"><div className="absolute right-0.5 top-0.5 size-4 bg-white rounded-full shadow-sm"></div></div>
            </div>
          </div>
        </section>

        {/* 登出區塊 */}
        <section className="pt-4">
          <div className="bg-white dark:bg-stone-800/60 rounded-2xl shadow-sm border border-stone-50 dark:border-stone-800 overflow-hidden">
            <button 
              onClick={handleLogout}
              className="w-full p-4 flex items-center justify-between active:bg-red-50 dark:active:bg-red-950/20 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-alert-red group-active:scale-90 transition-transform">
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-alert-red">登出並切換角色</span>
                  <span className="text-[9px] text-stone-400 font-medium">回到初始頁面重新選擇模式</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-stone-300 text-[20px] group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>
          </div>
          <p className="mt-4 px-2 text-center text-[10px] text-stone-400 font-medium leading-relaxed">
            登出後，您的即時監控狀態將會暫停。<br/>
            微光 Glimmer 始終在此守護您的每一段旅程。
          </p>
        </section>
      </main>

      {/* 底部導覽欄 */}
      <nav className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-lg border-t border-stone-100 dark:border-stone-800 px-8 pb-5 pt-2.5 flex justify-between items-center text-[9px] font-bold uppercase tracking-widest shrink-0 relative z-30">
        <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-0.5 text-stone-400 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[22px]">home</span>
          <span>首頁</span>
        </button>
        <button onClick={() => navigate('/guardian-map')} className="flex flex-col items-center gap-0.5 text-stone-400 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[22px]">map</span>
          <span>地圖</span>
        </button>
        <button onClick={() => navigate('/logs')} className="flex flex-col items-center gap-0.5 text-stone-400 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[22px]">local_activity</span>
          <span>活動</span>
        </button>
        <button onClick={() => navigate('/privacy')} className="flex flex-col items-center gap-0.5 text-primary">
          <span className="material-symbols-outlined text-[22px]" style={{fontVariationSettings: "'FILL' 1"}}>settings</span>
          <span>設定</span>
        </button>
      </nav>
    </div>
  );
};

export default PrivacySettingsView;
