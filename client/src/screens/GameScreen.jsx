import { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from '../socket.js';
import { getYomifuda, CARD_IDS } from '../cardData.js';

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

function getTitle(rankFromBottom, total) {
  if (rankFromBottom === 0) return 'よそ者';
  if (rankFromBottom === 1 && total > 2) return 'えせ妻沼人';
  if (rankFromBottom === total - 1) return '妻沼かるた名人';
  if (rankFromBottom === total - 2 && total > 3) return '妻沼かるた士';
  return '妻沼町民';
}

export default function GameScreen({ roomInfo, initialState, onGameOver }) {
  const [players, setPlayers] = useState(initialState.players);
  const [currentCard, setCurrentCard] = useState(null);
  const [claimed, setClaimed] = useState({});
  const [gameOver, setGameOver] = useState(false);
  const [roundActive, setRoundActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [penalty, setPenalty] = useState(null);
  const [isHost, setIsHost] = useState(roomInfo.isHost);
  const [shuffledIds] = useState(() => [...CARD_IDS].sort(() => Math.random() - 0.5));
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [revealedCount, setRevealedCount] = useState(0);
  const [finalPlayers, setFinalPlayers] = useState([]);

  const currentCardRef = useRef(null);
  const isHostRef = useRef(roomInfo.isHost);
  const pointerStartRef = useRef(null);
  const myId = socket.id;

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

    const resumeInterval = setInterval(() => {
      if (window.speechSynthesis.speaking) window.speechSynthesis.resume();
    }, 8000);
    const fallbackTimeout = setTimeout(() => setIsSpeaking(false), 30000);

    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => { setIsSpeaking(false); clearInterval(resumeInterval); clearTimeout(fallbackTimeout); };
    utt.onerror = () => { setIsSpeaking(false); clearInterval(resumeInterval); clearTimeout(fallbackTimeout); };

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
      setPenalty(null);
      // TTS はホストのみ（ホスト端末がかるた読み上げ機として機能）
      if (isHostRef.current) {
        const yomifuda = getYomifuda();
        speak(yomifuda[cardId] || cardId);
      }
    });

    socket.on('round:claimed', ({ winnerId, winnerName, cardId, players: p }) => {
      setClaimed((prev) => ({ ...prev, [cardId]: winnerName }));
      setRoundActive(false);
      setCurrentCard(null);
      currentCardRef.current = null;
      setPlayers(p);
      setIsSpeaking(false);
      window.speechSynthesis?.cancel();
    });

    socket.on('round:skipped', () => {
      setRoundActive(false);
      setCurrentCard(null);
      currentCardRef.current = null;
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
      const sorted = [...p].sort((a, b) => (b.score - (b.penalties || 0)) - (a.score - (a.penalties || 0)));
      setFinalPlayers(sorted);
      setPlayers(p);
      setGameOver(true);
      setRoundActive(false);
      setIsSpeaking(false);
      window.speechSynthesis?.cancel();
    });

    socket.on('room:updated', ({ players: p }) => setPlayers(p));
    socket.on('host:changed', ({ hostId, players: p }) => {
      const nowHost = socket.id === hostId;
      isHostRef.current = nowHost;
      setIsHost(nowHost);
      setPlayers(p);
    });

    return () => {
      ['round:start','round:claimed','round:skipped','tap:penalty','game:over','room:updated','host:changed']
        .forEach((e) => socket.off(e));
      window.speechSynthesis?.cancel();
    };
  }, [speak, myId]);

  // 結果発表: 下から順に1人ずつ表示
  useEffect(() => {
    if (!gameOver || finalPlayers.length === 0) return;
    setRevealedCount(0);
    let count = 0;
    const timer = setInterval(() => {
      count++;
      setRevealedCount(count);
      if (count >= finalPlayers.length) clearInterval(timer);
    }, 1800);
    return () => clearInterval(timer);
  }, [gameOver, finalPlayers.length]);

  function tapCard(cardId) {
    if (claimed[cardId] || !roundActive) return;
    socket.emit('card:tap', { cardId });
  }

  function nextRound() {
    if (isSpeaking || roundActive) return;
    // iOS音声制限解除: ユーザージェスチャー内でspeechSynthesisに触れる
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(u);
      window.speechSynthesis.cancel();
    }
    socket.emit('round:next');
  }

  function skipRound() {
    socket.emit('round:skip');
  }

  function forceEndGame() {
    if (window.confirm('ゲームを終了しますか？')) {
      socket.emit('game:end');
    }
  }

  const sorted = [...players].sort((a, b) => (b.score - (b.penalties || 0)) - (a.score - (a.penalties || 0)));
  const claimedCount = Object.keys(claimed).length;

  // ゲーム終了画面（下から順に発表）
  if (gameOver) {
    const sortedForReveal = [...finalPlayers].reverse(); // 最下位→最上位の順
    const total = sortedForReveal.length;

    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '32px 24px', background: 'linear-gradient(180deg, #0a0500 0%, #1a0a00 60%, #0a0000 100%)' }}>
        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(40px) scale(0.95); }
            to   { opacity: 1; transform: translateY(0)   scale(1); }
          }
        `}</style>

        <div style={{ fontSize: 22, fontWeight: 'bold', color: '#ffd700', letterSpacing: 4, marginBottom: 4 }}>
          {revealedCount < total ? '結果発表' : '🎊 最終結果'}
        </div>

        <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sortedForReveal.slice(0, revealedCount).map((p, i) => {
            const rankFromBottom = i;
            const actualRank = total - i;
            const isTop = actualRank === 1;
            const isNew = i === revealedCount - 1;
            const badge = actualRank === 1 ? '🏆' : actualRank === 2 ? '🥈' : actualRank === 3 ? '🥉' : `${actualRank}位`;
            const title = getTitle(rankFromBottom, total);

            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 18px',
                  background: isTop ? 'rgba(255,215,0,0.18)' : isNew ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                  borderRadius: 12,
                  border: isTop ? '1px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,255,255,0.07)',
                  animation: isNew ? 'slideUp 0.5s ease-out' : 'none',
                }}
              >
                <div style={{ fontSize: isTop ? 28 : 20, minWidth: 36, textAlign: 'center' }}>{badge}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: isTop ? '#ffd700' : '#888', marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 17, color: '#fff', fontWeight: isTop ? 'bold' : 'normal' }}>{p.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#4ade80', fontWeight: 'bold' }}>{p.score}取</div>
                  {(p.penalties || 0) > 0 && <div style={{ color: '#f87171', fontSize: 12 }}>-{p.penalties}罰</div>}
                </div>
              </div>
            );
          })}
        </div>

        {revealedCount >= total && (
          <button
            style={{ marginTop: 12, padding: '14px 40px', fontSize: 18, fontWeight: 'bold', borderRadius: 12, border: 'none', cursor: 'pointer', background: '#ffd700', color: '#1a0a00' }}
            onClick={onGameOver}
          >
            トップに戻る
          </button>
        )}
      </div>
    );
  }

  const hostBtnLabel = () => {
    if (isSpeaking) return '読み上げ中…';
    if (roundActive) return null;
    if (claimedCount === 0) return '▶ 最初の一枚を引く';
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

      {/* ヘッダー */}
      <div style={{ padding: '6px 10px', background: 'rgba(100,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ fontSize: 13, color: '#ffd700', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {isSpeaking ? '🔊' : `残り${CARD_IDS.length - claimedCount}枚`}
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
                onPointerDown={(e) => {
                  pointerStartRef.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerUp={(e) => {
                  if (!pointerStartRef.current) return;
                  const dx = Math.abs(e.clientX - pointerStartRef.current.x);
                  const dy = Math.abs(e.clientY - pointerStartRef.current.y);
                  pointerStartRef.current = null;
                  if (dx < 10 && dy < 10) tapCard(id);
                }}
                onPointerCancel={() => { pointerStartRef.current = null; }}
                style={{
                  aspectRatio: '3/4',
                  borderRadius: 5,
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: isClaimed ? 'default' : roundActive ? 'pointer' : 'default',
                  opacity: isClaimed ? 0.2 : 1,
                  transition: 'opacity 0.4s',
                  border: '1px solid rgba(255,255,255,0.08)',
                  touchAction: 'pan-y',
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
            <>
              <button
                onClick={nextRound}
                disabled={isSpeaking}
                style={{ flex: 1, padding: '13px', fontSize: 17, fontWeight: 'bold', borderRadius: 10, border: 'none', cursor: isSpeaking ? 'not-allowed' : 'pointer', background: isSpeaking ? '#333' : '#ffd700', color: isSpeaking ? '#888' : '#1a0a00' }}
              >
                {hostBtnLabel()}
              </button>
              <button
                onClick={forceEndGame}
                style={{ padding: '13px 14px', fontSize: 13, borderRadius: 10, border: '1px solid #444', background: 'transparent', color: '#666', cursor: 'pointer' }}
              >
                終了
              </button>
            </>
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
