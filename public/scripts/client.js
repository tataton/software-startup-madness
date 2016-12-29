var socket = io();

$(document).on('click', '#sign-in', function(){
  var nameData = {};
  nameData.firstName = $('#first-name').val();
  nameData.lastInitial = $('#last-initial').val();
  if ((nameData.firstName.length > 0) && (nameData.lastInitial.length > 0)) {
    socket.emit('name', nameData);
    $('#sign-in-warning').text('');
    $("body").pagecontainer('change', '#lobbypage', {changeHash: false});
  } else {
    $('#sign-in-warning').text('Please enter text into both fields.');
  }
});

$(document).on('keydown', '.no-enter', function(keyPressed){
  // Suppresses "Enter" in name inputs.
  if(keyPressed.keyCode == 13) {
    return false;
  }
});

$(document).off('pageshow').on('pageshow', '#lobbypage', function(){
  /* On loading Game Lobby page, hides buttons that are only needed when
  there are active games. */
  $('#start-game').hide();
  $('#wait-for-host').hide();
  $('#not-enough-players').hide();
});

$(document).on('click', '#host-new-game', function(){
  // Sets up a new game on the server, hosted by this client.
  socket.emit('new-game');
});

$(document).on('click', '#send-message', function(){
  deliverMessage();
});

$(document).on('keydown', '#message', function(keyPressed){
  // Forces "Enter" to send message from chat message input.
  if(keyPressed.keyCode == 13) {
    deliverMessage();
    return false;
  }
});

var deliverMessage = function(){
  // Get the message from the input box, and send it to the server.
  var messageText = $('#message').val();
  socket.emit('message', messageText);
  // And then empty the input box.
  $('#message').val('');
};

socket.on('lobby-names', function(lobbyNicknames){
  // Updates list of players available in the lobby.
  var lobbyListText = '';
  for (var i = 0; i < lobbyNicknames.length; i++) {
    lobbyListText += '<li class="ui-li">' + lobbyNicknames[i] + '</li>';
    $('#lobby-list').html(lobbyListText);
  }
});

socket.on('message', function(message){
  $('#message-list').append('<p class="chat-line">' + message + '</p>');
  // Scrolls message list to the bottom with each message.
  $('#message-list').scrollTop(function(){
    return this.scrollHeight;
  });
});

socket.on('lobby-games', function(lobbyGameData){
  /* Updates buttons in game selection area. Structure of lobbyGameData:
  {
    hostGameID: false/gameIDNumber,       // Tells you which game you're the host of, if any.
    waitingToPlay: false/gameIDNumber,    // Tells you which game you're a member of, if any.
    minPlayers: MIN_PLAYERS_IN_GAME,
    maxPlayers: MAX_PLAYERS_IN_GAME,
    gameIDNumberOfAGame:        {
                                  hostName: nicknameOfHost,
                                  playerNames: [playerNickname, playerNickname, ...]
                                },
    gameIDNumberOfAnotherGame:  {...},
    ...
  }
  */
  if (lobbyGameData.hostGameID) {
    /* You're the host of a game! You get buttons for starting your game, if the
    game has enough players in it, and for leaving the game. (If there aren't
    enough players, the "start game" button is deactivated.) All of the other
    game buttons are inactive (because you can't join any of those games, you
    are already in one.) */

  } else if (lobbyGameData.waitingToPlay) {
    /* You've already joined a game, and you are waiting for the host to start
    it. But you still have the option of leaving your game by pressing the
    button. None of the other game buttons are active. */

  } else {
    /* You haven't joined a game yet. All the game buttons should be active,
    but you don't have any options other than joining a game.
    */

  }
});
