
// SettingsView — repurposed from PrivacySettingsView
import React, { useState } from 'react';
import { useApp } from '../App';
import { BottomNav } from './DashboardView';
import { AppConfig, RegionTarget, VideoResolution } from '../types';

type PrivacyLevel = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

interface MaskedInputProps {
  label: string;
  value: string;
  placeholder: string;
  hint?: string;
  onChange: (v: string) => void;
}

const MaskedInput: React.FC<MaskedInputProps> = ({ label, value, placeholder, hint, onChange }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] text-tt-muted">{label}</label>
        {hint && (
          <span className="text-[9px] text-tt-dim">{hint}</span>
        )}
      </div>
      <div className="flex items-center bg-tt-card border border-tt-border rounded-lg overflow-hidden">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2.5 text-xs text-white placeholder-tt-dim outline-none font-mono"
        />
        <button
          className="px-3 py-2.5 text-tt-muted text-xs"
          onClick={() => setVisible(!visible)}
        >
          {visible ? '隱藏' : '顯示'}
        </button>
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const SettingsView: React.FC = () => {
  const { config, setConfig } = useApp();
  const [local, setLocal] = useState<AppConfig>({ ...config });
  const [saved, setSaved] = useState(false);

  const update = (key: keyof AppConfig, value: any) => {
    setLocal(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    setConfig(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const regions: RegionTarget[] = ['Global', 'CN', 'TW'];
  const resolutions: VideoResolution[] = ['480p', '720p', '1080p', '2K'];
  const durations: (5 | 8 | 12 | 15)[] = [5, 8, 12, 15];
  const privacyLevels: PrivacyLevel[] = ['PUBLIC', 'FOLLOWERS', 'PRIVATE'];

  const privacyLabel: Record<PrivacyLevel, string> = {
    PUBLIC: '公開', FOLLOWERS: '粉絲', PRIVATE: '私人',
  };

  return (
    <div className="min-h-screen bg-tt-bg pb-24">

      {/* header */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-xl font-black text-white font-display">⚙️ API 設定</h1>
        <p className="text-tt-muted text-xs mt-0.5">配置 Seedance 2.0 及 TikTok 服務金鑰</p>
      </div>

      <div className="px-4 space-y-4">

        {/* Seedance / Volcengine */}
        <div className="bg-tt-surface border border-tt-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#25F4EE)' }}
            >S</div>
            <span className="text-sm font-bold text-white">Seedance 2.0</span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(139,92,246,0.2)', color: '#8B5CF6' }}
            >Volcengine ARK</span>
          </div>

          <MaskedInput
            label="Seedance API Key"
            value={local.seedanceApiKey}
            placeholder="sk-seedance-..."
            hint="第三方 API 可用"
            onChange={v => update('seedanceApiKey', v)}
          />
          <MaskedInput
            label="Volcengine ARK API Key"
            value={local.volcengineApiKey}
            placeholder="ark-..."
            hint="官方 2/24 後開放"
            onChange={v => update('volcengineApiKey', v)}
          />

          <div className="text-[10px] text-tt-dim bg-tt-card rounded-lg px-3 py-2 leading-relaxed">
            💡 Volcengine ARK API 預計 2026/2/24 正式開放。現可透過
            <span style={{ color: '#8B5CF6' }}> APIYI</span>、
            <span style={{ color: '#8B5CF6' }}>AIFreeAPI</span> 等第三方服務存取。
          </div>
        </div>

        {/* TikTok API */}
        <div className="bg-tt-surface border border-tt-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
              style={{ background: 'linear-gradient(135deg,#FE2C55,#FF7A00)' }}
            >♪</div>
            <span className="text-sm font-bold text-white">TikTok API</span>
          </div>

          <MaskedInput
            label="Client Key"
            value={local.tiktokClientKey}
            placeholder="aw1234567890abcde"
            hint="Developer Portal"
            onChange={v => update('tiktokClientKey', v)}
          />
          <MaskedInput
            label="Access Token"
            value={local.tiktokAccessToken}
            placeholder="act.example..."
            hint="OAuth 2.0"
            onChange={v => update('tiktokAccessToken', v)}
          />

          <div className="text-[10px] text-tt-dim bg-tt-card rounded-lg px-3 py-2 leading-relaxed">
            需在 <span style={{ color: '#FE2C55' }}>developers.tiktok.com</span> 申請
            Content Posting API 及 Research API 存取授權，並通過審核後才可自動發布至公開帳號。
          </div>
        </div>

        {/* Video Settings */}
        <div className="bg-tt-surface border border-tt-border rounded-2xl p-4 space-y-4">
          <span className="text-sm font-bold text-white">影片生成設定</span>

          {/* region */}
          <div>
            <div className="text-[11px] text-tt-muted mb-2">目標地區</div>
            <div className="flex gap-2">
              {regions.map(r => (
                <button
                  key={r}
                  onClick={() => update('targetRegion', r)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: local.targetRegion === r ? '#FE2C55' : '#1e1e1e',
                    color: local.targetRegion === r ? '#fff' : '#555',
                    border: `1px solid ${local.targetRegion === r ? 'transparent' : '#2a2a2a'}`,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* resolution */}
          <div>
            <div className="text-[11px] text-tt-muted mb-2">影片解析度</div>
            <div className="grid grid-cols-4 gap-1.5">
              {resolutions.map(r => (
                <button
                  key={r}
                  onClick={() => update('videoResolution', r)}
                  className="py-2 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    background: local.videoResolution === r
                      ? 'linear-gradient(135deg,#8B5CF6,#25F4EE)' : '#1e1e1e',
                    color: local.videoResolution === r ? '#fff' : '#555',
                    border: `1px solid ${local.videoResolution === r ? 'transparent' : '#2a2a2a'}`,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="text-[9px] text-tt-dim mt-1">
              2K ≈ $0.52/影片 · 1080p ≈ $0.30/影片（8秒）
            </div>
          </div>

          {/* duration */}
          <div>
            <div className="text-[11px] text-tt-muted mb-2">影片時長</div>
            <div className="grid grid-cols-4 gap-1.5">
              {durations.map(d => (
                <button
                  key={d}
                  onClick={() => update('videoDuration', d)}
                  className="py-2 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    background: local.videoDuration === d ? '#FE2C55' : '#1e1e1e',
                    color: local.videoDuration === d ? '#fff' : '#555',
                    border: `1px solid ${local.videoDuration === d ? 'transparent' : '#2a2a2a'}`,
                  }}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* post privacy */}
          <div>
            <div className="text-[11px] text-tt-muted mb-2">發布隱私設定</div>
            <div className="flex gap-2">
              {privacyLevels.map(p => (
                <button
                  key={p}
                  onClick={() => update('postPrivacy', p)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    background: local.postPrivacy === p
                      ? 'rgba(0,216,91,0.2)' : '#1e1e1e',
                    color: local.postPrivacy === p ? '#00D85B' : '#555',
                    border: `1px solid ${local.postPrivacy === p ? 'rgba(0,216,91,0.3)' : '#2a2a2a'}`,
                  }}
                >
                  {privacyLabel[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Auto Run */}
        <div className="bg-tt-surface border border-tt-border rounded-2xl p-4">
          <span className="text-sm font-bold text-white block mb-3">自動排程</span>

          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-tt-muted">自動執行流水線</div>
              <div className="text-[10px] text-tt-dim mt-0.5">定時自動掃描趨勢並發布</div>
            </div>
            <button
              onClick={() => update('autoRun', !local.autoRun)}
              className="w-12 h-6 rounded-full transition-all relative"
              style={{
                background: local.autoRun ? '#FE2C55' : '#2a2a2a',
              }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-200"
                style={{ left: local.autoRun ? 'calc(100% - 22px)' : '2px' }}
              />
            </button>
          </div>

          {local.autoRun && (
            <div>
              <div className="text-[11px] text-tt-muted mb-2">執行間隔（小時）</div>
              <div className="flex gap-2">
                {[2, 4, 6, 12].map(h => (
                  <button
                    key={h}
                    onClick={() => update('runIntervalHours', h)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: local.runIntervalHours === h ? '#FE2C55' : '#1e1e1e',
                      color: local.runIntervalHours === h ? '#fff' : '#555',
                      border: `1px solid ${local.runIntervalHours === h ? 'transparent' : '#2a2a2a'}`,
                    }}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={save}
          className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
          style={{
            background: saved
              ? 'linear-gradient(135deg,#00D85B,#00A847)'
              : 'linear-gradient(135deg,#FE2C55,#8B5CF6)',
            boxShadow: saved ? '0 0 16px rgba(0,216,91,0.3)' : '0 0 16px rgba(254,44,85,0.3)',
          }}
        >
          {saved ? '✓ 已儲存設定' : '儲存設定'}
        </button>

        {/* API reference links */}
        <div className="bg-tt-surface border border-tt-border rounded-xl p-4 space-y-2">
          <div className="text-xs font-bold text-white mb-1">開發資源</div>
          {[
            { label: 'Seedance 2.0 官方頁面', url: 'Volcengine → Seed.ByteDance' },
            { label: 'TikTok Content Posting API', url: 'developers.tiktok.com' },
            { label: 'TikTok Research API', url: 'developers.tiktok.com/research' },
            { label: 'Volcengine ARK SDK', url: 'github.com/volcengine/veadk-python' },
          ].map(link => (
            <div key={link.label} className="flex items-center gap-2 py-1">
              <span className="text-[10px] text-tt-muted flex-1">{link.label}</span>
              <span className="text-[9px] font-mono text-tt-dim">{link.url}</span>
              <span className="text-tt-dim text-xs">›</span>
            </div>
          ))}
        </div>

      </div>

      <BottomNav />
    </div>
  );
};

export default SettingsView;
