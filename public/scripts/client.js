var socket = io();
var myNickname;

$(document).on('click', '#sign-in', function(){
  var nameData = {};
  nameData.firstName = $('#first-name').val();
  nameData.lastInitial = $('#last-initial').val();
  if ((nameData.firstName.length > 0) && (nameData.lastInitial.length > 0)) {
    socket.emit('name', nameData);
    myNickname = nameData.firstName + ' ' + nameData.lastInitial;
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

$(document).on('click', '#host-new-game', function(){
  // Sets up a new game on the server, hosted by this client.
  socket.emit('new-game');
});

$(document).on('click', '.leave-hosted-game', function(){
  // Abandons this client's hosting role.
  var gameID = $(this).attr('name');
  socket.emit('abandon-host', gameID);
});

$(document).on('click', '.leave-member-game', function(){
  // Leaves a game that client is a member of.
  var gameID = $(this).attr('name');
  socket.emit('leave-game', gameID);
});

$(document).on('click', '.join-this-game', function(){
  // Joins a game that still has room.
  var gameID = $(this).attr('name');
  socket.emit('join-game', gameID);
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
  var localGameData = lobbyGameData;
  // Creates a local copy, so we can modify it.
  console.log('lobbyGameData from server, local copy: ', localGameData);

  var minPlayers = localGameData.minPlayers,
      maxPlayers = localGameData.maxPlayers;
  delete localGameData.minPlayers;
  delete localGameData.maxPlayers;
  /* I'm deleting object properties to get ready to cycle through gameIDs and
  create buttons. In order to use
      for (var gameID in localGameData)
  I need to get rid of all localGameData properties that aren't gameiDs. */

  $('#host-new-game').hide();
  $('#start-game').hide();
  $('#wait-for-host').hide();
  $('#not-enough-players').hide();

  var myGame, htmlToInsert;

  /* Some repetitive code coming up--next section deals with interpreting
  server data differently depending on whether client is host, or already
  in a game, or not yet. I'm expecting to twiddle this a lot, so I'm
  keeping it open and repetitive for now. */

  if (localGameData.hostGameID) {
    /* You're the host of a game! You get a button for starting your game, if the
    game has enough players in it, and for leaving the game. (If there aren't
    enough players, the "start game" button is deactivated.) All of the other
    game buttons are inactive (because you can't join any of those games, you
    are already in one.) */
    myGame = localGameData[localGameData.hostGameID];
    if (myGame.playerNames.length < (minPlayers - 1)) {
      /* If there aren't enough players to start the game, disable the start
      button. */
      $('#not-enough-players').show();
    } else {
      // Otherwise, host can start at any time.
      $('#start-game').show();
    }
    // Next, we need to show the host's game first.

    htmlToInsert = '';
    /* Button "name" attributes will be encoded with the gameID. That way,
    the button event listener can listen by class, and then $(this) to get
    the referenced gameID. */
    htmlToInsert += '<button class="ui-btn ui-btn-inline ui-btn-game leave-hosted-game" name="' + localGameData.hostGameID + '">Abandon<br/>hosting<span class="button-im-the-host"><br/>' + myGame.hostName + '</span><span class="button-names">';
    for (var i = 0; i < myGame.playerNames.length; i++) {
      htmlToInsert += '<br/>' + myGame.playerNames[i];
    }
    htmlToInsert += '</span></button>';
    // Then, delete properties to prepare to list all other games.
    delete localGameData.waitingToPlay;
    delete localGameData[localGameData.hostGameID];
    delete localGameData.hostGameID;
    /* Only things remaining in localGameData object are games yet to be shown
    as inactive buttons. */
    htmlToInsert += addInactiveGameButtons(localGameData);
    $('#lobby-button-insert').html(htmlToInsert);

  } else if (localGameData.waitingToPlay) {
    /* You've already joined a game, and you are waiting for the host to start
    it. But you still have the option of leaving your game by pressing the
    button. None of the other game buttons are active. */
    $('#wait-for-host').show();
    myGame = localGameData[localGameData.waitingToPlay];
    // Show the player's game first.
    htmlToInsert = '';
    htmlToInsert += '<button class="ui-btn ui-btn-inline ui-btn-game leave-member-game" name="' + localGameData.waitingToPlay + '">Leave your<br/>game with<span class="button-host-name"><br/>' + myGame.hostName + '</span><span class="button-im-a-player"><br/>' + myNickname + '</span><span class="button-names">';
    for (var j = 0; j < myGame.playerNames.length; j++) {
      if (myGame.playerNames[j] != myNickname){
        htmlToInsert += '<br/>' + myGame.playerNames[j];
      }
    }
    htmlToInsert += '</span></button>';
    delete localGameData.hostGameID;
    delete localGameData[localGameData.waitingToPlay];
    delete localGameData.waitingToPlay;
    htmlToInsert += addInactiveGameButtons(localGameData);
    $('#lobby-button-insert').html(htmlToInsert);

  } else {
    /* You haven't joined a game yet. All the game buttons corresponding to
    unfilled games should be active, and you have the option of joining any
    of these existing games or starting a new one. */
    $('#host-new-game').show();
    delete localGameData.hostGameID;
    delete localGameData.waitingToPlay;
    var joinableGameData = {}, fullGameData = {};
    for (var gameID in localGameData) {
      var thisGame = localGameData[gameID];
      if (thisGame.playerNames.length < (maxPlayers - 1)) {
        joinableGameData[gameID] = thisGame;
      } else {
        fullGameData[gameID] = thisGame;
      }
    }
    htmlToInsert = addAvailableGameButtons(joinableGameData) + addFullGameButtons(fullGameData);
    $('#lobby-button-insert').html(htmlToInsert);
  }
});

var addInactiveGameButtons = function(otherGameData){
  var htmlToInsert = '';
  for (var gameID in otherGameData) {
    var thisGame = otherGameData[gameID];
    htmlToInsert += '<button class="ui-btn ui-btn-inline ui-btn-game" disabled="true">Leave your game<br/>to join<span class="button-host-name"><br/>' + thisGame.hostName + '</span><span class="button-names">';
    for (var i = 0; i < thisGame.playerNames.length; i++) {
      htmlToInsert += '<br/>' + thisGame.playerNames[i];
    }
    htmlToInsert += '</span></button>';
  }
  return htmlToInsert;
};

var addAvailableGameButtons = function(availableGameData){
  var htmlToInsert = '';
  for (var gameID in availableGameData) {
    var thisGame = availableGameData[gameID];
    htmlToInsert += '<button class="ui-btn ui-btn-inline ui-btn-game join-this-game" name="' + gameID + '">Join a<br/>game with<span class="button-host-name"><br/>' + thisGame.hostName + '</span><span class="button-names">';
    for (var i = 0; i < thisGame.playerNames.length; i++) {
      htmlToInsert += '<br/>' + thisGame.playerNames[i];
    }
    htmlToInsert += '</span></button>';
  }
  return htmlToInsert;
};

var addFullGameButtons = function(fullGameData){
  var htmlToInsert = '';
  for (var gameID in fullGameData) {
    var thisGame = fullGameData[gameID];
    htmlToInsert += '<button class="ui-btn ui-btn-inline ui-btn-game" disabled="true">Game full:<span class="button-host-name"><br/>' + thisGame.hostName + '</span><span class="button-names">';
    for (var i = 0; i < thisGame.playerNames.length; i++) {
      htmlToInsert += '<br/>' + thisGame.playerNames[i];
    }
    htmlToInsert += '</span></button>';
  }
  return htmlToInsert;
};
