const { socketAuth } = require('./auth');
const registerHandlers = require('./handlers');

// Composition root for socket.io. Plugs in the auth middleware globally and
// wires per-connection event handlers.
module.exports = (io) => {
  io.use(socketAuth);
  io.on('connection', (socket) => registerHandlers(io, socket));
};
