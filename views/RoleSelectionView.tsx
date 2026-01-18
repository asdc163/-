
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface RoleSelectionViewProps {
  onSelectRole: (role: 'protected' | 'protector') => void;
}

const RoleSelectionView: React.FC<RoleSelectionViewProps> = ({ onSelectRole }) => {
  const [selectedRole, setSelectedRole] = React.useState<'protected' | 'protector' | null>(null);
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full flex-col font-display overflow-x-hidden p-6">
      <header className="flex flex-col items-center pt-12 pb-6 text-center z-10">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 text-primary">
          <span className="material-symbols-outlined text-4xl">wb_sunny</span>
        </div>
        <h1 className="text-stone-900 dark:text-stone-50 text-[32px] font-bold leading-tight tracking-tight mb-3">
          請選擇您的角色
        </h1>
        <p className="text-stone-500 dark:text-stone-400 font-body text-base font-normal leading-relaxed max-w-xs mx-auto">
          歡迎使用微光 Glimmer。請選擇您要使用的模式以開始。
        </p>
      </header>

      <main className="flex-1 flex flex-col items-stretch gap-4 pb-24 max-w-md mx-auto w-full">
        <div 
          onClick={() => setSelectedRole('protected')}
          className={`relative cursor-pointer group overflow-hidden rounded-xl bg-surface-light dark:bg-surface-dark border-2 transition-all duration-300 p-4 flex flex-col gap-4 ${
            selectedRole === 'protected' ? 'border-primary ring-2 ring-primary/20' : 'border-transparent shadow-sm'
          }`}
        >
          <div className="relative w-full h-32 rounded-lg bg-stone-100 dark:bg-black/20 overflow-hidden">
            <div className="absolute inset-0 bg-cover bg-center opacity-90 group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: "url('https://picsum.photos/seed/safety/600/400')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-surface-light/80 to-transparent dark:from-surface-dark/80"></div>
            <div className="absolute top-3 left-3 bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-sm p-2 rounded-lg shadow-sm text-primary">
              <span className="material-symbols-outlined text-2xl">shield_person</span>
            </div>
            {selectedRole === 'protected' && (
              <div className="absolute top-3 right-3 bg-primary text-stone-900 rounded-full p-1 animate-in zoom-in duration-300">
                <span className="material-symbols-outlined text-lg font-bold">check</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-stone-900 dark:text-stone-50 text-xl font-bold leading-tight">我需要被守護</h2>
            <p className="text-stone-500 dark:text-stone-400 font-body text-sm font-normal leading-relaxed">
              我想讓信任的聯絡人知道我的安全狀態，並在需要協助時發送警報。
            </p>
          </div>
        </div>

        <div 
          onClick={() => setSelectedRole('protector')}
          className={`relative cursor-pointer group overflow-hidden rounded-xl bg-surface-light dark:bg-surface-dark border-2 transition-all duration-300 p-4 flex flex-col gap-4 ${
            selectedRole === 'protector' ? 'border-primary ring-2 ring-primary/20' : 'border-transparent shadow-sm'
          }`}
        >
          <div className="relative w-full h-32 rounded-lg bg-stone-100 dark:bg-black/20 overflow-hidden">
            <div className="absolute inset-0 bg-cover bg-center opacity-90 group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: "url('https://picsum.photos/seed/light/600/400')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-surface-light/80 to-transparent dark:from-surface-dark/80"></div>
            <div className="absolute top-3 left-3 bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-sm p-2 rounded-lg shadow-sm text-primary">
              <span className="material-symbols-outlined text-2xl">visibility</span>
            </div>
            {selectedRole === 'protector' && (
              <div className="absolute top-3 right-3 bg-primary text-stone-900 rounded-full p-1 animate-in zoom-in duration-300">
                <span className="material-symbols-outlined text-lg font-bold">check</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-stone-900 dark:text-stone-50 text-xl font-bold leading-tight">我要守護他人</h2>
            <p className="text-stone-500 dark:text-stone-400 font-body text-sm font-normal leading-relaxed">
              我想確認親友的安全狀況，並接收他們的緊急求助警報。
            </p>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark dark:to-transparent z-20">
        <div className="max-w-md mx-auto">
          <button 
            disabled={!selectedRole}
            onClick={() => selectedRole && onSelectRole(selectedRole)}
            className={`w-full flex items-center justify-center rounded-xl h-14 transition-all shadow-lg text-lg font-bold leading-normal tracking-wide active:scale-[0.98] ${
              selectedRole ? 'bg-primary text-[#191710] shadow-primary/25 hover:bg-primary/90' : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            <span>下一步</span>
            <span className="material-symbols-outlined ml-2 text-xl">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionView;
