const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connesso: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnesso: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io non inizializzato');
  return io;
}

module.exports = { initSocket, getIO };
