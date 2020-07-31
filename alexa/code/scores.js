const constants = require('./constants');
const session = require('./helpers/session');
const isp = require('./helpers/isp');
const VO = require('./voiceOver/voiceOverService');

exports.get = (handlerInput, isBrief = false) => {
    const sessionAttributes = session.getAttributes(handlerInput);
    const playerCount = sessionAttributes.hasOwnProperty('playerCount') ? sessionAttributes.playerCount : 1;
    
    let userRankId = sessionAttributes.hasOwnProperty('userRankId') ? sessionAttributes.userRankId : undefined;
    let currentRankName = sessionAttributes.hasOwnProperty('currentRankName') ? sessionAttributes.currentRankName : '';
    let currentRankImg = sessionAttributes.hasOwnProperty('currentRankImg') ? sessionAttributes.currentRankImg : '';
    let nextRankName = sessionAttributes.hasOwnProperty('nextRankName') ? sessionAttributes.nextRankName : '';
    let nextRankImg = sessionAttributes.hasOwnProperty('nextRankImg') ? sessionAttributes.nextRankImg : '';
    let speechText = '';
    let speechTextSuffix = VO.get('REPROMPT_START_NEW_GAME');
    let repromptText = VO.get('REPROMPT_START_NEW_GAME');
    let newState = constants.STATES.NEW_PROMPT;
    let upsellMessage;
    let winAnnouncement = '';

    let gamesFinished = sessionAttributes.hasOwnProperty('gamesFinished') ? sessionAttributes.gamesFinished : 0;
    gamesFinished++;
    
    // Single-player game score
    if (playerCount === 1) {
        const state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;
        const score = sessionAttributes.hasOwnProperty('score') ? sessionAttributes.score : 0;
        const totalScore = sessionAttributes.hasOwnProperty('totalScore') ? sessionAttributes.totalScore : 0;
        const totalQuestions = sessionAttributes.hasOwnProperty('totalQuestions') ? sessionAttributes.totalQuestions : undefined;

        let currentRankIndex;
        let currentRank;
        
        for (let j = 0; j < constants.RANKS.length; j++) {
            currentRankIndex = j;
            currentRank = constants.RANKS[j];
            
            if (currentRank.ID === userRankId) {
                break;
            }
        }

        // Used in APL:
        currentRankName = currentRank.NAME;
        currentRankImg = currentRank.IMG;

        if (isBrief) {
            switch (totalQuestions) {
                case constants.SP_QUESTIONS:
                    speechText += `You completed the game with a score of ${score} out of ${totalQuestions}. `;
                    break;

                case 1:
                    speechText += `You answered a bonus question and got ${score === 1 ? score + ' point' : score + ' points'}. `;
                    break;
            }

            speechText += `Your level is ${currentRank.NAME} <audio src='${currentRank.SOUND}'/> `;
        } else {
            let newRank;
            let nextRankIndex;
            // Is user is not already at highest rank
            if (currentRankIndex > 0) {
                // Since ranks go from highest to lowest in array, we "increment" the index my decrementing it:
                nextRankIndex = currentRankIndex - 1;
                
                // Used in APL:
                nextRankName = constants.RANKS[nextRankIndex].NAME;
                nextRankImg = constants.RANKS[nextRankIndex].IMG;

                // Level user up if they have enough points
                if (totalScore >= constants.RANKS[nextRankIndex].MINIMUM) {
                    newRank = constants.RANKS[nextRankIndex];
                    userRankId = newRank.ID;
                }
            }
            
            if (newRank) {
                // Used in APL:
                currentRankName = newRank.NAME;
                currentRankImg = newRank.IMG;
                nextRankIndex--;
                if (nextRankIndex >= 0) {
                    nextRankName = constants.RANKS[nextRankIndex].NAME;
                    nextRankImg = constants.RANKS[nextRankIndex].IMG;
                } else {
                    nextRankName = nextRankImg = '';
                }

                speechText += `Your total score is ${totalScore}, which raises you to the next level: ${newRank.NAME}`;

                if (isp.isPremiumExperience(handlerInput)) {
                    speechText += ", and unlocks a bonus question! ";
                    speechText += VO.get('BONUS_QUESTION_W_POINTS_SHORT_DESCRIPTION', '.');

                    // "... and earn": is now baked into description mp3
                    // const voID = ['ONE_POINT',
                    //               'TWO_POINTS',
                    //               'THREE_POINTS',
                    //               'FOUR_POINTS',
                    //               'FIVE_POINTS',
                    //               'SIX_POINTS',
                    //               'SEVEN_POINTS',
                    //               'EIGHT_POINTS',
                    //               'NINE_POINTS',
                    //               'TEN_POINTS'][constants.BONUS_POINTS-1];
                    // speechText += VO.get(voID, '.');

                    speechTextSuffix = VO.get('REPROMPT_ANSWER_BONUS');
                    repromptText = VO.get('REPROMPT_ANSWER_BONUS');
                    newState = constants.STATES.BONUS_PROMPT;
                } else {
                    // If we aren't announcing the bonus question, we have more slots for playing animal sounds:
                    speechText += `<audio src='${newRank.SOUND}'/>`;
                }
            } else {
                // High score speech/text
                if (score > ((totalQuestions * constants.NORMAL_POINTS) / 2)) {
                    // There's only one bonus question at a time, so points were already announced if user got it right
                    if (state !== constants.STATES.BONUS_QUESTION)  {
                        speechText += `You got a total of ${score === 1 ? score + ' point' : score + ' points'}! `;
                    }

                    // Give overall score since high score
                    speechText += `Your total score is ${totalScore}. Your level is ${currentRank.NAME} <audio src='${currentRank.SOUND}'/> `;
                }

                // Tell user how close they are to the next rank
                const nextRank = constants.RANKS[nextRankIndex];
                if (nextRank) {
                    const pointsToGo = nextRank.MINIMUM - totalScore;
                    speechText += `You're ${pointsToGo === 1 ? pointsToGo + ' point' : pointsToGo + ' points'} away from the next level, ${nextRank.NAME}. `;
                }
            }

            // Upsell logic:
            if (isp.upsellConditionsMet(handlerInput)) {
                if (gamesFinished % 3 === 0 || gamesFinished === 10) {
                    speechTextSuffix = '';  // Don't ask if user wants to play new game or bonus question

                    const product = session.getAttributes(handlerInput, 'availableProduct');
                    // Alexa voice:
                    upsellMessage = 
                        `With ${product.name}, you can have even more fun with ${product.summary}. Want to learn more?`;
                }
            }
            
        }

    // Multi-player game scores
    } else {
        let playerScores = sessionAttributes.hasOwnProperty('playerScores') ? sessionAttributes.playerScores : [];

        // Find the index of the first high score
        let highScoreIndex = 0;
        const winningScore = playerScores.reduce((accumulator, current, index) => {
            speechText += `Player ${index+1} got ${current === 1 ? current + ' point' : current + ' points'}. `;

            if (current > accumulator) {
                highScoreIndex = index;
                return current;
            } else {
                return accumulator;
            }
        }, 0);

        const indexesOfWinners = [];
        for (let i = 0; i < playerScores.length; i++) {
            if (playerScores[i] === winningScore) {
                indexesOfWinners.push(i);
            }
        }

        // There is more than one highest score (and winner unless all are 0's)
        if (indexesOfWinners.length > 1) {
            // Only announce winners if the tied scores are > 0
            if (winningScore > 0) {
                winAnnouncement += 'Players ';
                indexesOfWinners.forEach((winIndex, arrayIndex) => {
                    winAnnouncement += `${winIndex+1} ${(arrayIndex === (indexesOfWinners.length - 2)) ? 'and ' : ''}`;
                });
                winAnnouncement += 'tied for the win! ';
            }

        // There is only one high score and winner
        } else {
            winAnnouncement += `Player ${highScoreIndex+1} is the winner! `;
        }
        speechText += winAnnouncement;
    }

    speechText += speechTextSuffix;
    
    session.setAttributes(handlerInput, {
        "state": newState,
        "userRankId": userRankId,
        "currentRankName": currentRankName,
        "currentRankImg": currentRankImg,
        "nextRankName": nextRankName,
        "nextRankImg": nextRankImg,
        "repromptText": repromptText,
        "upsellMessage": upsellMessage,
        "gamesFinished": gamesFinished,
        "winAnnouncement": winAnnouncement
    });

    return speechText;
};