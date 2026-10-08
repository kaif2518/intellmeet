require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const meetingRoutes = require('./routes/meetingRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

app.get('/', (req, res) => res.send('IntellMeet API running'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// roomId -> { socketId: { peerId, name } }
const rooms = {};

const removeFromRoom = (socket) => {
  const { roomId, peerId } = socket.data;
  if (!roomId) return;
  socket.leave(roomId);
  if (rooms[roomId]) {
    delete rooms[roomId][socket.id];
    if (Object.keys(rooms[roomId]).length === 0) delete rooms[roomId];
  }
  socket.to(roomId).emit('user-left', { peerId });
  socket.data.roomId = null;
  socket.data.peerId = null;
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-room', ({ roomId, peerId, name }) => {
    removeFromRoom(socket);

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.peerId = peerId;

    if (!rooms[roomId]) rooms[roomId] = {};
    const existing = Object.values(rooms[roomId]);
    rooms[roomId][socket.id] = { peerId, name };

    // tell the newcomer who is already here, and tell everyone else about the newcomer
    socket.emit('room-users', existing);
    socket.to(roomId).emit('user-joined', { peerId, name });
    console.log(`${name} (peer ${peerId}) joined room ${roomId}, total ${existing.length + 1}`);
  });

  socket.on('leave-room', () => removeFromRoom(socket));

  socket.on('send-message', ({ roomId, message, sender }) => {
    io.to(roomId).emit('receive-message', { message, sender });
  });

  socket.on('transcript-line', ({ roomId, line }) => {
    socket.to(roomId).emit('transcript-line', { line });
  });

  socket.on('transcript-interim', ({ roomId, name, text }) => {
    socket.to(roomId).emit('transcript-interim', { name, text });
  });

  socket.on('disconnect', () => {
    removeFromRoom(socket);
    console.log('A user disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));