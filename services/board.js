var instance;
var jsonHandler = require('../api/jsonHandler.js');
var io = require('../services/socketService.js')().io;
var stringify = require('json-stringify-safe');
const MAX_SCORE = 4;

module.exports = function () {
    if (!instance) {
        instance = {
            Phases: Object.freeze(
                {
                    "startGame": 0,
                    "submission": 1,
                    "judgement": 2,
                    "updateScore": 3,
                    "four": 4,
                    "endGame": 5
                }
            ),
            phase: 0,
            players: {},
            display: {
                "blackCard": null, //This should be a black card object
                "submissions": [],
                "currentJudge": '', // The player ID of the person who is the judge
                "players": []
            },

            getDisplay: function () {
                return this.display;
            },

            joinPlayer: function (player, playerId) {
                this.players[playerId] = player;
                this.display.players.push(player.data);
                this.updateCurrentDisplay();
            },

            instanceNumber: Math.random(),

            getPlayerName: function (socketId) {
                return this.players[socketId].data.playerName;
            },

            removePlayer: function (playerId) {
                this.players[playerId].socket.disconnect(true);
                delete this.players[playerId];
                console.log(Object.keys(this.players).length + ' is left in the game');
                this.updatePlayersInDisplay();
                this.updateCurrentDisplay();
            },

            startGame: function () {
                var display = this.display;
                var self = this;
                jsonHandler.createBlackCard(function(card){
                    display.blackCard = card;
                    self.updatePlayersInDisplay();
                    self.updateCurrentDisplay();
                });
                this.players[Object.keys(this.players)[0]].data.isJudge = true;
                this.display.currentJudge = this.players[Object.keys(this.players)[0]].data.playerId;
                //console.log(Object.keys(this.players)[0] + ' is the first judge'); // Should be io.emit
                this.phase = this.Phases.submission;
                console.log('startGame :');
                //console.log(this.display);
            },

            submission: function (whiteCard) {
                if (this.phase !== this.Phases.submission) {
                    console.log(this.phase);
                    return false;
                }
                //console.log('attempting to find id ' + whiteCard.owner + ' of \n' + this.players[whiteCard.owner]);
                var playerLocation = this.players[whiteCard.owner].data.hand.findIndex(function (element) {
                    return (whiteCard.cardId === element.cardId)
                });
                //console.log(playerLocation);
                // NOTE!!!! Splice splices out an array, even if its size 0
                this.display.submissions.push(this.players[whiteCard.owner].data.hand.splice(playerLocation, 1)[0]);
                this.updatePlayersInDisplay();
                this.updateCurrentDisplay();
                //console.log(this.display.submissions.length);
                //console.log(Object.keys(this.players).length - 1);
                if (this.display.submissions.length >= Object.keys(this.players).length - 1) {
                    this.phase = this.Phases.judgement;
                    // console.log('this.display.submissions.length >= Object.keys(this.players).length - 1');
                }
                return true; //error handling maybe? Can't hurt
            },

            judgement: function (whiteCard) {
                if (this.phase !== this.Phases.judgement) {
                    return false;
                }
                this.phase = this.Phases.updateScore;
                this.updateScore(whiteCard.owner);
                return true;
            },

            updateScore: function (playerId) {
                if (this.phase !== this.Phases.updateScore) {
                    return false;
                }
                this.players[playerId].data.score += 1;
                this.updatePlayersInDisplay();
                this.updateCurrentDisplay();

                if (this.players[playerId].score > MAX_SCORE) { // This variable dictates how long the games go oops.
                    this.endGame(playerId);
                } else {
                    this.phase = this.Phases.four;
                    this.phase4();
                }
                return true;
            },

            phase4: function () {
                if (this.phase !== this.Phases.four) {
                    return false;
                }

                // Adds a new black card to current display
                var display = this.display;
                var self = this;
                jsonHandler.createBlackCard(function(card){
                    display.blackCard = card;
                    self.updatePlayersInDisplay();
                    self.updateCurrentDisplay();
                });

                // Adds a new white card to each hand
                this.display.submissions = [];
                var key;
                var keys = Object.keys(this.players);
                //console.log(keys);
                for (key in keys) {
                    //console.log(key);
                    if (key !== this.display.currentJudge) {
                        console.log(key);
                        jsonHandler.createWhiteCard(key, function(card){
                            self.players[keys].data.hand.push();
                        });
                    }
                }
                key = null;

                // Sets current judge to not judge. Might not need in the future.
                this.players[this.display.currentJudge].data.isJudge = false;
                //console.log(Object.keys(this.players));

                // Selects next judge
                this.display.currentJudge = Object.keys(this.players)[Math.round((Object.keys(this.players).length - 1) * Math.random())];
                //console.log(this.display.currentJudge + ' is judge');
                this.players[this.display.currentJudge].data.isJudge = true;

                // Start next round. This will be rearranged
                this.updatePlayersInDisplay();
                this.updateCurrentDisplay();
                this.phase = this.Phases.submission;
                console.log('here I am ' + this.phase);
                return true;
            },

            updatePlayersInDisplay: function () {
                this.display.players = [];
                for (var i = 0; i < Object.keys(this.players).length; i++) {
                    this.display.players.push(this.players[Object.keys(this.players)[i]].data);
                    //console.log(this.players[Object.keys(this.players)[i]].data);
                }
            },

            updateCurrentDisplay: function () {
                io.emit('updateDisplay', this.getDisplay());
            }, //Decided to implement this as a function in the end cuz prior approach would only update display at user join time.

            findPlayerInDisplay: function (playerId) {
                return this.display.players.findIndex(function (value) {
                        return (value.playerId === playerId);
                    }
                )
            },

            endGame: function (winnerID) {
                console.log(this.players[winnerID].name + ' won!')
                this.reset();
            },

            reset: function () {
                this.phase = 0;
                this.players = {};
                this.display = {
                    "blackCard": null, //This should be a black card object
                    "submissions": [],
                    "currentJudge": '', // The player ID of the person who is the judge
                    "players": []
                };
                this.updateCurrentDisplay();
            }
        };
    }
    return instance;
};
