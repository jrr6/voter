/* global io $ Fingerprint2 alert AV forge */

$('#back').click(function () {
  $('#back').fadeOut()
  $.when($('.container:not("#home")').fadeOut()).done(function () {
    $('#home').fadeIn()
  })
})

$('#help-button').click(function () {
  $('#home').fadeOut(function () {
    $('#help').fadeIn()
    $('#back').fadeIn()
  })
})

let fingerprint, candidates, keypair

// MARK: Sockets
const socket = io()
socket.on('connect', function () {
  new Fingerprint2().get(function (result) {
    fingerprint = result
  })
})
socket.on('assign-code', function (code) {
  $('#election-code-disp').text(code)
})
socket.on('confirm-code', function (data) {
  if (data.valid) {
    $('#back').fadeOut()
    AV.shuffleArray(data.candidates)
    data.candidates.forEach(function (candidate) {
      let tr = $('<tr class="ballot-row"></tr>')
      $(tr).attr('candidate-id', candidate.id)
      const checkbox = $('<td><input type="checkbox" checked class="ucheckbox"></td>')
      const rank = $('<td class="ballot-rank">ERR</td>')
      let nameTd = $('<td>')
      $(nameTd).text(candidate.name)
      $(tr).append(checkbox, rank, nameTd)
      $('#ballot-table').append(tr)
    })
    recalculateBallotIndices()
    $('#voter-join').fadeOut(function () {
      $('#cast-vote').fadeIn()
    })
  }
})
socket.on('winner-update', function (winner) {
  if (winner.name !== $('#winning-candidate-name').text()) {
    $('#winning-candidate-name').text(winner.name)
    $('#winning-candidate-explanation').text('is winning.')
  }
})
socket.on('voter-rejected', function () {
  $.when($('*:not(#reject-label, body, html)').fadeOut()).done(function () {
    $('#reject-label').fadeIn()
  })
})
socket.on('av-output', function (str) {
  // safely escape string, just in case
  let node = document.createTextNode(str + '\n')
  $('#av-log').append(node)
  $('#av-log').scrollTop($('#av-log').prop('scrollHeight'))
})

// MARK: Participating in election
$('#im-voter').click(function () {
  $('#home').fadeOut(function () {
    $('#voter-join').fadeIn()
    $('#back').fadeIn()
  })
})
$('#code-input').on('input', function () {
  const codeInput = $('#code-input').val()
  let parsedCode = parseInt(codeInput)
  if (codeInput.length === 6 && !isNaN(parsedCode)) {
    socket.emit('check-code', {
      'code': parsedCode,
      'fingerprint': fingerprint
    })
  }
})
$('#ballot-table').sortable({
  containerSelector: 'table',
  itemPath: '> tbody',
  itemSelector: 'tr.draggable',
  placeholder: '<tr class="placeholder"/>',
  onDrop: function (el) {
    $(el).removeClass('dragged')
    $('body').removeClass('dragging')
    recalculateBallotIndices()
  }
})
$('#ballot-table tbody').on('click', '.ucheckbox', function (e) {
  recalculateBallotIndices()
})

function recalculateBallotIndices () {
  $('#ballot-table tbody').children('tr').each(function (e) {
    if ($(this).find('.ucheckbox').is(':checked')) {
      $(this).children('td.ballot-rank').text($(this).closest('tr').prevAll().length + 1)
      $(this).addClass('draggable')
    } else {
      $(this).children('td.ballot-rank').text('N/A')
      $(this).parent().append($(this))
      $(this).removeClass('draggable')
    }
  })
}
$('#cast-vote-button').click(function () {
  let voteArray = []
  let error = false
  $('#ballot-table tbody').children('tr').each(function (e) {
    if ($(this).hasClass('draggable')) {
      let parsedId = parseInt($(this).attr('candidate-id'))
      if (!isNaN(parsedId)) {
        voteArray.push(parsedId)
      } else {
        alert('An error occurred when trying to cast your ballot. Your vote was not recorded. ' +
        'The following error occurred:\n\nA non-integer candidate ID was found when parsing draggable candidates.')
        error = true
      }
    }
  })
  if (error) return
  socket.emit('vote-cast', {'ballot': voteArray, 'fingerprint': fingerprint})
  $('#cast-vote').fadeOut(function () {
    $('#vote-confirmation').fadeIn()
  })
})

// MARK: Creating election
$(document).ready(function () {
  // log interface
  const ua = navigator.userAgent
  if (ua.match(/Android/i) || ua.match(/iPhone/i) || ua.match(/iPod/i) || ua.match(/iPod/i) || ua.match(/WebOS/i) || ua.match(/Blackberry/i) || ua.match(/Windows Phone/i)) {
    $('#keyboard-info').hide()
  } else {
    if (ua.toLowerCase().match(/mac/i)) {
      $('#keyboard-shortcut').text('option-l')
    } else {
      $('#keyboard-shortcut').text('alt-l')
    }
  }
})
let candId = 1
$('#im-organizer').click(function () {
  $('#home').fadeOut(function () {
    $('#create-election').fadeIn()
    $('#back').fadeIn()
  })
})
$('#add-candidate').click(function () {
  const el = $('<div class="candidate-create row"><div class="eleven columns"><input class="u-full-width candidate-input" type="text" placeholder="Candidate McName" id="' + candId + '"></div><div class="one columns"><button class="delete-candidate">Remove</button></div></div>')
  $('#create-candidate-list').append(el)
  candId++
})
$('.add-candidates').on('click', '.delete-candidate', function (e) {
  $(this).closest('.candidate-create').remove()
})
$('#create-election-button').click(function () {
  // gather candidates
  let innerError = false
  candidates = []
  $('.candidate-input').each(function (e) {
    let parsedId = parseInt($(this).attr('id'))
    if (isNaN(parsedId)) {
      alert('An error occurred while trying to create the election. The election was not created. ' +
      'The following error occurred:\n\nA non-integer ID was found on one of the candidate elements.')
      innerError = true
      return
    }
    if ($(this).val().trim() === '') {
      alert('Candidate names may not be empty.')
      innerError = true
      return
    }
    candidates.push(new AV.Candidate($(this).val(), parsedId))
  })
  if (innerError) return
  if (candidates.length < 1) {
    alert('You must enter at least one candidate.')
    return
  }
  let shouldLog = $('#create-show-log').is(':checked')

  // prepare monitoring UI
  $('#candidates-container').empty()
  for (let i = 0; i < candidates.length; ++i) {
    if (i % 4 === 0) $('#candidates-container').append('<div class="row">')
    let col = $('<div class="three columns">')
    let p = $('<p>')
    p.text(candidates[i].name)
    $(col).append(p)
    $('#candidates-container div.row').last().append(col)
  }
  $('#winning-candidate-name').text('')
  $('#winning-candidate-explanation').text('Awaiting votes…')
  $('#back').fadeOut()
  $('#create-election').fadeOut()
  $('.spinner').show()
  if (!shouldLog) $('#log-row').hide()
  document.addEventListener('keydown', function (event) {
    if (event.keyCode == 76 && event.altKey) {
      event.preventDefault()
      $('#log-row').toggle('normal')
    }
  }, false)

  // send fingerprint and public key
  const pki = forge.pki
  const rsa = pki.rsa
  rsa.generateKeyPair({bits: 2048, workers: -1}, function (err, aKeypair) {
    if (err !== null) {
      alert('An error occurred generating an RSA keypair for server verification')
      return
    }
    keypair = aKeypair
    const pub = pki.publicKeyToPem(keypair.publicKey)
    const electionData = {
      'candidates': candidates,
      'fingerprint': fingerprint,
      'logging': shouldLog,
      'publicKey': pub
    }
    socket.emit('create-election', electionData)
    $('.spinner').hide(function () {
      $('#election-view').fadeIn()
    })
  })
})

$('#close-election-button').click(function () {
  $('#close-election-button').removeClass('button-primary')
  $('#close-election-button').addClass('no-hover')
  $('#close-election-button').attr('disabled', 'disabled')
  let md = forge.md.sha256.create()
  md.update(fingerprint, 'utf8')
  let signature = keypair.privateKey.sign(md)
  socket.emit('close-election', signature)
})
// Need to wait for confirmation, and also want to make sure proper winner is being displayed
socket.on('close-accepted', function () {
  $('#winning-candidate-explanation').text('has won.')
  $('#close-election-button').text('Election Closed')
})
