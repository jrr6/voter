/*
The MIT License (MIT)

Copyright (c) 2013-2015 Peter Grassberger <petertheone@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

module.exports = {
  createZeroFilledArray: function (length) {
    if (length < 0) {
      return []
    }
    return Array.apply(null, new Array(length)).map(Number.prototype.valueOf, 0)
  },

  readBallots: function (ballotsText) {
    let ballots = ballotsText.split('\n')
    for (let i = 0; i < ballots.length; i++) {
      ballots[i] = ballots[i].replace(/\s+/g, '').split(',')
      for (let j = 0; j < ballots[i].length; j++) {
        ballots[i][j] = ballots[i][j] === '' ? 0 : parseInt(ballots[i][j])
      }
    }
    return ballots
  },

  validateBallots: function (ballots) {
    if (ballots.length < 1 || (ballots.length === 1 && ballots[0][0] === 0)) {
      result.append('You didn\'t enter any ballots!<br />')
      return false
    }

    for (let i = 0; i < ballots.length; i++) {
      if (ballots[i].length < 1 || (ballots[i].length === 1 && ballots[i][0] === 0)) {
        result.append('Ballot # ' + (i + 1) + ' is empty<br />')
        return false
      }
    }

    return true
  },

  validateInput: function (candidates, ballots, incompleteBallots) {
    if (!this.validateCandidates(candidates)) {
      return false
    }
    if (!this.validateBallots(ballots)) {
      return false
    }

    let lowestAllowedRank = incompleteBallots ? 0 : 1
    for (let i = 0; i < ballots.length; i++) {
      if (ballots[i].length !== candidates.length) {
        result.append('Ballot #' + (i + 1) + ' doesn\'t have the same ' +
        'length as there are canidates.<br />')
        return false
      }
      let numbers = this.createZeroFilledArray(candidates.length + 1)
      for (let j = 0; j < ballots[i].length; j++) {
        if (ballots[i][j] < lowestAllowedRank || ballots[i][j] > candidates.length) {
          result.append('Ballot #' + (i + 1) + ' Number #' + (j + 1) +
          ' isn\'t a number between ' + lowestAllowedRank +
          ' and the number of canidates.<br />')
          return false
        }
        numbers[ballots[i][j]]++
      }
      if (incompleteBallots) {
        let lastCount = 1
        for (let k = 1; k < numbers.length; k++) {
          if (numbers[k] > 1) {
            result.append('Ballot #' + (i + 1) + ' one or more numbers are used more than once (zeros not counted).<br />')
            return false
          }
          if (lastCount == 0 && numbers[k] === 1) {
            result.append('In Ballot #' + (i + 1) + ' one or more numbers are left out.<br />')
            return false
          }
          lastCount = numbers[k]
        }
      } else {
        for (let l = 1; l < numbers.length; l++) {
          if (numbers[l] !== 1) {
            result.append('Ballot #' + (i + 1) + ' doesn\'t have exactly one of every number.<br />')
            return false
          }
        }
      }
    }

    return true
  },

  removeEmptyBallots: function (ballots) {
    let ballotsToRemove = []
    for (let i = 0; i < ballots.length; i++) {
      let ballotEmptyOrInvalid = true
      for (let j = 0; j < ballots[i].length; j++) {
        if (ballots[i][j] > 0) {
          ballotEmptyOrInvalid = false
        }
      }
      if (ballotEmptyOrInvalid) {
        ballotsToRemove.push(i)
      }
    }
    for (i = 0; i < ballotsToRemove.length; i++) {
      ballots.splice(ballotsToRemove[i] - i, 1)
    }
    return ballots
  },

  countFirstVotes: function (candidatesCount, ballots) {
    return this.countNVotes(1, candidatesCount, ballots)
  },

  countNVotes: function (n, candidatesCount, ballots) {
    let firstVotesCount = this.createZeroFilledArray(candidatesCount)
    for (let i = 0; i < ballots.length; i++) {
      for (let j = 0; j < ballots[i].length; j++) {
        if (ballots[i][j] === n) {
          firstVotesCount[j]++
        }
      }
    }
    return firstVotesCount
  },

  calculateRoundWinners: function (firstVotes) {
    let maxVotes = -1
    let roundWinners = []
    for (let i = 0; i < firstVotes.length; i++) {
      if (firstVotes[i] > maxVotes) {
        maxVotes = firstVotes[i]
        roundWinners = []
        roundWinners.push(i)
      } else if (firstVotes[i] == maxVotes) {
        roundWinners.push(i)
      }
    }
    return roundWinners
  },

  calculateRoundLosers: function (firstVotes, ballotsCount) {
    let minVotes = ballotsCount + 1
    let roundLosers = []
    for (let i = 0; i < firstVotes.length; i++) {
      if (firstVotes[i] < minVotes) {
        minVotes = firstVotes[i]
        roundLosers = []
        roundLosers.push(i)
      } else if (firstVotes[i] == minVotes) {
        roundLosers.push(i)
      }
    }
    return roundLosers
  },

  calculateRoundLosersOfCandidates: function (candidates, firstVotes, ballotsCount) {
    let minVotes = ballotsCount + 1
    let roundLosers = []
    for (let i = 0; i < candidates.length; i++) {
      let candidate = candidates[i]
      if (firstVotes[candidate] < minVotes) {
        minVotes = firstVotes[candidate]
        roundLosers = []
        roundLosers.push(candidate)
      } else if (firstVotes[candidate] == minVotes) {
        roundLosers.push(candidate)
      }
    }
    return roundLosers
  },

  removeLoserCandidate: function (candidateNames, roundLoser) {
    candidateNames.splice(roundLoser, 1)
    return candidateNames
  },

  removeLoserFromBallots: function (ballots, roundLoser) {
    for (let i = 0; i < ballots.length; i++) {
      let loserRank = ballots[i][roundLoser]
      if (loserRank > 0) {
        for (let j = 0; j < ballots[i].length; j++) {
          if (ballots[i][j] > loserRank) {
            ballots[i][j]--
          }
        }
      }
      ballots[i].splice(roundLoser, 1)
    }
    return this.removeEmptyBallots(ballots)
  },

  candidateIndexToName: function (candidateNames, candidatesIndices) {
    for (let i = 0; i < candidatesIndices.length; i++) {
      candidatesIndices[i] = candidateNames[candidatesIndices[i]]
    }
    return candidatesIndices
  },

  calculateWinner: function (candidateNames, ballots, tiebreakerSecondary) {
    let round = 0

    ballots = this.removeEmptyBallots(ballots)

    do {
      result.append('Round #' + (round + 1) + ':<br />')

      result.append('<br />' + candidateNames.length + ' candidates and ' +
      ballots.length + ' ballots.<br />')

      let firstVotes = this.countFirstVotes(candidateNames.length, ballots)

      let roundWinners = this.calculateRoundWinners(firstVotes)
      let roundLosers = this.calculateRoundLosers(firstVotes, ballots.length)

      let ratioOfWinnerVotes = firstVotes[roundWinners[0]] / ballots.length
      let ratioOfLoserVotes = firstVotes[roundLosers[0]] / ballots.length

      result.append('<br />Number of first votes per candidate:<br />')
      for (let i = 0; i < candidateNames.length; i++) {
        result.append(candidateNames[i] + ': ' + firstVotes[i] + '<br />')
      }

      if (roundWinners.length === 1) {
        result.append('<br />' + candidateNames[roundWinners[0]] + ' has the highest number of votes with ' +
        firstVotes[roundWinners[0]] + ' votes (' + (100 * ratioOfWinnerVotes).toFixed(2) +
        '%)<br />')
      } else {
        result.append('<br />' + roundWinners.length + ' candidates have the highest number of votes with ' +
        firstVotes[roundWinners[0]] + ' votes (' + (100 * ratioOfWinnerVotes).toFixed(2) +
        '%)<br />')
      }
      if (roundLosers.length === 1) {
        result.append(candidateNames[roundLosers[0]] + ' has the lowest number of votes with ' +
        firstVotes[roundLosers[0]] + ' votes (' + (100 * ratioOfLoserVotes).toFixed(2) +
        '%)<br />')
      } else {
        result.append(roundLosers.length + ' candidates have the lowest number of votes with ' +
        firstVotes[roundLosers[0]] + ' votes (' + (100 * ratioOfLoserVotes).toFixed(2) +
        '%)<br />')
      }

      let roundWinner = roundWinners[0]
      let roundLoser = roundLosers[0]

      if (ratioOfWinnerVotes > 0.5) {
        result.append('<br />' + candidateNames[roundWinner] + ' won!<br />')
        return this.candidateIndexToName(candidateNames, roundWinners)
      }

      if (candidateNames.length == 2) {
        result.append('<br />There are two candidates left and no one has over 50% of the votes.<br />')
        return this.candidateIndexToName(candidateNames, roundWinners)
      }

      if (roundLosers.length > 1 && tiebreakerSecondary) {
        result.append('<br />')
        let n = 2
        while (roundLosers.length > 1 && n <= candidateNames.length) {
          let nVotes = this.countNVotes(n, candidateNames.length, ballots)
          roundLosers = this.calculateRoundLosersOfCandidates(roundLosers, nVotes, ballots.length)
          result.append('Tiebreaker: Use ' + n + '. votes: ' + roundLosers.length + ' losers left.<br />')

          n++
        }
        if (roundLosers.length === 1) {
          roundLoser = roundLosers[0]
          result.append('<br />Tiebreaker: ' + candidateNames[roundLoser] + ' was selected as the loser of the round.<br />')
        }
      }

      if (roundLosers.length > 1) {
        let randomIndex = Math.round(Math.random() * (roundLosers.length - 1))
        roundLoser = roundLosers[randomIndex]
        result.append('<br />Tiebreaker: ' + candidateNames[roundLoser] + ' was randomly selected as the loser of the round.<br />')
      }

      candidateNames = this.removeLoserCandidate(candidateNames, roundLoser)
      ballots = this.removeLoserFromBallots(ballots, roundLoser)

      result.append('<br />')

      round++
    } while (true)
  }
}
