
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(14 * 60 + 44);
  const [isPaused, setIsPaused] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [sendingNote, setSendingNote] = useState(false);

  // 滑動 SOS 狀態
  const [sliderPos, setSliderPos] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: number;
    if (!isPaused && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPaused, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleIAmSafe = () => {
    setTimeLeft(15 * 60);
    const toast = document.createElement('div');
    toast.className = "fixed bottom-24 left-1/2 -translate-x-1/2 bg-stone-800 text-white px-4 py-2 rounded-full text-[10px] font-bold shadow-xl z-[100] animate-in fade-in slide-in-from-bottom-4";
    toast.innerText = "已向守護者發送平安確認";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  // 優化後的滑動邏輯 (支援觸控與滑鼠)
  const handleMove = (clientX: number) => {
    if (!sliderRef.current || triggered) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const buttonWidth = 40; 
    const padding = 4;
    const availableWidth = rect.width - buttonWidth - (padding * 2);
    
    let x = clientX - rect.left - (buttonWidth / 2) - padding;
    if (x < 0) x = 0;
    if (x > availableWidth) x = availableWidth;
    
    setSliderPos(x);
    
    if (x >= availableWidth * 0.9) {
      setSliderPos(availableWidth);
      setTriggered(true);
      setTimeout(() => navigate('/sos-alert'), 150);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
  const onMouseMove = (e: React.MouseEvent) => { if (e.buttons === 1) handleMove(e.clientX); };
  
  const onEnd = () => {
    if (!triggered) setSliderPos(0);
  };

  const r = 44;
  const sw = 8;
  const c = 2 * Math.PI * r;
  const progress = timeLeft / (15 * 60);
  const offset = c * (1 - progress);

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-[#fdf9f6] dark:bg-background-dark select-none">
      <header className="flex items-center justify-between px-5 pt-6 pb-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative cursor-pointer active:scale-95 transition-transform" onClick={() => navigate('/privacy')}>
            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border-2 border-white shadow-sm" style={{backgroundImage: "url('https://picsum.photos/seed/sarah/100/100')"}}></div>
            <div className="absolute bottom-0 right-0 size-2.5 bg-[#A4D9B6] border-2 border-[#fdf9f6] rounded-full"></div>
          </div>
          <div className="flex flex-col text-left">
            <h2 className="font-display text-sm font-bold leading-tight text-stone-800 dark:text-stone-200">Sarah Jenkins</h2>
            <p className="text-[9px] text-stone-400 font-bold tracking-widest uppercase">監控中 • 步行</p>
          </div>
        </div>
        <button onClick={() => navigate('/logs')} className="flex items-center justify-center size-9 rounded-full bg-white dark:bg-stone-800 shadow-sm border border-stone-100 dark:border-stone-700 text-stone-400 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center py-2 relative">
        <div className="grid place-items-center relative w-full max-w-[240px] aspect-square mx-auto">
          <div className="absolute inset-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 overflow-visible">
              <circle cx="50" cy="50" r={r} stroke="#eeebe8" strokeWidth={sw} fill="transparent" className="dark:stroke-stone-800/40" />
              <circle cx="50" cy="50" r={r} stroke="#d1af47" strokeWidth={sw} fill="transparent" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
            </svg>
          </div>
          <div className="relative z-10 flex flex-col items-center pointer-events-none transform translate-y-1">
            <div className="font-display text-5xl font-medium leading-none text-stone-900 dark:text-white tabular-nums tracking-tighter">
              {formatTime(timeLeft)}
            </div>
            <div className="text-stone-400 text-[10px] font-bold tracking-[0.25em] mt-5 uppercase">剩餘分鐘</div>
          </div>
        </div>
          
        <div className="mt-8 w-full px-12">
          <button onClick={handleIAmSafe} className="w-full flex items-center justify-center gap-2 bg-[#A4D9B6] hover:bg-[#95c5a5] active:scale-[0.98] transition-all h-12 rounded-2xl shadow-[0_8px_16px_-4px_rgba(164,217,182,0.3)]">
            <div className="size-5 rounded-full border-2 border-stone-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-stone-800 font-black text-[12px]">check</span>
            </div>
            <span className="text-stone-800 text-base font-bold tracking-tight">我現在很平安</span>
          </button>
          <p className="text-center text-stone-400 text-[9px] mt-3 font-bold uppercase tracking-[0.2em]">下次檢查時間：18:00</p>
        </div>
      </main>

      {/* 功能卡片區 */}
      <div className="px-6 py-2 mt-auto">
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => setTimeLeft(prev => prev + 10 * 60)} className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-white dark:bg-stone-800 shadow-sm border border-stone-50 dark:border-stone-700 active:scale-95 transition-all">
            <div className="size-8 rounded-full bg-[#fdf2d8] dark:bg-primary/10 flex items-center justify-center text-primary"><span className="material-symbols-outlined text-[18px]">more_time</span></div>
            <span className="text-[9px] font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">延長 10 分</span>
          </button>
          <button onClick={() => setShowNoteModal(true)} className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-white dark:bg-stone-800 shadow-sm border border-stone-50 dark:border-stone-700 active:scale-95 transition-all">
            <div className="size-8 rounded-full bg-[#fde8dc] dark:bg-orange-900/10 flex items-center justify-center text-[#e67e22]"><span className="material-symbols-outlined text-[18px]">edit_note</span></div>
            <span className="text-[9px] font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">備註</span>
          </button>
          <button onClick={() => setIsPaused(!isPaused)} className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-white dark:bg-stone-800 shadow-sm border border-stone-50 dark:border-stone-700 active:scale-95 transition-all">
            <div className={`size-8 rounded-full flex items-center justify-center ${isPaused ? 'bg-primary text-white' : 'bg-[#e3ecf8] dark:bg-blue-900/10 text-[#3498db]'}`}><span className="material-symbols-outlined text-[18px]">{isPaused ? 'play_arrow' : 'pause'}</span></div>
            <span className="text-[9px] font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">{isPaused ? '繼續' : '暫停'}</span>
          </button>
        </div>
      </div>

      {/* 滑動發送 SOS - 修復版 */}
      <div className="px-6 pb-4 pt-1">
        <div 
          ref={sliderRef}
          className="relative w-full h-12 bg-[#f9e6e6] dark:bg-red-950/20 rounded-full flex items-center p-1 overflow-hidden touch-none"
          onMouseMove={onMouseMove}
          onMouseUp={onEnd}
          onMouseLeave={onEnd}
        >
          <div 
            className="h-10 w-10 bg-alert-red rounded-full flex items-center justify-center shadow-lg relative z-20 transition-transform duration-75 active:scale-95 cursor-grab active:cursor-grabbing"
            style={{ transform: `translateX(${sliderPos}px)` }}
            onTouchMove={onTouchMove}
            onTouchEnd={onEnd}
          >
            <span className="text-white font-black text-[10px] tracking-tighter">SOS</span>
          </div>
          <div className={`flex-1 text-center pr-10 transition-opacity pointer-events-none ${sliderPos > 20 ? 'opacity-0' : 'opacity-100'}`}>
            <span className="text-alert-red font-bold text-[11px] tracking-widest uppercase">向右滑動發送 SOS</span>
          </div>
          {/* 背景填充 */}
          <div 
            className="absolute left-1 top-1 bottom-1 bg-alert-red/10 rounded-full z-10 pointer-events-none"
            style={{ width: `${sliderPos + 40}px` }}
          ></div>
        </div>
      </div>

      <nav className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-lg border-t border-stone-100 dark:border-stone-800 px-8 pb-5 pt-2.5 flex justify-between items-center text-[9px] font-bold uppercase tracking-widest shrink-0">
        <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-0.5 text-primary">
          <span className="material-symbols-outlined text-[22px]" style={{fontVariationSettings: "'FILL' 1"}}>home</span>
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
        <button onClick={() => navigate('/privacy')} className="flex flex-col items-center gap-0.5 text-stone-400 active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[22px]">settings</span>
          <span>設定</span>
        </button>
      </nav>

      {showNoteModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-t-[28px] p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-stone-800 dark:text-white">新增安全備註</h3>
              <button onClick={() => setShowNoteModal(false)} className="size-7 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400"><span className="material-symbols-outlined text-[18px]">close</span></button>
            </div>
            <textarea autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="例如：我正在搭乘計程車..." className="w-full h-24 p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800 border-none focus:ring-1 focus:ring-primary outline-none text-xs mb-4 resize-none"></textarea>
            <button onClick={() => { setSendingNote(true); setTimeout(() => { setSendingNote(false); setShowNoteModal(false); setNoteText(''); }, 1000); }} disabled={sendingNote || !noteText.trim()} className="w-full h-11 rounded-xl bg-primary text-stone-900 font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">{sendingNote ? '傳送中...' : '送出'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;
