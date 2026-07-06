import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket.js';
import { QRCodeSVG } from 'qrcode.react';
import RotatingBackground from '../components/RotatingBackground.jsx';

const AVATARS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🐰', '🦁', '🐯', '🐨'];

const WAIT_CSS = `
  @keyframes joinPop {
    0%   { opacity: 0; transform: translateX(-30px) scale(0.6); }
    60%  { opacity: 1; transform: translateX(4px) scale(1.08); }
    100% { opacity: 1; transform: translateX(0) scale(1); }
  }
  @keyframes joinToast {
    0%   { opacity: 0; transform: translateY(-16px); }
    15%  { opacity: 1; transform: translateY(0); }
    80%  { opacity: 1; }
    100% { opacity: 0; transform: translateY(-10px); }
  }
`;

export default function WaitingScreen({ roomInfo, onEdit }) {
  const [players, setPlayers] = useState(roomInfo.players);
  const [isHost, setIsHost] = useState(roomInfo.isHost);
  const [joinToast, setJoinToast] = useState(null);
  const [newPlayerId, setNewPlayerId] = useState(null);
  const prevIdsRef = useRef(new Set(roomInfo.players.map((p) => p.id)));
  const joinUrl = window.location.origin;

  useEffect(() => {
    function handleUpdate(p) {
      const prevIds = prevIdsRef.current;
      const added = p.find((pl) => !prevIds.has(pl.id));
      if (added) {
        setJoinToast({ name: added.name, key: Date.now() });
        setNewPlayerId(added.id);
        setTimeout(() => setJoinToast(null), 2200);
        setTimeout(() => setNewPlayerId(null), 800);
      }
      prevIdsRef.current = new Set(p.map((pl) => pl.id));
      setPlayers(p);
    }
    socket.on('room:updated', ({ players: p }) => handleUpdate(p));
    socket.on('host:changed', ({ hostId, players: p }) => {
      setIsHost(socket.id === hostId);
      handleUpdate(p);
    });
    return () => {
      socket.off('room:updated');
      socket.off('host:changed');
    };
  }, []);

  const s = {
    wrap: { height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px', gap: 18, overflowY: 'auto', position: 'relative', zIndex: 1 },
    code: { fontSize: 56, fontWeight: 'bold', color: '#fff', letterSpacing: 12, textShadow: '0 0 20px rgba(255,215,0,0.8)' },
    btn: { width: '100%', maxWidth: 320, padding: '14px', fontSize: 17, fontWeight: 'bold', borderRadius: 10, border: 'none', cursor: 'pointer' },
    card: { background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', borderRadius: 14, padding: '14px 18px', width: '100%', maxWidth: 360, border: '1px solid rgba(255,255,255,0.1)' },
  };

  return (
    <>
      <RotatingBackground />
      <style>{WAIT_CSS}</style>

      {joinToast && (
        <div key={joinToast.key} style={{
          position: 'fixed', top: 18, left: 0, right: 0, zIndex: 100,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{
            padding: '10px 22px', borderRadius: 24,
            background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,215,0,0.55)',
            color: '#ffd700', fontSize: 15, fontWeight: 'bold',
            animation: 'joinToast 2.2s ease-out forwards',
          }}>
            🎉 {joinToast.name} が参加した！
          </div>
        </div>
      )}

      <div style={s.wrap}>
        <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ffd700', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>待合室</div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#ffcc88' }}>ルームコード</div>
          <div style={s.code}>{roomInfo.roomCode}</div>
        </div>

        <div style={{ background: '#fff', padding: 10, borderRadius: 12 }}>
          <QRCodeSVG value={joinUrl} size={120} />
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,204,136,0.8)', textAlign: 'center' }}>QRコードでアクセス後、コードを入力</div>

        <div style={s.card}>
          <div style={{ fontSize: 13, color: '#ffcc88', marginBottom: 8 }}>参加者 ({players.length}人)</div>
          {players.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: i < players.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              fontSize: 15,
              animation: p.id === newPlayerId ? 'joinPop 0.6s ease-out' : 'none',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{AVATARS[i % AVATARS.length]}</span>
              <span style={{ color: '#fff' }}>{p.name}</span>
              {i === 0 && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#ffd700' }}>👑 ホスト</span>}
            </div>
          ))}
        </div>

        {isHost ? (
          <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button style={{ ...s.btn, background: '#ffd700', color: '#1a0a00' }} onClick={() => socket.emit('game:start')}>
              ゲームスタート！
            </button>
            <button style={{ ...s.btn, background: 'rgba(0,0,0,0.4)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onEdit}>
              ✏ 読み句を編集
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'rgba(255,204,136,0.8)' }}>ホストがゲームを開始するのを待っています…</div>
        )}
      </div>
    </>
  );
}
