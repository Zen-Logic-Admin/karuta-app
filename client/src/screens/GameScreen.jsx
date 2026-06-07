import { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from '../socket.js';
import { getYomifuda, CARD_IDS } from '../cardData.js';

// ベストな日本語音声を選ぶ（Edgeのニューラル音声 Nanami > Keita > オンライン > ローカルの順）
function getBestJapaneseVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  const ja = voices.filter((v) => v.lang === 'ja-JP' || v.lang === 'ja');
  return (
    ja.find((v) => /nanami/i.test(v.name) && /natural/i.test(v.name)) ||
    ja.find((v) => /keita/i.test(v.name) && /natural/i.test(v.name)) ||
    ja.find((v) => /nanami/i.test(v.name)) ||
    ja.find((v) => /keita/i.test(v.name)) ||
    ja.find((v) => /natural|premium|enhanced/i.test(v.name)) ||
    ja.find((v) => !v.localService) ||
    ja[0] ||
    null
  );
}

export default function GameScreen({ roomInfo, initialState, onGameOver }) {
  const [players, setPlayers] = useState(initialState.players);
  const [currentCard, setCurrentCard] = useState(null);
  const [claimed, setClaimed] = useState({});
  const [lastClaim, setLastClaim] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [roundActive, setRoundActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [penalty, setPenalty] = useState(null); // { id } for flash
  const [isHost, setIsHost] = useState(roomInfo.isHost);
  const [shuffledIds] = useState(() => [...CARD_IDS].sort(() => Math.random() - 0.5));
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const currentCardRef = useRef(null);
  const myId = socket.id;

  // 音声一覧が読み込まれたら最善を選択
  useEffect(() => {
    function loadVoices() {
      const all = window.speechSynthesis?.getVoices() || [];
      const ja = all.filter((v) => v.lang === 'ja-JP' || v.lang === 'ja');
      setVoices(ja);
      if (!selectedVoiceName) {
        const best = getBestJapaneseVoice();
        if (best) setSelectedVoiceName(best.name);
      }
    }
    loadVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const speak = useCallback((text) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'ja-JP';
    utt.rate = 0.82;
    utt.pitch = 1.05;

    const voice = window.speechSynthesis.getVoices().find((v) => v.name === selectedVoiceName);
    if (voice) utt.voice = voice;

    const interval = setInterval(() => {
      if (window.speechSynthesis.speaking) window.speechSynthesis.resume();
    }, 8000);
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => { setIsSpeaking(false); clearInterval(interval); };
    utt.onerror = () => { setIsSpeaking(false); clearInterval(interval); };

    setIsSpeaking(true);
    window.speechSynthesis.speak(utt);
  }, [ttsEnabled, selectedVoiceName]);

  const reSpeak = useCallback(() => {
    if (!currentCardRef.current) return;
    const yomifuda = getYomifuda();
    speak(yomifuda[currentCardRef.current] || currentCardRef.current);
  }, [speak]);

  useEffect(() => {
    socket.on('round:start', ({ cardId }) => {
      setCurrentCard(cardId);
      currentCardRef.current = cardId;
      setRoundActive(true);
      setLastClaim(null);
      setPenalty(null);
      const yomifuda = getYomifuda();
      speak(yomifuda[cardId] || cardId);
    });

    socket.on('round:claimed', ({ winnerId, winnerName, cardId, players: p }) => {
      setClaimed((prev) => ({ ...prev, [cardId]: winnerName }));
      setRoundActive(false);
      setCurrentCard(null);
      currentCardRef.current = null;
      setPlayers(p);
      setLastClaim({ winnerId, winnerName, cardId, isMe: winnerId === myId });
      setIsSpeaking(false);
      window.speechSynthesis?.cancel();
    });

    socket.on('round:skipped', () => {
      setRoundActive(false);
      setCurrentCard(null);
      currentCardRef.current = null;
      setLastClaim(null);
      setIsSpeaking(false);
      window.speechSynthesis?.cancel();
    });

    socket.on('tap:penalty', ({ players: p, penaltyPlayerId }) => {
      setPlayers(p);
      if (penaltyPlayerId === myId) {
        setPenalty(Date.now());
        setTimeout(() => setPenalty(null), 1200);
      }
    });

    socket.on('game:over', ({ players: p }) => {
      setPlayers(p);
      setGameOver(true);
      setRoundActive(false);
      setIsSpeaking(false);
      window.speechSynthesis?.cancel();
    });

    socket.on('room:updated', ({ players: p }) => setPlayers(p));
    socket.on('host:changed', ({ hostId, players: p }) => {
      setIsHost(socket.id === hostId);
      setPlayers(p);
    });

    return () => {
      ['round:start','round:claimed','round:skipped','tap:penalty','game:over','room:updated','host:changed']
        .forEach((e) => socket.off(e));
      window.speechSynthesis?.cancel();
    };
  }, [speak, myId]);

  function tapCard(cardId) {
    if (claimed[cardId] || !roundActive) return;
    socket.emit('card:tap', { cardId });
  }

  function nextRound() {
    if (isSpeaking || roundActive) return;
    socket.emit('round:next');
  }

  function skipRound() {
    socket.emit('round:skip');
  }

  const sorted = [...players].sort((a, b) => (b.score - (b.penalties || 0)) - (a.score - (a.penalties || 0)));
  const claimedCount = Object.keys(claimed).length;

  // ゲーム終了画面
  if (gameOver) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, background: 'linear-gradient(180deg, #8b0000 0%, #1a0a00 100%)' }}>
        <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ffd700', letterSpacing: 4 }}>ゲーム終了！</div>
        <div style={{ width: '100%', maxWidth: 360 }}>
          {sorted.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: i === 0 ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.08)', borderRadius: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>{['🏆','🥈','🥉'][i] || `${i+1}.`}</span>
              <span style={{ flex: 1, fontSize: 16 }}>{p.name}</span>
              <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{p.score}取</span>
              {(p.penalties || 0) > 0 && <span style={{ color: '#f87171', fontSize: 14 }}>-{p.penalties}罰</span>}
            </div>
          ))}
        </div>
        <button style={{ padding: '14px 40px', fontSize: 18, fontWeight: 'bold', borderRadius: 12, border: 'none', cursor: 'pointer', background: '#ffd700', color: '#1a0a00' }} onClick={onGameOver}>
          トップに戻る
        </button>
      </div>
    );
  }

  const hostBtnLabel = () => {
    if (isSpeaking) return '読み上げ中…';
    if (roundActive) return null; // show re-read/skip instead
    if (claimedCount === 0) return '▶ 最初の一枚を引く';
    if (claimedCount === CARD_IDS.length) return 'ゲーム終了';
    return '▶ 次の札を引く';
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#1a0a00', overflow: 'hidden' }}>
      {/* お手付きフラッシュ */}
      {penalty && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(220,30,30,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, pointerEvents: 'none' }}>
          <div style={{ fontSize: 48, fontWeight: 'bold', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>お手付き！</div>
        </div>
      )}

      {/* 取った！トースト */}
      {lastClaim && !roundActive && (
        <div style={{ position: 'fixed', top: 48, left: '50%', transform: 'translateX(-50%)', background: lastClaim.isMe ? 'rgba(180,120,0,0.92)' : 'rgba(0,0,0,0.82)', color: '#fff', padding: '8px 22px', borderRadius: 20, fontSize: 16, fontWeight: 'bold', zIndex: 50, pointerEvents: 'none', whiteSpace: 'nowrap', backdropFilter: 'blur(6px)' }}>
          {lastClaim.isMe ? '🎉 取った！' : `${lastClaim.winnerName} が取った！`}
        </div>
      )}

      {/* ヘッダー */}
      <div style={{ padding: '6px 10px', background: 'rgba(100,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ fontSize: 13, color: '#ffd700', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {isSpeaking ? '🔊' : '残り'}{!isSpeaking && `${CARD_IDS.length - claimedCount}枚`}
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
          {sorted.map((p) => (
            <span key={p.id} style={{ fontSize: 11, color: p.id === myId ? '#ffd700' : '#ddd', background: 'rgba(255,255,255,0.12)', padding: '2px 7px', borderRadius: 10 }}>
              {p.name} {p.score}{(p.penalties || 0) > 0 ? <span style={{ color: '#f87171' }}> -{p.penalties}</span> : ''}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {voices.length > 1 && (
            <select
              value={selectedVoiceName}
              onChange={(e) => setSelectedVoiceName(e.target.value)}
              style={{ fontSize: 10, background: 'rgba(0,0,0,0.6)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.5)', borderRadius: 4, padding: '2px 4px', maxWidth: 90 }}
            >
              {voices.map((v) => <option key={v.name} value={v.name}>{v.name.replace(/ \(.*\)/, '')}</option>)}
            </select>
          )}
          <button onClick={() => setTtsEnabled((v) => !v)} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: ttsEnabled ? '#ffd700' : '#555' }}>
            {ttsEnabled ? '🔊' : '🔇'}
          </button>
        </div>
      </div>


      {/* 絵札グリッド */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 5 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
          {shuffledIds.map((id) => {
            const isClaimed = !!claimed[id];
            return (
              <div
                key={id}
                onPointerDown={() => tapCard(id)}
                style={{
                  aspectRatio: '3/4',
                  borderRadius: 5,
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: isClaimed ? 'default' : roundActive ? 'pointer' : 'default',
                  opacity: isClaimed ? 0.2 : 1,
                  transition: 'opacity 0.4s',
                  border: '1px solid rgba(255,255,255,0.08)',
                  touchAction: 'manipulation',
                }}
              >
                <img
                  src={`/cards/${id}.png`}
                  alt={id}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                  draggable={false}
                />
                {isClaimed && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, color: '#ffd700', textAlign: 'center', padding: '0 2px' }}>{claimed[id]}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ホスト操作ボタン */}
      {isHost && (
        <div style={{ padding: '8px 12px', background: '#0a0500', flexShrink: 0, display: 'flex', gap: 8 }}>
          {!roundActive ? (
            <button
              onClick={nextRound}
              disabled={isSpeaking}
              style={{ flex: 1, padding: '13px', fontSize: 17, fontWeight: 'bold', borderRadius: 10, border: 'none', cursor: isSpeaking ? 'not-allowed' : 'pointer', background: isSpeaking ? '#333' : '#ffd700', color: isSpeaking ? '#888' : '#1a0a00' }}
            >
              {hostBtnLabel()}
            </button>
          ) : (
            <>
              <button
                onClick={reSpeak}
                disabled={isSpeaking}
                style={{ flex: 1, padding: '13px', fontSize: 15, fontWeight: 'bold', borderRadius: 10, border: '2px solid #ffd700', background: 'transparent', color: isSpeaking ? '#555' : '#ffd700', cursor: isSpeaking ? 'not-allowed' : 'pointer' }}
              >
                {isSpeaking ? '読み上げ中…' : '🔁 もう一度'}
              </button>
              <button
                onClick={skipRound}
                disabled={isSpeaking}
                style={{ padding: '13px 20px', fontSize: 15, borderRadius: 10, border: '1px solid #555', background: 'transparent', color: '#888', cursor: isSpeaking ? 'not-allowed' : 'pointer' }}
              >
                ⏭ スキップ
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
