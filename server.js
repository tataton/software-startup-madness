/* Server-side code has to accommodate oddities in the way that some browsers
interact with socket.io. For example, Google Chrome will initiate a socket
whenever the target address appears in the autocomplete address list (but
before the page has actually been loaded), and will maintain the socket even
after the page has been closed. THis means it is possible for the program to
mis-judge whether a player is logged in or not, or logged in multiple times. */

var express = require('express');
var socket = require('socket.io');
var app = express();
var path = require('path');
var port = process.env.PORT || 8080;
app.use(express.static('public'));

var server = app.listen(port, function(){
  console.log('Server up on port ' + port + '.');
});

app.get('/', function(req, res){
  res.sendFile(path.resolve('public/index.html'));
});

var io = socket(server);

var inGamePlayers = [];
var lobbyPlayerNicknames = [];
var lobbyLast5Messages = [];

function Player(socketID, firstName, lastInitial){
  this.socketID = socketID;
  this.firstName = firstName;
  this.lastInitial = lastInitial;
  this.nickname = (firstName + ' ' + lastInitial);
}

/* Chat room functionality. I'd like to export this as a module if I can,
but I'm not sure if socket.io will get in the way. */

function currentTime(){
  return new Date().toLocaleTimeString(
    'en-US', {hour12: false, hour: "numeric", minute: "numeric"});
}

io.sockets.on('connection', function(socket){
  var thisPlayer;
  console.log('New socket id: ' + socket.id);
  // nameData object from client: {firstName: <firstName>, lastInitial: <lastInitial>}
  socket.on('name', function(nameData){
    /* Sometimes, browsers will hold the connection open, even if a player has
    exited the game. Then, when they log in again, they are actually already logged
    in and they don't know it. Have to check for this possibility.
    If the player isn't already connected, add new Player to inGamePlayers array. */
    var socketIDfound = false, nameDataFound = false;
    for (var i = 0; i < inGamePlayers.length; i++) {
      if (inGamePlayers[i].socketID == socket.id) {
        socketIDfound = true;
        // Just in case someone borrowed another player's phone and signed in:
        inGamePlayers[i].firstName = nameData.firstName;
        inGamePlayers[i].lastInitial = nameData.lastInitial;
        inGamePlayers[i].nickname = nameData.firstName + nameData.lastInitial;
        lobbyPlayerNicknames[i] = inGamePlayers[i].nickname;
      } else if ((inGamePlayers[i].firstName == nameData.firstName) && (inGamePlayers[i].lastInitial == nameData.lastInitial)) {
        /* We'll assume this means someone opened a new browser and accidentally
        forgot to close the old one, or that the browser is maintaining the old
        connection. */
        inGamePlayers[i].socketID = socket.id;
        nameDataFound = true;
      }
    }
    if ((!socketIDfound) && (!nameDataFound)) {
      thisPlayer = new Player(socket.id, nameData.firstName, nameData.lastInitial);
      inGamePlayers.push(thisPlayer);
      lobbyPlayerNicknames.push(thisPlayer.nickname);
    }
    // Notify all other players to add new name to lobby list.
    io.sockets.emit('lobby-names', lobbyPlayerNicknames);
    // Update new client on latest chat messages.
    for (var j = 0; j < lobbyLast5Messages.length; j++) {
      socket.emit('message', lobbyLast5Messages[j]);
    }
    // Broadcast message that new player has joined.
    var joinMessage = '<mark>' + currentTime() + ' <em>' + thisPlayer.nickname + ' joined the chat.</em></mark>';
    broadcastMessage(joinMessage);
    // On disconnect, have to reverse a lot of these items.
    socket.on('disconnect', function(){
      // Broadcast message that player has left.
      var leaveMessage = '<mark>' + currentTime() + ' <em>' + thisPlayer.nickname + ' left the chat.</em></mark>';
      broadcastMessage(leaveMessage);
      // Find this player in arrays of Players, and remove.
      var playerIndex = inGamePlayers.indexOf(thisPlayer);
      inGamePlayers.splice(playerIndex, 1);
      lobbyPlayerNicknames.splice(playerIndex, 1);
      // Update everyone's chatroom's list of names.
      io.sockets.emit('lobby-names', lobbyPlayerNicknames);
    });
  });
  socket.on('message', function(message){
    var timestampedMessage = '<mark>' + currentTime() + ' ' + thisPlayer.nickname + ':</mark> ' + message;
    broadcastMessage(timestampedMessage);
  });
});

function broadcastMessage(message){
  io.sockets.emit('message', message);
  lobbyLast5Messages.push(message);
  if (lobbyLast5Messages.length === 6) {
    lobbyLast5Messages.shift();
  }
}

/* End of chatroom functionality. */
