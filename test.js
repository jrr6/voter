const AV = require('./client/js/alternativeVote.js')
const C = AV.Candidate
let creatorInfo = [0, 1]
let cands = [new C('c0', 0), new C('c1', 1), new C('c2', 2), new C('c3', 3)]
let ballots = [
  [0, 2, 1],
  [3, 1],
  [1, 2, 3],
  [1, 2, 0],
  [0, 1, 3, 2],
  [3, 1, 0, 2],
  [2, 1, 0],
  [0],
  [],
  [],
  [0, 1, 3, 2],
  [2, 1, 3, 0],
  [3, 1, 0]
]
function print (str) {
  console.log('[DEBUG] ' + str)
}
let election = new AV.Election(100001, cands, creatorInfo, ballots, [], print)
let winner = AV.alternativeVote(election)
console.log(winner)
