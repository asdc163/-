
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SafetyLogView: React.FC = () => {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState('全部');

  const handleLocateClick = () => {
    // 建立視覺回饋
    const toast = document.createElement('div');
    toast.className = "fixed bottom-32 left-1/2 -translate-x-1/2 bg-stone-800/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-[11px] font-bold shadow-2xl z-[200] animate-in fade-in slide-in-from-bottom-4 flex items-center gap-2";
    toast.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">sync</span> 正在載入 Sarah 的精確位置...`;
    document.body.appendChild(toast);
    
    // 延遲導航以顯示回饋
    setTimeout(() => {
      toast.remove();
      navigate('/guardian-map');
    }, 800);
  };

  const filters = ['全部', '緊急警報', '平安回報', '系統通知'];

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-[#fdf9f6] font-body select-none">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#fdf9f6]/80 backdrop-blur-lg border-b border-stone-200/40 flex items-center justify-between px-4 h-16 shrink-0">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[24px] text-stone-800">arrow_back</span>
        </button>
        <h1 className="text-lg font-display font-bold text-stone-800">平安日誌</h1>
        <button 
          onClick={() => setShowFilters(true)}
          className={`w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-all ${showFilters ? 'bg-primary text-stone-900' : 'text-primary'}`}
        >
          <span className="material-symbols-outlined text-[24px]">filter_list</span>
        </button>
      </header>

      <main className="flex-1 w-full pb-24 px-5 overflow-y-auto">
        {/* 本週概況 Banner */}
        <div className="mt-5 mb-8 p-4 rounded-[24px] bg-[#f8f3eb] border border-[#eee4d5] flex items-center gap-4 text-left shadow-sm">
          <div className="w-11 h-11 rounded-full bg-[#eaddc8] flex items-center justify-center text-[#b89a3e] shrink-0">
            <span className="material-symbols-outlined text-[24px]" style={{fontVariationSettings: "'FILL' 1"}}>verified_user</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-0.5">本週概況</p>
            <p className="font-display text-[15px] font-bold leading-tight text-stone-800">
              Sarah 目前很安全。
              <span className="font-medium text-stone-400 text-sm ml-1.5 opacity-80">所有回報皆已確認。</span>
            </p>
          </div>
        </div>

        {/* Timeline Section */}
        <section className="mb-6">
          <h2 className="font-display text-lg font-bold mb-5 text-left text-stone-800">今天</h2>
          
          <div className="relative flex gap-4 text-left">
            {/* Timeline Line */}
            <div className="flex flex-col items-center">
              <div className="z-10 w-3 h-3 rounded-full bg-alert-red ring-4 ring-[#fdf9f6] mt-4 shadow-sm shadow-alert-red/30"></div>
              <div className="flex-1 w-[1.5px] bg-stone-100 mt-2"></div>
            </div>

            {/* Log Card */}
            <div className="flex-1 pb-6 pt-1">
              <div className="bg-white rounded-[24px] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-stone-100 relative overflow-hidden">
                {/* 側邊紅色警示線 (與截圖同步) */}
                <div className="absolute left-0 top-4 bottom-4 w-1 bg-alert-red rounded-r-full"></div>
                
                <div className="flex justify-between items-start mb-4 pl-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-alert-red text-[18px]">report_problem</span>
                    <span className="font-bold text-sm text-alert-red tracking-tight">未回報</span>
                  </div>
                  <span className="text-[11px] font-bold text-stone-300 tracking-wide uppercase">10:45 PM</span>
                </div>

                <div className="flex gap-3 mb-5 pl-2">
                  <div className="w-11 h-11 rounded-full border-2 border-white shadow-md overflow-hidden shrink-0">
                    <img src="https://picsum.photos/seed/sarah/120/120" alt="Sarah" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="text-[15px] font-bold text-stone-800">Sarah 無回應</p>
                    <p className="text-[11px] text-stone-400 font-medium">最後位置：台北市中山路 123 號</p>
                  </div>
                </div>

                {/* Map Preview Card */}
                <div className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden bg-stone-50 border border-stone-100 group">
                  <img src="https://picsum.photos/seed/loc_gray/600/300" alt="Map" className="w-full h-full object-cover grayscale brightness-95 opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button 
                      onClick={handleLocateClick}
                      className="bg-white/95 backdrop-blur-md px-5 py-2 rounded-full text-[12px] font-bold shadow-lg flex items-center gap-2 text-stone-800 active:scale-95 transition-all hover:bg-white"
                    >
                      <span className="material-symbols-outlined text-[18px]">map</span>
                      定位查看
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 模擬其他日誌 */}
          <div className="relative flex gap-4 text-left">
            <div className="flex flex-col items-center">
              <div className="z-10 w-3 h-3 rounded-full bg-secondary-green ring-4 ring-[#fdf9f6] mt-4"></div>
              <div className="flex-1 w-[1.5px] bg-stone-100 mt-2"></div>
            </div>
            <div className="flex-1 pb-6 pt-1">
              <div className="bg-white rounded-[24px] p-4 shadow-sm border border-stone-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-secondary-green/10 flex items-center justify-center text-secondary-green">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-stone-800">已回報平安</span>
                    <span className="text-[10px] text-stone-400 font-medium">信義區 • 08:30 PM</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-stone-200">chevron_right</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 篩選菜單 Overlay */}
      {showFilters && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div onClick={() => setShowFilters(false)} className="absolute inset-0"></div>
          <div className="w-full max-w-md bg-white rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom-full duration-500 overflow-hidden flex flex-col p-6 pb-12 relative z-10">
            <div className="w-12 h-1 bg-stone-100 rounded-full mx-auto mb-6"></div>
            <h3 className="text-lg font-bold text-stone-800 mb-6 text-center">篩選日誌類別</h3>
            <div className="grid grid-cols-2 gap-3">
              {filters.map(f => (
                <button 
                  key={f}
                  onClick={() => { setActiveFilter(f); setShowFilters(false); }}
                  className={`py-4 rounded-2xl font-bold text-sm transition-all border ${
                    activeFilter === f 
                    ? 'bg-primary border-primary text-stone-900 shadow-md shadow-primary/20' 
                    : 'bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowFilters(false)}
              className="mt-8 w-full py-4 rounded-2xl bg-stone-900 text-white font-bold text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 底部導覽欄 */}
      <nav className="bg-white/90 backdrop-blur-lg border-t border-stone-200/40 px-8 pb-7 pt-3 flex justify-between items-center text-[9px] font-bold uppercase tracking-[0.15em] shrink-0 relative z-30">
        <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-0.5 text-stone-400 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[24px]">home</span>
          <span>首頁</span>
        </button>
        <button onClick={() => navigate('/guardian-map')} className="flex flex-col items-center gap-0.5 text-stone-400 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[24px]">map</span>
          <span>地圖</span>
        </button>
        <button onClick={() => navigate('/logs')} className="flex flex-col items-center gap-0.5 text-primary">
          <span className="material-symbols-outlined text-[24px]" style={{fontVariationSettings: "'FILL' 1"}}>local_activity</span>
          <span>活動</span>
        </button>
        <button onClick={() => navigate('/privacy')} className="flex flex-col items-center gap-0.5 text-stone-400 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[24px]">settings</span>
          <span>設定</span>
        </button>
      </nav>
    </div>
  );
};

export default SafetyLogView;
