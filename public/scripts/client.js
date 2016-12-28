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
  $('#start-game').hide();
  $('#wait-for-host').hide();
});

$(document).on('click', '#send-message', function(){
  deliverMessage();
});

$(document).on('keydown', '#message', function(keyPressed){
  // Forces "Enter" to send message from message input.
  if(keyPressed.keyCode == 13) {
    deliverMessage();
    return false;
  }
});

var deliverMessage = function(){
  var messageText = $('#message').val();
  socket.emit('message', messageText);
  $('#message').val('');
};

socket.on('lobby-names', function(lobbyNicknames){
  var lobbyListText = '';
  for (var i = 0; i < lobbyNicknames.length; i++) {
    lobbyListText += '<li class="ui-li">' + lobbyNicknames[i] + '</li>';
    $('#lobby-list').html(lobbyListText);
  }
});

socket.on('message', function(message){
  $('#message-list').append('<p class="chat-line">' + message + '</p>');
  $('#message-list').scrollTop(function(){
    return this.scrollHeight;
  });
});
