define([
    'underscore',
    'js/models/gameBase',
    'moment',
    'js/comcastMoneyBadger',
    'js/hwpTvApi',
    'js/alerts',
    'js/environment',
    'js/imgLoader'
], function(
    _,
    Base,
    Moment,
    MoneyBadger,
    HwpTvApi,
    Alerts,
    Environment,
    ImageLoader
) {
    'use strict';
    var CN = '[AdventControl]';

    return Base.extend({

        type: 'advent',

        boxUTCOffset: undefined,

        dataUrl: "",

        adventItems: [],

        defaults: Object.assign({}, _.result(Base.prototype, 'defaults'), {
            startOnCurrentDate: true,
        }),

        initialize: function(options) {
            // console.log(CN, "[initialize]", options);

            this.dataUrl = options.contentUrl;

            if(Environment.isSetTopBox()) {
                MoneyBadger.getUserInfo()
                    .then(
                        function(response) {
                            this.boxUTCOffset = response.timezone;
                            this.loadNodes();
                        }.bind(this),
                        function(error) {
                            Alerts.show('info', "Failed to get MoneyBadger user info: " + error);
                            this.loadNodes();
                        }.bind(this)
                );
            } else {
                this.loadNodes();
            }
        },

        loadNodes: function() {
            this.adventItems = [];
            
            $.getJSON(this.dataUrl).done((response) => {
                var nodes = response.nodes;
                this.set(response);
                
                // Read data from each node and determine if they are locked or not. 
                // Push their data and lock status into adventItems array.
                var currentMoment = Moment()
                _.each(nodes, (node) => {
                    var isLocked = true
                    var unlockMoment = currentMoment.clone()  // This will unlock item unless it's changed inside the following if:

                    // If unlock date/time are given, calculate if node is locked or unlocked
                    if (node.customerUnlockTime) {
                        // If unlock date/time are being forced into UTC zone, creating unlockMoment is straightforward
                        if (node.unlockTimeIsUTC) {
                            unlockMoment = Moment(node.customerUnlockTime + "+00:00", ["MM-DD-YY HH:mm ZZ", "MM-DD-YY ZZ", "HH:mm ZZ", "YYYY-MM-DD ZZ"])

                        // Create unlockMoment with correct time, date, and zone
                        } else {
                            // If we are running on the box, it thinks we're in UTC zone so we need to offset unlockMoment to local zone
                            if (this.boxUTCOffset) {
                                unlockMoment = Moment(node.customerUnlockTime + " " + this.boxUTCOffset, ["MM-DD-YY HH:mm ZZ", "MM-DD-YY ZZ", "HH:mm ZZ", "YYYY-MM-DD ZZ"])

                                // If no date is given in customerUnlockTime (only time), the unlockMoment we create 
                                // may fall on a different date than desired. This can happen if the local date  
                                // (which gets used when unlockMoment is created) and UTC date (which the box is on)
                                // are different. We compare the dates of offsetMoment and currentMoment to test for this. 
                                var offsetMoment = currentMoment.clone()
                                offsetMoment.utcOffset(this.boxUTCOffset)
                                if (node.customerUnlockTime.indexOf("-") == -1) {
                                    if (offsetMoment.date() < currentMoment.date()) {
                                        unlockMoment.subtract(1, 'day')
                                    } else if (offsetMoment.date() > currentMoment.date()) {
                                        unlockMoment.add(1, 'day')
                                    }
                                }

                            // On PC, zone is always what's local, so we don't need to specify it
                            } else {
                                unlockMoment = Moment(node.customerUnlockTime, ["MM-DD-YY HH:mm", "MM-DD-YY", "HH:mm", "YYYY-MM-DD"])
                            }
                        }
                    }
                    
                    if (unlockMoment.isBefore(currentMoment)) {
                        isLocked = false
                    }

                    node.isLocked = isLocked;

                    this.adventItems.push(node);
                })

                // Disabling for Game Of Thrones since we don't care to track advent progress in this arcade
                // and fetchGameProgress is causing the serverles API to intermittently return error 400 "invalid user"
                this.fetchGameProgress().always(() => {
                    this.initialized = true;
                    this.trigger('initialized');
                })

            });
        },

        getScore: function() {
            // console.log(CN, '[getScore]');

            return this.adventItems.reduce((score, item) => {
                if(item.selectedOptionId) {
                    score += item.selectedOptionId;
                }
                return score;
            }, 0);
        },

        getDisplayScore: function() {
            return this.getScore().toLocaleString();
        },

        /**
         * Returns a array of all URLs determined to be media content from
         * the game data.
         */
        getMediaUrls: function() {
            const IS_MEDIA = /\/(img|vid)\/.*\.\w+$/;
            const urlMap = this.get('nodes').reduce((urlMap, node) => {
                Object.values(node).forEach(value => {
                  if (IS_MEDIA.test(value)) {
                    urlMap[value] = true;
                  }
                });
                return urlMap;
            }, {});

            return Object.keys(urlMap);
        },

        /**
         * Returns a promise that will resolve when all media URLs from the game
         * content have been succesfully loaded into the browser
         */
        preload: function() {
            return ImageLoader.loadImages(this.getMediaUrls());
        },

        completeNode: function(nodeId, score) {
            // console.log(CN, "[completeNode]", { nodeId, score });

            // let node = this.adventItems[nodeId];
            const node = this.adventItems.find(item => item.id == nodeId);
            if(node && !node.isCompleted) {
                // Only update if this node has not been completed
                node.selectedOptionId = score;
                node.isCompleted = true;

                // Record node score for later
                const gameId = this.get('gameId');
                if(gameId) {
                    HwpTvApi.submitGameUserAnswer(gameId, nodeId, score, this.type);

                    // Record latest Advent game score
                    const newGameScore = this.getScore();
                    HwpTvApi.addGameScore(gameId, newGameScore, this.type);
                }

            } else {
                console.warn("[Cannot mark node as complete]", { node });
            }
        },

        syncAnswers: function(storedAnswers) {
            // console.log(CN, "[syncAnswers]", { storedAnswers });

            // Update items that have some kind of answer data to indicate they are completed
            storedAnswers.map(({questionId, answer: selectedOptionId}) => {
                let item = this.adventItems.find(item => {
                    return item.id == questionId;
                });
                if(item) {
                    Object.assign(item, { selectedOptionId, isCompleted: true });
                }
            })
        },

        // Return the index for the first unlocked & not-completed item, the last unlocked item, or -1
        getValidNodeId: function() {
            // console.log(CN, '[getValidNodeId]');
            
            let firstVirginId = undefined;
            let lastUnlockedId = undefined;
            const startOnCurrentDate = this.get('startOnCurrentDate');

            this.adventItems.forEach(({id, isLocked, isCompleted = false}) => {
                if (!isLocked) {
                    lastUnlockedId = id;
                    if (!startOnCurrentDate && !isCompleted && !firstVirginId) {
                        firstVirginId = id;
                    } 
                }
            });

            return !!firstVirginId ? firstVirginId : lastUnlockedId;
        }

    });
});