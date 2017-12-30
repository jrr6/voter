(function (exports) {
  /**
   * Class representing a candidate.
   * @typedef {Object} Candidate
   * @property {String} name The name of the candidate.
   * @property {Number} id The candidate's unique identifying number.
   * */
  exports.Candidate = class Candidate {
    /**
     * Creates a new candidate.
     * @param {String} name The name of the candidate.
     * @param {Number} id The candidate's unique identifying number.
     */
    constructor (name, id) {
      this.name = name
      this.id = id
    }
  }
  /**
   * Class representing an election.
   * @typedef {Object} Election
   * @property {Number} code The election's unique identifying code.
   * @property {Candidate[]} candidates The candidates running in the election
   * @property {Number[][]} ballots The ballots submitted by voters in the election—
   *  arrays containing the candidates' IDs in order of most to least favorable to the voter
   * @property {Number[]} voters A list of voter ID numbers to track who has voted and insure against duplicate votes.
   */
  exports.Election = class Election {
    /**
     * Creates an election.
     * @param {Number} code The election's unique identifying code.
     * @param {Candidate[]} candidates The candidates running in the election
     * @param {Object[]} creatorInfo an array whose first element is the fingeprint of the creator, and whose second element is the creator's public key (for verification purposes)
     * @param {Number[][]} ballots The ballots submitted by voters in the election—
     *  arrays containing the candidates' IDs in order of most to least favorable to the voter
     * @param {String[]} voters A list of voter ID numbers to track who has voted and insure against duplicate votes.
     * @param {Function} printFunc the function to call to print live AV output (must accept a String)
     */
    constructor (code, candidates, creatorInfo, ballots, voters, printFunc) {
      this.code = code
      this.candidates = candidates
      this.ballots = ballots
      this.voters = voters
      this.creatorFingerprint = creatorInfo[0]
      this.creatorPubKey = creatorInfo[1]
      this.printFunc = printFunc
    }

    /**
     * Checks whether a given voter has already voted.
     * @param {String} id A voter's hexadecimal fingerprint.
     * @returns {Boolean} True if the voter has already voted, false if they have not.
     */
    hasVoted (id) {
      return this.voters.indexOf(id) > -1
    }

    /**
     * Adds a voter's fingerprint to the voter ID list and shuffles it to ensure anonymity.
     * @param {String} id A voter's hexadecimal fingerprint.
     */
    addVoterID (id) {
      this.voters.push(id)
      exports.shuffleArray(this.voters)
    }
  }

  exports.shuffleArray = function (array) {
    let i = 0
    let j = 0
    let temp = null
    for (i = array.length - 1; i > 0; i -= 1) {
      j = Math.floor(Math.random() * (i + 1))
      temp = array[i]
      array[i] = array[j]
      array[j] = temp
    }
  }

  /**
   * Returns the winner of an election as per the alternative/instant-runoff vote algorithm.
   * @param {Election} election the election the winner of which to find
   * @returns {Candidate} the candidate who wins the election
   */
  exports.alternativeVote = function (election) {
    let printFunc = election.printFunc
    printFunc('---BEGINNING ELECTION---')
    let candidates = JSON.parse(JSON.stringify(election.candidates))
    let ballots = JSON.parse(JSON.stringify(election.ballots))

    const droopQuota = Math.floor(ballots.length / 2) + 1
    printFunc('Droop quota set at ' + droopQuota)
    /**
     * Gets the Candidate object with the specified ID
     * @param {Number} id the ID of the candidate to find
     * @returns {Candidate} the Candidate with the appropriate ID
     */
    function findCandidateWithId (id) {
      return candidates.find(cand => cand.id === id)
    }

    let totals = {}
    for (let cand of candidates) {
      totals[cand.id] = []
    }
    printFunc('Cand IDs in election:' + Object.keys(totals).map(e => ` ${findCandidateWithId(parseInt(e)).name} (${e})`))

    /**
     * (Re)distributes votes in the totals object.
     * @param {Number[]} votes an array of voting ballots
     * @param {Number} candIdToDelete pass this to delete a candidate. If this is passed, candidates will be checked for existence during redistribution. Otherwise, it is assumed that this is an initial distribution and checks will not be performed.
     */
    function redistributeVotes (votes, candIdToDelete) {
      const candIdToDeleteExists = candIdToDelete !== null && candIdToDelete !== undefined
      for (let ballot of votes) {
        if (ballot[0] !== undefined) {
          let electee = ballot.shift()
          // as stated in the function JSDoc, if we're deleting it means we're mid-election and we need to verify that the next place person exists
          // if there is no candIdToDelete, we assume this is an initial "total filling" and don't waste time with verification
          if (candIdToDeleteExists) {
            // Keep going through the ballot until it's exhausted or we find a candidate who's still in the election
            while (totals[electee] === undefined) {
              electee = ballot.shift()
              if (electee === undefined) {
                // we've exhausted the ballot—it contains no one who's still in the election, so it's thrown away
                continue
              }
            }
          }
          totals[electee].push(ballot)
        }
      }
      if (candIdToDeleteExists) {
        delete totals[candIdToDelete]
      }
    }

    // initial vote distribution—nobody gets deleted
    redistributeVotes(ballots)

    // check for majority and find biggest loser
    while (Object.keys(totals).length > 1) {
      printFunc('Current distributon: ' + Object.keys(totals).reduce((a, b) => a + `${b}: ${totals[b].map(e => '[' + e + ']')}; `, ''))
      let candIds = Object.keys(totals)
      let minVotes
      let lowestCands = []
      for (let candId of candIds) {
        candId = parseInt(candId)
        let curTotal = totals[candId].length
        printFunc('Cand ID ' + candId + ' has ' + curTotal + ' votes')
        // If they have a majority, they win
        if (curTotal >= droopQuota) {
          printFunc('WINNER: Cand ID ' + candId + ' has a majority with ' + curTotal + ' votes')
          return findCandidateWithId(candId)
        }

        if (curTotal < minVotes || minVotes === undefined) {
          // If they're lower than the min, or min hasn't yet been set, they're the new min
          minVotes = curTotal
          lowestCands = [candId]
        } else if (curTotal === minVotes) {
          // If they're equal to the min, we might have a tie for last—keep track of all potential losers
          lowestCands.push(candId)
        }
      }
      if (lowestCands.length > 1) {
        // Randomly eliminate in event of a tie
        printFunc('Will randomly break loser tie among: ' + lowestCands)
        exports.shuffleArray(lowestCands)
      }
      printFunc('Biggest loser for this round is ' + lowestCands[0])
      printFunc('***Redistributing***')
      redistributeVotes(totals[lowestCands[0]], lowestCands[0])
    }
    // if only one candidate remains, they win automatically
    printFunc('WINNER: Cand ' + Object.keys(totals)[0] + ' is only remaining, wins by default')
    return findCandidateWithId(parseInt(Object.keys(totals)[0]))
  }
})(typeof exports === 'undefined' ? this['AV'] = {} : exports)
