// Common contains basic functions needed in multiple handlers, etc.

const constants = require('./constants');
const session = require('./helpers/session');
const util = require('./helpers/util');
const questions = require('./questions');
const scores = require('./scores');
const VO = require('./voiceOver/voiceOverService');
const aplTemplate = require('./apl/aplTemplate');

const ANSWER_HISTORY_MINIMUM = 3;
const ANSWER_HISTORY_LENGTH = 5;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 3;
const MAX_ACCURACY_FOR_LEVEL = 0.9;
const MIN_ACCURACY_FOR_DIFF_LEVEL = 0.6;

// The handleGuessResult block is needed in several handlers.
// It runs the questions or scores module, depending on if the current game is over or not. 
exports.handleGuessResult = (handlerInput, gotMatch, questionTypeOverride) => {
    const sessionAttributes = session.getAttributes(handlerInput);
    const playerCount = sessionAttributes.hasOwnProperty('playerCount') ? sessionAttributes.playerCount : 1;
    const state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;
    
    console.log('[handleGuessResult]', JSON.stringify({gotMatch, sessionAttributes}));

    // Update score(s)
    if (gotMatch) {
        if (playerCount === 1) {
            let score = sessionAttributes.hasOwnProperty('score') ? sessionAttributes.score : 0;
            let totalScore = sessionAttributes.hasOwnProperty('totalScore') ? sessionAttributes.totalScore : 0;

            const points = (state === constants.STATES.BONUS_QUESTION) ? constants.BONUS_POINTS : constants.NORMAL_POINTS;

            // Increase score for one-player game
            score += points;
            totalScore += points;

            session.setAttributes(handlerInput, { "score": score, "totalScore": totalScore });
        } else {
            const currentRound = sessionAttributes.hasOwnProperty('roundCounter') ? sessionAttributes.roundCounter : 1;
            const currentPlayer = util.roundToPlayer(currentRound, playerCount);
            let playerScores = sessionAttributes.hasOwnProperty('playerScores') ? sessionAttributes.playerScores : [];

            // Increase score for current player in multi-player game
            playerScores[currentPlayer - 1]++;
            session.setAttributes(handlerInput, { "playerScores": playerScores });
        }
    }

    // Retrieve our current difficulty, previous answer history, and available movies
    let { currentDifficulty = 2, answerHistory = [], availableMovies = [] } = sessionAttributes;
    answerHistory.unshift(gotMatch);
    answerHistory = answerHistory.slice(0, ANSWER_HISTORY_LENGTH);
	const numQuestions = answerHistory.length;
    // Wait until we've seen enough questions to evaluate the users accuracy
	if (numQuestions >= ANSWER_HISTORY_MINIMUM) {
        // Calculate answer accuracy
        const questionsCorrect = answerHistory.filter(wasCorrect => wasCorrect).length;
        const accuracy = questionsCorrect / numQuestions;

        // Adjust difficulty; reset answer history and available movies based on accuracy
		if (accuracy < MIN_ACCURACY_FOR_DIFF_LEVEL) {
            currentDifficulty = Math.max(currentDifficulty - 1, MIN_DIFFICULTY);
            answerHistory = [];
            availableMovies = [];
		} else if (accuracy > MAX_ACCURACY_FOR_LEVEL) {
            currentDifficulty = Math.min(currentDifficulty + 1, MAX_DIFFICULTY);
            answerHistory = []
            availableMovies = [];
		}
		
		console.log('[Determined difficulty]', JSON.stringify({ questionsCorrect, numQuestions, accuracy, currentDifficulty, answerHistory }));
	}
	session.setAttributes(handlerInput, { answerHistory, currentDifficulty, availableMovies, gotMatch });
    
    // Determine if game is over or if we need a new question
    let roundCounter = sessionAttributes.hasOwnProperty('roundCounter') ? sessionAttributes.roundCounter : 1;
    const totalQuestions = sessionAttributes.hasOwnProperty('totalQuestions') ? sessionAttributes.totalQuestions : undefined;
    let speechText = "";

    if (roundCounter >= totalQuestions) {
        // End of game, show score
        const correctAnswers = sessionAttributes.hasOwnProperty('correctAnswers') ? sessionAttributes.correctAnswers : [];

        if (state === constants.STATES.BONUS_QUESTION) {
            if (gotMatch) {
                // Determine which message to use based on how much bonus points are worth
                const voID = ['GOT_A_POINT',
                              'GOT_TWO_POINTS',
                              'GOT_THREE_POINTS',
                              'GOT_FOUR_POINTS',
                              'GOT_FIVE_POINTS',
                              'GOT_SIX_POINTS',
                              'GOT_SEVEN_POINTS',
                              'GOT_EIGHT_POINTS',
                              'GOT_NINE_POINTS',
                              'GOT_TEN_POINTS'][constants.BONUS_POINTS-1];
                console.log("voID:", voID);
                console.log('constants.BONUS_POINTS-1', constants.BONUS_POINTS-1);

                speechText += `${VO.get(voID)}${VO.get('SO_AWESOME')}`;
            } else {
                speechText += VO.getRightCharacter(correctAnswers[0]);
            }
        } else {
            // If magic was used, tell user the right answer and that they got a point
            if (questionTypeOverride === 'magic-answer') {
                speechText += `${VO.getRightMovie(correctAnswers[0])} ${VO.get('GOT_A_POINT_GOOD_JOB')}`;

            // If standard answer, give proper feedback based on if user answered correctly
            } else {
                if (gotMatch) {
                    speechText += VO.get('GOT_A_POINT_GOOD_JOB');
                } else {
                    speechText += VO.getRightMovie(correctAnswers[0]);

                    session.setAttributes(handlerInput, { "previousCorrectAnswer": correctAnswers[0] });  // For APL
                }
            }
        }
        
        speechText += `${VO.get('MUSIC_END_OF_GAME')} ${scores.get(handlerInput)}`;
    } else {
        // Create next question
        speechText += `${questions.generateAndPlay(
            handlerInput, 
            questionTypeOverride || ((gotMatch) ? 'right-answer' : 'wrong-answer')
        )}`;
    }
    
    return speechText;
};

exports.promptPlayerCount = (handlerInput) => {
    session.setAttributes(handlerInput, { 
        "state": constants.STATES.PLAYER_COUNT_PROMPT,
        "repromptText": VO.get('REPROMPT_HOW_MANY_ARE_PLAYING')
    });
    
    return VO.get('HOW_MANY_ARE_PLAYING');
};

exports.createResponse = (handlerInput, speechText, templateType, upsellMessage, shouldEnd) => {
    console.log("templateType in common.js:", templateType)
    // Construct and return response
    let response = handlerInput.responseBuilder;
    const isAplSupported = handlerInput.requestEnvelope.context.System.device.supportedInterfaces.hasOwnProperty(
        "Alexa.Presentation.APL"
    );

    let speechString = speechText;

    if (isAplSupported && templateType) {
        response = response.addDirective(aplTemplate(handlerInput, templateType, speechText));

        let aplCommands = [];

        // Add SpeakItems if there are multiple pages in APL template
        if (templateType.indexOf('-') != -1) {
            aplCommands = [
                {
                    "type": "Sequential",
                    "delay": 0,
                    "commands": [
                        {
                            "type": 'SpeakItem',
                            "componentId": 'text1'
                        },
                        {
                            "type": 'SpeakItem',
                            "componentId": 'text2'
                        },
                        {
                            "type": 'SpeakItem',
                            "componentId": 'text3'
                        },
                        {
                            "type": 'SpeakItem',
                            "componentId": 'text4'
                        },
                        {
                            "type": 'SpeakItem',
                            "componentId": 'text5'
                        },
                        {
                            "type": 'SpeakItem',
                            "componentId": 'text6'
                        }
                    ]
                }
            ];

            // Cancel speechString (i.e. speechText) since the APL will be handling it via SpeakItem commands
            speechString = '';

        } else {
            aplCommands = [
                {
                    "type": "AutoPage",
                    "componentId": "aplPager",
                    "duration": 0,
                    "delay": 0
                }
            ]
        }

        response = response.addDirective({
            "type" : "Alexa.Presentation.APL.ExecuteCommands",
            "token": "hwp-kids-apl",
            "commands": aplCommands
        });

    }

    if (upsellMessage) {
        const product = session.getAttributes(handlerInput, 'availableProduct');

        response = response.addDirective({
            type: "Connections.SendRequest",
            name: "Upsell",
            payload: {
                InSkillProduct: {
                    productId: product.productId
                },
                // Alexa voice:
                "upsellMessage": upsellMessage
            },
            token: "hwp-kids-isp"
        });
    }

    const repromptText = session.getAttributes(handlerInput, 'repromptText');
    const shouldEndSession = (upsellMessage || shouldEnd) ? true : false;

    const finalResponse = response
        .speak(speechString)
        .reprompt(repromptText)
        .withShouldEndSession(shouldEndSession)
        .getResponse();

    console.log("Trying to send this Response:", JSON.stringify(finalResponse));
    console.log("... with speechText:", speechText);

    return finalResponse;
};