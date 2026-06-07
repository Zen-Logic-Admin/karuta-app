import { useState, useEffect } from 'react';
import { socket } from './socket.js';
import HomeScreen from './screens/HomeScreen.jsx';
import WaitingScreen from './screens/WaitingScreen.jsx';
import GameScreen from './screens/GameScreen.jsx';
import EditScreen from './screens/EditScreen.jsx';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [roomInfo, setRoomInfo] = useState(null);
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    socket.connect();

    socket.on('room:created', (data) => {
      setRoomInfo({ ...data });
      setScreen('waiting');
    });
    socket.on('room:joined', (data) => {
      setRoomInfo({ ...data });
      setScreen('waiting');
    });
    socket.on('room:updated', ({ players }) => {
      setRoomInfo((r) => r ? { ...r, players } : r);
    });
    socket.on('host:changed', ({ hostId, players }) => {
      setRoomInfo((r) => r ? { ...r, isHost: socket.id === hostId, players } : r);
    });
    socket.on('game:started', ({ cardIds, players }) => {
      setGameState({ cardIds, players });
      setScreen('game');
    });
    socket.on('error', ({ message }) => alert(message));

    return () => {
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:updated');
      socket.off('host:changed');
      socket.off('game:started');
      socket.off('error');
      socket.disconnect();
    };
  }, []);

  if (screen === 'home') return <HomeScreen />;
  if (screen === 'waiting') return <WaitingScreen roomInfo={roomInfo} onEdit={() => setScreen('edit')} />;
  if (screen === 'edit') return <EditScreen onBack={() => setScreen('waiting')} />;
  if (screen === 'game') return (
    <GameScreen
      roomInfo={roomInfo}
      initialState={gameState}
      onGameOver={() => setScreen('home')}
    />
  );
  return null;
}
