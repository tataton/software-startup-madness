var socket = io();

$(document).on('click', '#sign-in', function(){
  var nameData = {};
  nameData.firstName = $('#first-name').val();
  nameData.lastInitial = $('#last-initial').val();
  if ((nameData.firstName.length > 0) && (nameData.lastInitial.length > 0)) {
    socket.emit('name', nameData);
    $('#sign-in-warning').text('');
    $("body").pagecontainer('change', '#lobbypage');
  } else {
    $('#sign-in-warning').text('Please enter text into both fields.');
  }
});

socket.on('lobby-names', lobbyNicknames, function(){
  var lobbyListText = '';
  for (var i = 0; i < lobbyNicknames.length; i++) {
    lobbyListText += '<li class="ui-li ui-li-static">' + lobbyNicknames[i] + '</li>';
    $('#lobby-list').html(lobbyListText);
  }
});
