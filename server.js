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

var lobbyPlayers = [];
var lobbyPlayerNicknames = [];
var lobbyLast9Messages = [];

function Player(socketID, firstName, lastInitial){
  this.socketID = socketID;
  this.firstName = firstName;
  this.lastInitial = lastInitial;
  this.nickname = (firstName + ' ' + lastInitial);
}

function currentTime(){
  return new Date().toLocaleTimeString(
    'en-US', {hour12: false, hour: "numeric", minute: "numeric"});
}

io.sockets.on('connection', function(socket){
  var thisPlayer;
  console.log('New socket id: ' + socket.id);
  // nameData object: {firstName: <firstName>, lastInitial: <lastInitial>}
  socket.on('name', function(nameData){
    thisPlayer = new Player(socket.id, nameData.firstName, nameData.lastInitial);
    lobbyPlayers.push(thisPlayer);
    lobbyPlayerNicknames.push(thisPlayer.nickname);
    socket.broadcast.emit('lobby-names', lobbyPlayerNicknames);
    for (var i = 0; i < lobbyLast9Messages.length; i++) {
      socket.emit('message', lobbyLast9Messages[i]);
    }
    var joinMessage = currentTime() + ' ' + thisPlayer.nickname + ' joined the lobby.';
    relayChatMessage('message', joinMessage);

    socket.on('disconnect', function(){
      socket.broadcast.emit('lobby-left', thisPlayer.nickname);
      var playerIndex = lobbyPlayers.indexOf(thisPlayer);
      lobbyPlayers.splice(playerIndex, 1);
    });
  });
  // message object: {author: <Player.nickname>, content: <string>}
  socket.on('message', function(message){
    socket.broadcast.emit('message', message);
    socket.emit('message', message);
  });
  socket.on('disconnect', function(){
    console.log('Socket ' + socket.id + ' disconnected.');
  });
});

function relayChatMessage(socket, message){}
