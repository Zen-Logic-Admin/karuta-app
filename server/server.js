const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { cards } = require('./gameData');

const app = express();
app.use(cors());

// 本番環境: Reactビルドを配信
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const rooms = new Map();

function generateRoomCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(code));
  return code;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ playerName }) => {
    const code = generateRoomCode();
    const room = {
      code,
      hostId: socket.id,
      players: [{ id: socket.id, name: playerName, score: 0 }],
      state: 'waiting',
      deck: [],
      currentCard: null,
      roundActive: false,
      claimedCards: new Set(),
    };
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;
    socket.emit('room:created', {
      roomCode: code,
      players: room.players,
      isHost: true,
    });
  });

  socket.on('room:join', ({ roomCode, playerName }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('error', { message: 'ルームが見つかりません' });
      return;
    }
    if (room.state !== 'waiting') {
      socket.emit('error', { message: 'ゲームはすでに始まっています' });
      return;
    }
    const player = { id: socket.id, name: playerName, score: 0 };
    room.players.push(player);
    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('room:joined', {
      roomCode,
      players: room.players,
      isHost: false,
    });
    socket.to(roomCode).emit('room:updated', { players: room.players });
  });

  socket.on('game:start', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id) return;
    room.state = 'playing';
    room.deck = shuffle(cards.map((c) => c.id));
    io.to(room.code).emit('game:started', {
      cardIds: cards.map((c) => c.id),
      players: room.players,
    });
  });

  socket.on('round:next', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id || room.state !== 'playing') return;

    if (room.deck.length === 0) {
      io.to(room.code).emit('game:over', { players: room.players });
      room.state = 'over';
      return;
    }

    const cardId = room.deck.pop();
    const cardData = cards.find((c) => c.id === cardId);
    room.currentCard = cardId;
    room.roundActive = true;

    io.to(room.code).emit('round:start', {
      cardId,
      yomifuda: cardData.yomifuda,
      remaining: room.deck.length,
      total: cards.length,
    });
  });

  socket.on('card:tap', ({ cardId }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.roundActive) return;

    const player = room.players.find((p) => p.id === socket.id);

    if (cardId !== room.currentCard) {
      // お手付き
      if (player) player.penalties = (player.penalties || 0) + 1;
      io.to(room.code).emit('tap:penalty', {
        penaltyPlayerId: socket.id,
        players: room.players,
      });
      return;
    }

    room.roundActive = false;
    room.claimedCards.add(cardId);
    if (player) player.score += 1;

    io.to(room.code).emit('round:claimed', {
      winnerId: socket.id,
      winnerName: player ? player.name : '???',
      cardId,
      players: room.players,
    });
  });

  socket.on('round:skip', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id || !room.roundActive) return;
    room.roundActive = false;
    room.currentCard = null;
    io.to(room.code).emit('round:skipped', {});
  });

  socket.on('game:end', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id) return;
    room.state = 'over';
    io.to(room.code).emit('game:over', { players: room.players });
  });

  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(roomCode);
      return;
    }
    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      io.to(roomCode).emit('host:changed', {
        hostId: room.hostId,
        players: room.players,
      });
    } else {
      io.to(roomCode).emit('room:updated', { players: room.players });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Karuta server running on port ${PORT}`);
});
