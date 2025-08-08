const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static frontend files from 'public' folder
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

let waitingUser = null;

io.on('connection', (socket) => {
  socket.partner = null;

  // Pair user with waiting user if exists
  if (waitingUser) {
    socket.partner = waitingUser;
    waitingUser.partner = socket;
    waitingUser.emit('chat_start');
    socket.emit('chat_start');
    waitingUser = null;
  } else {
    waitingUser = socket;
    socket.emit('waiting');
  }

  // Forward chat messages between partners
  socket.on('message', (msg) => {
    if (socket.partner) {
      socket.partner.emit('message', msg);
    }
  });

  // Skip current partner and requeue
  socket.on('skip', () => {
    if (socket.partner) {
      socket.partner.emit('partner_left');
      socket.partner.partner = null;
      socket.partner = null;
    }

    if (waitingUser === socket) {
      waitingUser = null;
    }

    // Try to pair again immediately
    if (waitingUser) {
      socket.partner = waitingUser;
      waitingUser.partner = socket;
      waitingUser.emit('chat_start');
      socket.emit('chat_start');
      waitingUser = null;
    } else {
      waitingUser = socket;
      socket.emit('waiting');
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    if (socket.partner) {
      socket.partner.emit('partner_left');
      socket.partner.partner = null;
    }

    if (waitingUser === socket) {
      waitingUser = null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Talk Talk server running on port ${PORT}`);
});

