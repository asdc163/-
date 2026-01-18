
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SOSAlertView: React.FC = () => {
  const navigate = useNavigate();
  const [hours, setHours] = useState(24);
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(12);
  const [isLocating, setIsLocating] = useState(false);
  
  // 滑動撥號狀態
  const [sliderPos, setSliderPos] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  // 模擬計時器跳動
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev >= 59) {
          setMinutes(m => {
            if (m >= 59) {
              setHours(h => h + 1);
              return 0;
            }
            return m + 1;
          });
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLocate = () => {
    setIsLocating(true);
    const toast = document.createElement('div');
    toast.className = "fixed bottom-32 left-1/2 -translate-x-1/2 bg-stone-900/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-[11px] font-bold shadow-2xl z-[200] animate-in fade-in slide-in-from-bottom-4 flex items-center gap-2";
    toast.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">sync</span> 正在重新定位 Sarah 的精確位置...`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      setIsLocating(false);
      toast.remove();
    }, 2000);
  };

  const handleMove = (clientX: number) => {
    if (!sliderRef.current || triggered) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const buttonWidth = 52; 
    const padding = 6;
    const availableWidth = rect.width - buttonWidth - (padding * 2);
    
    let x = clientX - rect.left - (buttonWidth / 2) - padding;
    if (x < 0) x = 0;
    if (x > availableWidth) x = availableWidth;
    
    setSliderPos(x);
    
    if (x >= availableWidth * 0.95) {
      setSliderPos(availableWidth);
      setTriggered(true);
      
      // 自動撥打緊急電話
      setTimeout(() => {
        window.location.href = "tel:110";
      }, 300);

      const toast = document.createElement('div');
      toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-alert-red px-8 py-4 rounded-3xl font-bold shadow-2xl z-[200] flex flex-col items-center gap-3";
      toast.innerHTML = `<span class="material-symbols-outlined text-4xl animate-bounce">call</span><span>正在撥打緊急電話...</span>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
  const onMouseMove = (e: React.MouseEvent) => { if (e.buttons === 1) handleMove(e.clientX); };
  const onEnd = () => { if (!triggered) setSliderPos(0); };

  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=25.033671,121.564427&zoom=17&size=600x400&maptype=roadmap&key=${process.env.API_KEY}`;

  return (
    <div className="bg-[#1c1919] text-white font-body min-h-screen flex flex-col antialiased relative max-w-md mx-auto overflow-hidden select-none">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[60vh] bg-alert-red/10 blur-[100px] rounded-full"></div>
      </div>
      
      <div className="relative z-10 flex flex-col h-full flex-1">
        <div className="flex items-center justify-between p-4 pt-10">
          <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-alert-red/90 shadow-[0_0_20px_rgba(214,40,40,0.5)]">
            <span className="material-symbols-outlined text-white text-[18px]">warning</span>
            <span className="text-white font-bold text-[12px] tracking-widest uppercase">！緊急警報</span>
          </div>
          <div className="size-10"></div>
        </div>

        <div className="flex flex-col items-center mt-2 px-6">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-alert-red/40 animate-ping opacity-30"></div>
            <div className="w-32 h-32 rounded-full border-[3px] border-alert-red p-1 shadow-[0_0_30px_rgba(214,40,40,0.4)]">
              <div className="w-full h-full rounded-full bg-stone-800 overflow-hidden relative">
                <img src="https://picsum.photos/seed/sarah_sad/300/300" alt="Avatar" className="w-full h-full object-cover grayscale-[0.2]" />
              </div>
            </div>
            <div className="absolute bottom-1 right-1 bg-alert-red text-white size-8 rounded-full flex items-center justify-center border-[3px] border-[#1c1919] shadow-lg">
              <span className="material-symbols-outlined text-[20px] font-black">priority_high</span>
            </div>
          </div>
          
          <h1 className="font-display text-4xl font-bold text-white mb-2 tracking-tight">Sarah Jenkins</h1>
          <p className="text-alert-red font-bold text-lg mb-8 text-center leading-relaxed px-4">
            Sarah Jenkins 已逾時 {hours} 小時未回報
          </p>

          <div className="w-full grid grid-cols-3 gap-3 mb-8">
            <div className="flex flex-col items-center py-5 rounded-2xl bg-[#2a2424] border border-white/5 shadow-xl">
              <span className="font-display text-4xl font-bold text-white tabular-nums">{hours.toString().padStart(2, '0')}</span>
              <span className="text-[10px] font-bold text-white/30 mt-2 tracking-widest uppercase">小時</span>
            </div>
            <div className="flex flex-col items-center py-5 rounded-2xl bg-[#2a2424] border border-white/5 shadow-xl">
              <span className="font-display text-4xl font-bold text-alert-red tabular-nums">{minutes.toString().padStart(2, '0')}</span>
              <span className="text-[10px] font-bold text-alert-red/50 mt-2 tracking-widest uppercase">分</span>
            </div>
            <div className="flex flex-col items-center py-5 rounded-2xl bg-[#2a2424] border border-white/5 shadow-xl">
              <span className="font-display text-4xl font-bold text-alert-red tabular-nums animate-pulse">{seconds.toString().padStart(2, '0')}</span>
              <span className="text-[10px] font-bold text-alert-red/50 mt-2 tracking-widest uppercase">秒</span>
            </div>
          </div>
        </div>

        <div className="px-5 mb-8 flex flex-col">
          <div className="relative w-full aspect-[16/10] rounded-[32px] overflow-hidden shadow-2xl border border-white/5 bg-[#2a2424]">
            <div className={`absolute inset-0 grayscale contrast-125 transition-all duration-700 ${isLocating ? 'brightness-125 scale-105' : 'brightness-75 scale-100'}`}>
              <img src={staticMapUrl} alt="Location Map" className="w-full h-full object-cover" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-transparent"></div>
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="relative">
                <div className="absolute w-20 h-20 -left-6 -top-4 bg-alert-red/25 rounded-full animate-ping"></div>
                <div className={`relative z-10 flex items-center justify-center transition-transform duration-500 ${isLocating ? 'scale-150' : 'scale-100'}`}>
                   <span className="material-symbols-outlined text-alert-red text-5xl drop-shadow-[0_0_12px_rgba(214,40,40,0.9)]">location_on</span>
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-0 left-0 w-full p-6 flex items-end justify-between">
              <div className="text-left">
                <p className="text-[10px] text-white/50 font-bold uppercase tracking-[0.25em] mb-1.5">最後已知位置</p>
                <p className="text-white font-display font-bold text-xl leading-tight tracking-wide">台北市信義區信義路五段7號</p>
              </div>
              
              <button 
                onClick={handleLocate}
                className="size-14 bg-stone-800/80 backdrop-blur-md rounded-[20px] flex items-center justify-center border border-white/15 shadow-2xl active:scale-90 transition-all hover:bg-stone-700/90"
              >
                <span className="material-symbols-outlined text-white text-[28px] rotate-[30deg]">near_me</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-12 space-y-4 mt-auto">
          <div 
            ref={sliderRef}
            className="relative w-full h-16 bg-[#2a2424] rounded-full flex items-center p-1.5 shadow-2xl overflow-hidden touch-none"
            onMouseMove={onMouseMove}
            onMouseUp={onEnd}
            onMouseLeave={onEnd}
          >
            <div 
              className="h-13 w-13 bg-alert-red rounded-full flex items-center justify-center shadow-xl relative z-20 transition-transform duration-75 cursor-grab active:cursor-grabbing"
              style={{ transform: `translateX(${sliderPos}px)` }}
              onTouchMove={onTouchMove}
              onTouchEnd={onEnd}
            >
              <span className="text-white font-black text-xs tracking-tighter">SOS</span>
            </div>
            <div className={`flex-1 text-center pr-10 transition-opacity pointer-events-none ${sliderPos > 30 ? 'opacity-0' : 'opacity-100'}`}>
              <span className="text-alert-red font-bold text-sm tracking-widest uppercase">向右滑動發送 SOS</span>
            </div>
            <div 
              className="absolute left-1.5 top-1.5 bottom-1.5 bg-alert-red/10 rounded-full z-10 pointer-events-none"
              style={{ width: `${sliderPos + 55}px` }}
            ></div>
          </div>

          <div className="text-center pt-2">
            <button onClick={() => navigate('/dashboard')} className="text-[10px] font-bold text-white/20 hover:text-white/40 transition-colors uppercase tracking-widest underline underline-offset-4">
              誤報？回報平安
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .h-13 { height: 3.25rem; }
        .w-13 { width: 3.25rem; }
      `}</style>
    </div>
  );
};

export default SOSAlertView;
