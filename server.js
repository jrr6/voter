'use strict'

// Modules

const http = require('http')
const path = require('path')
const socketio = require('socket.io')
const express = require('express')
const forge = require('node-forge')
const AV = require('./client/js/alternativeVote.js')

// Module implementations

const router = express()
const server = http.createServer(router)
const io = socketio.listen(server)

// Set up basic listening for server

router.use(express.static(path.resolve(__dirname, 'client')))

// Election storage

/** @type {Election[]} */
let activeElections = []

// Socket stuff

/**
 * Checks if an election with the specified code exists.
 * @param {Number} code The code to check
 */
function findCode (code) {
  return activeElections.findIndex(e => e.code === code)
}

io.on('connection', function (socket) {
  // MARK: Creator
  socket.on('create-election', function (data) {
    let code
    let codeIsUnique = false
    while (!codeIsUnique) {
      code = Math.floor(Math.random() * 900000) + 100000
      if (findCode(code) === -1) {
        codeIsUnique = true
      }
    }
    socket.join(code)
    socket.electionCode = code
    const pubKey = forge.pki.publicKeyFromPem(data.publicKey)
    let election = new AV.Election(code, data.candidates, [data.fingerprint, pubKey], [], [], function (str) {
      console.log('[AV] ' + str)
      if (data.logging) {
        socket.emit('av-output', str)
      }
    })
    activeElections.push(election)
    socket.emit('assign-code', code)
    console.log('[CREATOR] creating election ' + code)
    socket.on('disconnect', function () {
      console.log('[CREATOR] deleting election ' + code)
      activeElections.splice(findCode(code), 1)
    })
  })

  socket.on('close-election', function (signature) {
    let election = activeElections[findCode(socket.electionCode)]
    let actual = election.creatorFingerprint
    let pub = election.creatorPubKey
    let md = forge.md.sha256.create()
    md.update(actual, 'utf8')
    try {
      if (pub.verify(md.digest().bytes(), signature)) {
        findWinner(election) // make sure the election results have been finalized before election is closed
        console.log('[CREATOR] closing election ' + socket.electionCode)
        socket.emit('close-accepted')
        socket.disconnect() // disconnect() will delete the election for us
      } else {
        console.log('[CREATOR] refusing to close election ' + socket.electionCode)
      }
    } catch (err) {
      console.log('[CREATOR] invalid crypto string, refusing to close election ' + socket.electionCode)
    }
  })

  // MARK: Voter
  socket.on('check-code', function (data) {
    console.log('[VOTER] checking code ' + data.code)
    let loc = findCode(data.code)
    if (loc !== -1) {
      let electionToJoin = activeElections[loc]
      if (electionToJoin.hasVoted(data.fingerprint)) {
        socket.emit('voter-rejected')
        socket.disconnect()
        console.log('[VOTER] voter ' + data.fingerprint + ' rejected from joining election ' + data.code)
        return
      }
      socket.join(data.code)
      socket.electionCode = data.code
      socket.emit('confirm-code', {'valid': true, 'candidates': activeElections[loc].candidates})
      console.log('[VOTER] confirmed code ' + data.code)
    } else {
      socket.emit('confirm-code', {'valid': false})
      console.log('[VOTER] rejected code ' + data.code)
    }
  })

  socket.on('vote-cast', function (data) {
    let actElection = activeElections[findCode(socket.electionCode)]
    if (actElection.hasVoted(data.fingerprint)) {
      socket.emit('voter-rejected')
      socket.disconnect()
      console.log('[VOTER] voter ' + data.fingerprint + ' rejected from voting in election ' + socket.electionCode)
      return
    }
    actElection.addVoterID(data.fingerprint)
    actElection.ballots.push(data.ballot)
    console.log('[VOTER] cast vote ' + data.ballot)
    if (!actElection.countPending) {
      actElection.countPending = true
      console.log('[AV] scheduling count for ' + actElection.code)
      setTimeout(findWinner, 1000, actElection)
    }
  })
})

function findWinner (election) {
  console.log('[AV] Counting ' + election.code)
  const winner = AV.alternativeVote(election)
  console.log('[AV] Winner ' + winner.name + ' found in election ' + election.code)
  io.to(election.code).emit('winner-update', winner)
  election.countPending = false
}

server.listen(8080, function () {
  let addr = server.address()
  console.log('[SERVER] Listening at', addr.address + ':' + addr.port)
})
