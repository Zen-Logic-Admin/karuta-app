import { useState, useEffect } from 'react';
import { socket } from '../socket.js';
import { QRCodeSVG } from 'qrcode.react';
import RotatingBackground from '../components/RotatingBackground.jsx';

export default function WaitingScreen({ roomInfo, onEdit }) {
  const [players, setPlayers] = useState(roomInfo.players);
  const [isHost, setIsHost] = useState(roomInfo.isHost);
  const joinUrl = window.location.origin;

  useEffect(() => {
    socket.on('room:updated', ({ players: p }) => setPlayers(p));
    socket.on('host:changed', ({ hostId, players: p }) => {
      setIsHost(socket.id === hostId);
      setPlayers(p);
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
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < players.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none', fontSize: 15 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
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
