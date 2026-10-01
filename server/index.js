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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

 socket.on('join-room', ({ roomId, peerId }) => {
  socket.join(roomId);
  socket.to(roomId).emit('user-joined', peerId);
  console.log(`Socket ${socket.id} (peer ${peerId}) joined room ${roomId}`);
});

  socket.on('send-message', ({ roomId, message, sender }) => {
    io.to(roomId).emit('receive-message', { message, sender });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));