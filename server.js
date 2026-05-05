const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const config = require('./config');
const buildApp = require('./app');
const registerSockets = require('./sockets');

const app = buildApp();
const server = http.createServer(app);

mongoose.connect(config.mongoUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));
mongoose.connection.on('error', err => console.error('Mongo error:', err));
mongoose.connection.on('disconnected', () => console.warn('Mongo disconnected'));

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
registerSockets(io);

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
