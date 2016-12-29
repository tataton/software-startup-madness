/* Server-side code has to accommodate oddities in the way that some browsers
interact with socket.io. For example, Google Chrome will initiate a socket
whenever the target address appears in the autocomplete address list (but
before the page has actually been loaded), and will maintain the socket even
after the page has been closed. THis means it is possible for the program to
mis-judge whether a player is logged in or not, or logged in multiple times. */

var MIN_PLAYERS_IN_GAME = 2;
var MAX_PLAYERS_IN_GAME = 4;

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

var lobbyPlayers = {};
/* Structure of lobbyPlayers:
{
  socketID_of_Player:     { firstName: firstName,
                            lastInitial: lastInitial,
                            nickname: (firstName + ' ' + lastInitial),
                            hostOfGame: true/false,
                            playerInGame: true/false,
                            gameInProgress: true/false
                          },
  socketID_of_nextPlayer: ....
}
*/
var lobbyLast5Messages = [];
var gameIndex = 1;
var lobbyGames = {};
/* Structure of lobbyGames:
{
  gameIndex_of_Game:      { hostID: hostID,
                            playerIDs: [playerID, playerID, ...],
                            gameInProgress: true/false
                          },
  gameIndex_of_NextGame: ....
}
*/

function Player(firstName, lastInitial){
  // Player constructor.
  this.firstName = firstName;
  this.lastInitial = lastInitial;
  this.nickname = (firstName + ' ' + lastInitial);
  this.hostOfGame = false;
  this.playerInGame = false;
  /* HostOfGame and playerInGame are mutually exclusive by design; the
  game host is not considered to be a player. */
  this.gameInProgress = false;
}

function Game(hostID){
  // Game constructor.
  this.hostID = hostID;
  this.playerIDs = [];
  this.gameInProgress = false;
  gameIndex++;
}

//                              //
//-- Chat room functionality. --//
//                              //

function currentTime(){
  // Used to timestamp chat messages.
  return new Date().toLocaleTimeString(
    'en-US', {hour12: false, hour: "numeric", minute: "numeric"});
}

io.sockets.on('connection', function(socket){
  console.log('New socket id: ' + socket.id);
  // nameData object from client: {firstName: <firstName>, lastInitial: <lastInitial>}
  socket.on('name', function(nameData){
    var thisPlayer, i, j;
    /* Sometimes, browsers will hold the connection open, even if a player has
    exited the game. Then, when they log in again, they are actually already logged
    in and they don't know it. Have to check for this possibility.
    If the player isn't already connected, add new Player to lobbyPlayers array. */
    var socketIDfound = false;
    for (var socketID in lobbyPlayers) {
      if (socketID == socket.id) {
        socketIDfound = true;
        /* Player went through log-in screen, but a login already exists for
        this socketID. This shouldn't happen, really. But it *might* happen if
        someone borrowed another player's phone and signed in, or otherwise a
        name changed for an existing socket.id. */
        thisPlayer = lobbyPlayers[socketID];
        thisPlayer.firstName = nameData.firstName;
        thisPlayer.lastInitial = nameData.lastInitial;
        // And create new nickname for Player.
        thisPlayer.nickname = nameData.firstName + nameData.lastInitial;
      } else if ((lobbyPlayers[socketID].firstName == nameData.firstName) && (lobbyPlayers[socketID].lastInitial == nameData.lastInitial)) {
        /* A currently logged in name accesses a new socket.id. We'll assume this
        means someone opened a new browser and accidentally forgot to close the
        old one, or that the browser is maintaining the old connection even
        though the browser has been re-directed. We'll remove the existing
        Player, and then allow the new Player to be added as normal. */
        delete lobbyPlayers[socketID];
      }
    }
    if (!(socketIDfound)) {
      thisPlayer = new Player(nameData.firstName, nameData.lastInitial);
      lobbyPlayers[socket.id] = thisPlayer;
    }
    /* Either way, a reference to thisPlayer has been created. We'll use that
    reference throughout this socket.on('name') declaration. */
    // Notify all other players to add new name to lobby list.
    broadcastLobbyNames();
    // Broadcast game/button info to this socket only.
    broadcastGames(socket.id);
    // Update new client on latest chat messages.
    for (j = 0; j < lobbyLast5Messages.length; j++) {
      socket.emit('message', lobbyLast5Messages[j]);
    }
    // Broadcast message that new player has joined.
    var joinMessage = '<mark>' + currentTime() + ' <em>' + thisPlayer.nickname + ' joined the chat.</em></mark>';
    broadcastMessage(joinMessage);
    // On disconnect, have to reverse a lot of these items.
    socket.on('disconnect', function(){
      // When a player leaves:
      // Broadcast message that player has left.
      var leaveMessage = '<mark>' + currentTime() + ' <em>' + thisPlayer.nickname + ' left the chat.</em></mark>';
      broadcastMessage(leaveMessage);
      // Remove player from any games that they are hosting/member of.
      if (thisPlayer.hostOfGame) {
        abandonHost(socket.id, thisPlayer.hostOfGame);
      } else if (thisPlayer.playerInGame) {
        leaveGame(socket.id, thisPlayer.playerInGame);
      }
      // Delete the player.
      delete lobbyPlayers[socket.id];
      // Update everyone's chatroom's list of names.
      broadcastLobbyNames();
    });
  });

  socket.on('message', function(message){
    // Broadcast a received message back to other players, with a timestamp.
    var timestampedMessage = '<mark>' + currentTime() + ' ' + lobbyPlayers[socket.id].nickname + ':</mark> ' + message;
    broadcastMessage(timestampedMessage);
  });
  socket.on('new-game', function(){
    // Create a new game object.
    var thisGame = new Game(socket.id);
    lobbyGames[gameIndex] = thisGame;
    lobbyPlayers[socket.id].hostOfGame = gameIndex;
    broadcastGames(false);
  });
  socket.on('join-game', function(gameToJoin){
    lobbyGames[gameToJoin].playerIDs.push(socket.id);
    lobbyPlayers[socket.id].playerInGame = gameToJoin;
    broadcastGames(false);
  });
  socket.on('leave-game', function(gameToLeave){
    leaveGame(socket.id, gameToLeave);
  });
  socket.on('abandon-host', function(gameToAbandon){
    abandonHost(socket.id, gameToAbandon);
  });
});

function leaveGame(socketID, gameToLeave){
  var i = lobbyGames[gameToLeave].playerIDs.indexOf(socketID);
  lobbyGames[gameToLeave].playerIDs.splice(i, 1);
  lobbyPlayers[socketID].playerInGame = false;
  broadcastGames(false);
}

function abandonHost(socketID, gameToAbandon){
  if (lobbyGames[gameToAbandon].playerIDs.length === 0) {
    // Then there's no one left in the game. Close it.
    delete lobbyGames[gameToAbandon];
  } else {
    // The first ID in the playerIDs array should become the new host.
    lobbyGames[gameToAbandon].hostID = lobbyGames[gameToAbandon].playerIDs[0];
    lobbyGames[gameToAbandon].playerIDs.shift();
  }
  lobbyPlayers[socketID].hostOfGame = false;
  broadcastGames(false);
}

function broadcastLobbyNames(){
  // Sends out an updated list of available player names.
  var lobbyPlayerNicknames = [];
  for (var socketID in lobbyPlayers) {
    if (!(lobbyPlayers[socketID].gameInProgress)) {
      // Players in an active game aren't included in the list.
      lobbyPlayerNicknames.push(lobbyPlayers[socketID].nickname);
    }
  }
  io.sockets.emit('lobby-names', lobbyPlayerNicknames.sort());
}

function broadcastMessage(message){
  // Forwards a message to everyone. Message should already be timestamped.
  io.sockets.emit('message', message);
  lobbyLast5Messages.push(message);
  if (lobbyLast5Messages.length === 6) {
    lobbyLast5Messages.shift();
  }
}

function broadcastGames(thisSocketOnly){
  /* Recreates lobbyGames object with player names in place of socket IDs.
  Plan is to send this object--uniquely tailored for each client--to each
  player, and have client-side logic interpret that into HTML buttons for
  players to push to join and leave games. */

  var unstartedGames = {
    minPlayers: MIN_PLAYERS_IN_GAME,
    maxPlayers: MAX_PLAYERS_IN_GAME
  };
  for (var gameIndex in lobbyGames) {
    if (!(lobbyGames[gameIndex].gameInProgress)) {
      // We won't bother to send data for games in progress.
      unstartedGames[gameIndex] = {};
      unstartedGames[gameIndex].hostName = lobbyPlayers[lobbyGames[gameIndex].hostID].nickname;
      unstartedGames[gameIndex].playerNames = [];
      for (var i = 0; i < lobbyGames[gameIndex].playerIDs.length; i++) {
        unstartedGames[gameIndex].playerNames.push(lobbyPlayers[lobbyGames[gameIndex].playerIDs[i]].nickname);
      }
      unstartedGames[gameIndex].playerNames.sort();
    }
  }
  if (thisSocketOnly) {
    /* Only have to send to one client. This really only happens on
    initializing client, so I don't need to test whether client is in a
    game, they aren't. */
    console.log(lobbyPlayers);
    unstartedGames.hostGameID = lobbyPlayers[thisSocketOnly].hostOfGame;
    unstartedGames.waitingToPlay = lobbyPlayers[thisSocketOnly].playerInGame;
    io.to(thisSocketOnly).emit('lobby-games', unstartedGames);
  } else {
    // Send a game object to each and every player.
    for (var socketID in lobbyPlayers) {
      if (!(lobbyPlayers[socketID].gameInProgress)) {
        unstartedGames.hostGameID = lobbyPlayers[socketID].hostOfGame;
        unstartedGames.waitingToPlay = lobbyPlayers[socketID].playerInGame;
        io.to(socketID).emit('lobby-games', unstartedGames);
      }
    }
  }
}

//                                    //
//-- End of chatroom functionality. --//
//                                    //
