import { useState } from 'react';
import { socket } from '../socket.js';
import RotatingBackground from '../components/RotatingBackground.jsx';

const s = {
  wrap: { height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24, position: 'relative', zIndex: 1 },
  title: { fontSize: 34, fontWeight: 'bold', color: '#ffd700', textAlign: 'center', textShadow: '0 2px 16px rgba(0,0,0,0.9)', letterSpacing: 6 },
  input: { width: '100%', maxWidth: 320, padding: '12px 16px', fontSize: 18, borderRadius: 10, border: '2px solid rgba(255,215,0,0.7)', background: 'rgba(0,0,0,0.5)', color: '#fff', outline: 'none', textAlign: 'center', backdropFilter: 'blur(4px)' },
  btn: { width: '100%', maxWidth: 320, padding: '14px', fontSize: 18, fontWeight: 'bold', borderRadius: 10, border: 'none', cursor: 'pointer' },
  btnPrimary: { background: '#ffd700', color: '#1a0a00' },
  btnSecondary: { background: 'rgba(0,0,0,0.4)', color: '#ffd700', border: '2px solid rgba(255,215,0,0.6)', backdropFilter: 'blur(4px)' },
  divider: { color: 'rgba(255,204,136,0.8)', fontSize: 14 },
  codeInput: { width: '100%', maxWidth: 320, padding: '12px 16px', fontSize: 28, borderRadius: 10, border: '2px solid rgba(255,215,0,0.7)', background: 'rgba(0,0,0,0.5)', color: '#fff', outline: 'none', textAlign: 'center', letterSpacing: 10, fontWeight: 'bold', backdropFilter: 'blur(4px)' },
};

export default function HomeScreen() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState(null);

  function createRoom() {
    if (!name.trim()) return alert('名前を入力してください');
    socket.emit('room:create', { playerName: name.trim() });
  }

  function joinRoom() {
    if (!name.trim()) return alert('名前を入力してください');
    if (code.length !== 4) return alert('4桁のルームコードを入力してください');
    socket.emit('room:join', { roomCode: code, playerName: name.trim() });
  }

  return (
    <>
      <RotatingBackground />
      <div style={s.wrap}>
        <div style={s.title}>めぬま郷土かるた</div>

        {!mode && (
          <>
            <input style={s.input} placeholder="あなたの名前" value={name} onChange={(e) => setName(e.target.value)} maxLength={10} />
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => setMode('create')}>部屋を作る（ホスト）</button>
            <div style={s.divider}>― または ―</div>
            <button style={{ ...s.btn, ...s.btnSecondary }} onClick={() => setMode('join')}>部屋に参加する</button>
          </>
        )}

        {mode === 'create' && (
          <>
            <input style={s.input} placeholder="あなたの名前" value={name} onChange={(e) => setName(e.target.value)} maxLength={10} autoFocus />
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={createRoom}>部屋を作る</button>
            <button style={{ ...s.btn, ...s.btnSecondary }} onClick={() => setMode(null)}>もどる</button>
          </>
        )}

        {mode === 'join' && (
          <>
            <input style={s.input} placeholder="あなたの名前" value={name} onChange={(e) => setName(e.target.value)} maxLength={10} />
            <input style={s.codeInput} placeholder="1234" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" maxLength={4} />
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={joinRoom}>参加する</button>
            <button style={{ ...s.btn, ...s.btnSecondary }} onClick={() => setMode(null)}>もどる</button>
          </>
        )}
      </div>
    </>
  );
}
