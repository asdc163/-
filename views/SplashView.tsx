
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props { onDone: () => void; }

const SplashView: React.FC<Props> = ({ onDone }) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1000);
    const t3 = setTimeout(() => setPhase(3), 1800);
    const t4 = setTimeout(() => {
      onDone();
      navigate('/dashboard');
    }, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [navigate, onDone]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-tt-bg relative overflow-hidden">
      {/* bg grid */}
      <div className="absolute inset-0 bg-grid opacity-30" />

      {/* corner glows */}
      <div className="absolute top-0 left-0 w-48 h-48 opacity-25"
        style={{ background: 'radial-gradient(circle at 0% 0%, #FE2C55, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-48 h-48 opacity-25"
        style={{ background: 'radial-gradient(circle at 100% 100%, #25F4EE, transparent 70%)' }} />

      <div className="relative flex flex-col items-center gap-6 z-10 px-8 text-center">

        {/* logo icon */}
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center transition-all duration-700"
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'scale(1)' : 'scale(0.6)',
            background: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 50%, #25F4EE 100%)',
            boxShadow: '0 0 40px rgba(254,44,85,0.5), 0 0 80px rgba(37,244,238,0.2)',
          }}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M18 13l20 11-20 11V13z" fill="white" />
            <circle cx="38" cy="10" r="3" fill="#FFD60A" />
            <circle cx="10" cy="38" r="2" fill="#25F4EE" />
            <circle cx="40" cy="36" r="1.5" fill="white" opacity="0.7" />
          </svg>
        </div>

        {/* title */}
        <div
          className="transition-all duration-700"
          style={{
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? 'translateY(0)' : 'translateY(16px)',
            transitionDelay: '100ms',
          }}
        >
          <div className="text-4xl font-black tracking-widest text-white font-display"
            style={{ letterSpacing: '0.15em' }}>
            SEEDANCE
          </div>
          <div
            className="text-sm font-bold tracking-[0.35em] mt-1 font-display"
            style={{
              background: 'linear-gradient(90deg, #FE2C55, #25F4EE)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.35em',
            }}
          >
            AGENT
          </div>
          <div className="text-tt-muted text-xs mt-3 tracking-wide">
            抖音 × Seedance 2.0 全自動內容代理
          </div>
        </div>

        {/* pipeline labels */}
        <div
          className="transition-all duration-700"
          style={{
            opacity: phase >= 3 ? 1 : 0,
            transform: phase >= 3 ? 'translateY(0)' : 'translateY(12px)',
            transitionDelay: '200ms',
          }}
        >
          <div className="flex items-center gap-1.5 text-xs font-mono flex-wrap justify-center">
            {[
              { label: '🔥 趨勢', color: '#FF7A00' },
              { label: '→', color: '#333' },
              { label: '🎬 生成', color: '#8B5CF6' },
              { label: '→', color: '#333' },
              { label: '🏷 SEO', color: '#25F4EE' },
              { label: '→', color: '#333' },
              { label: '📤 發布', color: '#FE2C55' },
              { label: '→', color: '#333' },
              { label: '📊 優化', color: '#00D85B' },
            ].map((item, i) => (
              <span key={i} style={{ color: item.color }}>{item.label}</span>
            ))}
          </div>
        </div>

        {/* progress bar */}
        <div
          className="w-48 h-0.5 bg-tt-border rounded-full overflow-hidden mt-2 transition-all duration-500"
          style={{ opacity: phase >= 2 ? 1 : 0 }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: phase >= 2 ? '100%' : '0%',
              transition: 'width 2s ease-out',
              background: 'linear-gradient(90deg, #FE2C55, #8B5CF6, #25F4EE)',
            }}
          />
        </div>
      </div>

      <div className="absolute bottom-8 text-tt-dim text-xs font-mono">
        v2.0 · Powered by Seedance 2.0 &amp; TikTok API
      </div>
    </div>
  );
};

export default SplashView;
