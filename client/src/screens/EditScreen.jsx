import { useState } from 'react';
import { defaultYomifuda, getYomifuda, saveYomifuda, CARD_IDS } from '../cardData.js';

export default function EditScreen({ onBack }) {
  const [texts, setTexts] = useState(() => getYomifuda());
  const [saved, setSaved] = useState(false);

  function update(id, val) {
    setTexts((prev) => ({ ...prev, [id]: val }));
    setSaved(false);
  }

  function reset(id) {
    setTexts((prev) => ({ ...prev, [id]: defaultYomifuda[id] }));
    setSaved(false);
  }

  function save() {
    saveYomifuda(texts);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function resetAll() {
    setTexts({ ...defaultYomifuda });
    setSaved(false);
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#1a0a00' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', background: '#8b0000', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#ffd700', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>
          ←
        </button>
        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#ffd700', flex: 1 }}>読み句を編集</div>
        <button onClick={resetAll} style={{ background: 'none', border: '1px solid #888', color: '#888', fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
          全リセット
        </button>
        <button
          onClick={save}
          style={{ background: saved ? '#4ade80' : '#ffd700', border: 'none', color: '#1a0a00', fontSize: 14, fontWeight: 'bold', padding: '6px 16px', borderRadius: 8, cursor: 'pointer' }}
        >
          {saved ? '保存済！' : '保存'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          ※ TTS読み間違いは読みがなに書き直してください。句読点「、」で間を取ります。
        </div>
        {CARD_IDS.map((id) => {
          const isModified = texts[id] !== defaultYomifuda[id];
          return (
            <div key={id} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#8b0000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffd700', fontSize: 16, fontWeight: 'bold', flexShrink: 0 }}>
                {id}
              </div>
              <input
                value={texts[id]}
                onChange={(e) => update(id, e.target.value)}
                style={{ flex: 1, padding: '8px 10px', fontSize: 14, background: isModified ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.07)', border: isModified ? '1px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', outline: 'none' }}
              />
              {isModified && (
                <button onClick={() => reset(id)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>
                  ↺
                </button>
              )}
            </div>
          );
        })}
        <div style={{ height: 80 }} />
      </div>
    </div>
  );
}
