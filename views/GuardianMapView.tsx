
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'mom';
  status: 'sent' | 'read';
  time: string;
}

const GuardianMapView: React.FC = () => {
  const navigate = useNavigate();
  const [showRoute, setShowRoute] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: '你好，我剛剛到家了，一切平安。', sender: 'mom', status: 'read', time: '下午 2:30' },
    { id: 2, text: '好的，辛苦了！晚點見。', sender: 'user', status: 'read', time: '下午 2:31' }
  ]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleLocate = () => {
    setIsLocating(true);
    const toast = document.createElement('div');
    toast.className = "fixed top-24 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md text-stone-800 px-4 py-2 rounded-full text-[10px] font-bold shadow-xl z-[100] animate-in fade-in slide-in-from-top-4";
    toast.innerText = "正在定位至 媽媽 的即時位置...";
    document.body.appendChild(toast);
    
    setTimeout(() => {
      setIsLocating(false);
      toast.remove();
    }, 1500);
  };

  const handleAction = (action: string) => {
    const toast = document.createElement('div');
    toast.className = "fixed bottom-40 left-1/2 -translate-x-1/2 bg-stone-800/95 backdrop-blur-md text-white px-4 py-2 rounded-full text-[10px] font-bold shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom-4";
    toast.innerText = action;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  const sendMessage = () => {
    if (!chatMessage.trim()) return;
    const newMessage: Message = {
      id: Date.now(),
      text: chatMessage,
      sender: 'user',
      status: 'sent',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([...messages, newMessage]);
    setChatMessage('');
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'read' } : m));
    }, 2000);
  };

  const mapUrl = `https://www.google.com/maps/embed/v1/view?key=${process.env.API_KEY}&center=25.033671,121.564427&zoom=17&maptype=roadmap`;

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden max-w-md mx-auto bg-[#efebe4] select-none">
      <header className="absolute top-0 left-0 right-0 z-30 px-5 pt-12 pb-4 pointer-events-none">
        <div className="flex flex-col gap-2.5 pointer-events-auto">
          <button 
            onClick={() => handleAction('切換為詳細地圖模式')} 
            className="bg-white/95 px-4 py-1.5 rounded-lg shadow-sm border border-stone-100 text-[10px] font-bold text-primary active:scale-95 transition-all text-left w-fit"
          >
            顯示詳細地圖
          </button>
          <div className="flex items-center gap-2.5 bg-white/95 p-1.5 pr-4 rounded-full border border-stone-50 shadow-sm w-fit">
            <div className="h-8 w-8 rounded-full bg-cover bg-center border-2 border-primary shadow-sm" style={{backgroundImage: "url('https://picsum.photos/seed/mom/100/100')"}}></div>
            <div className="flex flex-col text-left">
              <span className="font-display font-bold text-[12px] leading-tight text-stone-800">媽媽</span>
              <span className="text-[9px] text-primary font-bold flex items-center gap-1">
                <span className="size-1 bg-primary rounded-full animate-pulse"></span> 即時連線
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative flex-1 w-full z-0 overflow-hidden">
        <iframe
          width="100%"
          height="110%"
          style={{ border: 0, marginTop: '-5%' }}
          loading="lazy"
          allowFullScreen
          src={mapUrl}
          className={`grayscale-[0.1] contrast-[0.95] transition-all duration-700 ${isLocating ? 'scale-110 brightness-110' : 'scale-100 brightness-100'}`}
        ></iframe>

        {showRoute && (
          <div className="absolute inset-0 pointer-events-none z-10 animate-in fade-in duration-1000">
            <svg className="w-full h-full" viewBox="0 0 400 800">
              <defs>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#d1af47" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#d1af47" stopOpacity="0.3" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <path d="M 200 400 L 220 350 L 180 300 L 250 220 L 200 150" fill="none" stroke="url(#routeGradient)" strokeWidth="6" strokeLinecap="round" strokeDasharray="12 10" filter="url(#glow)" className="animate-[dash_6s_linear_infinite]" />
            </svg>
          </div>
        )}

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 pointer-events-none">
          <div className="relative">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-primary/25 rounded-full animate-ping ${isLocating ? 'scale-150' : 'scale-100'}`}></div>
            <div className="h-14 w-14 rounded-full border-[3px] border-white shadow-xl overflow-hidden relative z-20">
              <img className="w-full h-full object-cover rounded-full" src="https://picsum.photos/seed/mom/100/100" alt="Avatar" />
            </div>
          </div>
        </div>

        {/* 懸浮定位按鈕 - 與截圖同步樣式 */}
        <div className="absolute bottom-10 right-5 z-30 pointer-events-auto">
          <button 
            onClick={handleLocate}
            className="size-14 bg-stone-800/80 backdrop-blur-md rounded-[20px] flex items-center justify-center border border-white/15 shadow-2xl active:scale-90 transition-all hover:bg-stone-700/90"
          >
            <span className="material-symbols-outlined text-white text-[28px] rotate-[30deg]">near_me</span>
          </button>
        </div>
      </main>

      <div className="relative z-20 -mt-5 rounded-t-[32px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col shrink-0">
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-12 h-1 rounded-full bg-stone-100"></div>
        </div>
        
        <div className="px-6 pt-1 pb-4">
          <div className="flex items-start justify-between mb-3.5">
            <div className="text-left">
              <h2 className="font-display text-xl font-bold text-stone-900 flex items-center gap-1.5">
                媽媽目前平安
                <span className="material-symbols-outlined text-secondary-green text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
              </h2>
              <p className="text-[12px] text-stone-400 mt-0.5 flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                台北市信義區信義路五段 7 號
              </p>
            </div>
            <button onClick={() => handleAction('撥號中：媽媽...')} className="flex items-center justify-center size-12 rounded-full bg-[#fde8dc] text-[#e67e22] shadow-sm active:scale-90 transition-all">
              <span className="material-symbols-outlined text-[26px]">call</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="flex flex-col items-center justify-center py-2.5 rounded-2xl bg-[#f8f9fa]">
              <div className="mb-1 text-secondary-green bg-white p-1.5 rounded-full shadow-sm"><span className="material-symbols-outlined text-[18px]">shield</span></div>
              <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">狀態</span>
              <span className="text-[13px] font-bold">平安</span>
            </div>
            <div className="flex flex-col items-center justify-center py-2.5 rounded-2xl bg-[#f8f9fa]">
              <div className="mb-1 text-stone-500 bg-white p-1.5 rounded-full shadow-sm"><span className="material-symbols-outlined text-[18px] rotate-90">battery_5_bar</span></div>
              <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">電量</span>
              <span className="text-[13px] font-bold">85%</span>
            </div>
            <div className="flex flex-col items-center justify-center py-2.5 rounded-2xl bg-[#f8f9fa]">
              <div className="mb-1 text-primary bg-white p-1.5 rounded-full shadow-sm"><span className="material-symbols-outlined text-[18px]">schedule</span></div>
              <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">更新</span>
              <span className="text-[13px] font-bold">即時</span>
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <button onClick={() => { setShowRoute(!showRoute); handleAction(showRoute ? '歷史軌跡已關閉' : '正在載入本日歷史軌跡...'); }} className={`flex-1 h-12 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${showRoute ? 'bg-stone-800 text-white' : 'bg-primary text-stone-900'}`}>
              <span className="material-symbols-outlined text-[20px]">{showRoute ? 'layers_clear' : 'directions'}</span>
              <span className="text-sm">{showRoute ? '隱藏路線' : '查看路線'}</span>
            </button>
            <button onClick={() => setIsChatOpen(true)} className="flex-1 h-12 bg-white border-2 border-stone-100 text-stone-700 font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm">
              <span className="material-symbols-outlined text-[20px]">chat</span>
              <span className="text-sm">聯絡他</span>
            </button>
          </div>
        </div>
      </div>

      <nav className="bg-[#f9f7f4] border-t border-stone-200/40 px-8 pb-7 pt-3 flex justify-between items-center text-[9px] font-bold uppercase tracking-[0.1em] shrink-0 relative z-40">
        <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-0.5 text-stone-400 active:scale-90 transition-transform"><span className="material-symbols-outlined text-[24px]">home</span><span>首頁</span></button>
        <button onClick={() => navigate('/guardian-map')} className="flex flex-col items-center gap-0.5 text-primary"><span className="material-symbols-outlined text-[24px]" style={{fontVariationSettings: "'FILL' 1"}}>map</span><span>地圖</span></button>
        <button onClick={() => navigate('/logs')} className="flex flex-col items-center gap-0.5 text-stone-400 active:scale-90 transition-transform"><span className="material-symbols-outlined text-[24px]">local_activity</span><span>活動</span></button>
        <button onClick={() => navigate('/privacy')} className="flex flex-col items-center gap-0.5 text-stone-400 active:scale-90 transition-transform"><span className="material-symbols-outlined text-[24px]">settings</span><span>設定</span></button>
      </nav>

      {isChatOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom-full duration-500 overflow-hidden flex flex-col h-[75vh]">
            <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-full bg-cover shadow-sm border border-stone-100" style={{backgroundImage: "url('https://picsum.photos/seed/mom/100/100')"}}></div>
                <div className="text-left"><h3 className="font-bold text-stone-800 text-base">聯絡 媽媽</h3><p className="text-[11px] text-primary font-bold">目前在線上</p></div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="size-9 rounded-full bg-stone-100/80 flex items-center justify-center text-stone-400 active:scale-90 transition-transform"><span className="material-symbols-outlined text-[22px]">close</span></button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto bg-[#fafafa] flex flex-col gap-5">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm border border-stone-100/50 text-sm font-medium ${msg.sender === 'user' ? 'bg-primary text-stone-900 rounded-tr-none' : 'bg-white text-stone-800 rounded-tl-none'}`}>{msg.text}</div>
                  <div className="mt-1 flex items-center gap-1.5 px-1"><span className="text-[9px] text-stone-400 font-bold uppercase tracking-tight">{msg.time}</span></div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-5 bg-white border-t border-stone-100 flex gap-3 items-center shrink-0 pb-10">
              <div className="flex-1 relative"><input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="輸入訊息..." className="w-full bg-[#f3f3f3] border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-1 focus:ring-primary outline-none text-stone-700 font-medium placeholder:text-stone-400" /></div>
              <button onClick={sendMessage} className="size-13 h-13 w-13 bg-primary text-stone-900 rounded-2xl flex items-center justify-center shadow-[0_4px_12px_rgba(209,175,71,0.3)] active:scale-95 transition-all shrink-0"><span className="material-symbols-outlined text-[26px] translate-x-0.5">send</span></button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes dash { to { stroke-dashoffset: -22; } }
        .size-13 { width: 3.25rem; height: 3.25rem; }
      `}</style>
    </div>
  );
};

export default GuardianMapView;
