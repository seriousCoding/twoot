require('dotenv').config({ path: '../.env' });
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const helmet = require('helmet');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var friendsRouter = require('./routes/friends');
var messagesRouter = require('./routes/messages');
var gameInvitesRouter = require('./routes/gameInvites');
var gameRoomsRouter = require('./routes/gameRooms');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/friends', friendsRouter);
app.use('/messages', messagesRouter);
app.use('/game-invites', gameInvitesRouter);
app.use('/game-rooms', gameRoomsRouter);

// Serve frontend build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Error handler - must be AFTER routes
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

module.exports = app;
