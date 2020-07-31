const constants = require('../constants');
const common = require('../common');
const session = require('../helpers/session');
const isp = require('../helpers/isp');
const questions = require('../questions');
const VO = require('../voiceOver/voiceOverService');

const MagicIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'magic'
            && isp.isPremiumExperience(handlerInput);
    },
    handle(handlerInput) {
        console.log('[MagicIntentHandler]');
        const sessionAttributes = session.getAttributes(handlerInput);
        let state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;
        const magicUsed = sessionAttributes.hasOwnProperty('magicUsed') ? sessionAttributes.magicUsed : undefined;

        let speechText = '';
        let aplType = '';  // Most scenarios just repeat question, so no aplType

        if (state === constants.STATES.GAME) {
            const playerCount = sessionAttributes.hasOwnProperty('playerCount') ? sessionAttributes.playerCount : 1;

            if (playerCount === 1) {
                if (!magicUsed) {
                    const correctAnswers = sessionAttributes.hasOwnProperty('correctAnswers') ? sessionAttributes.correctAnswers : [];
                    speechText += common.handleGuessResult(handlerInput, true, 'magic-answer');
                    session.setAttributes(handlerInput, { "magicUsed": true });

                    // state gets updated in handleGuessResult()
                    state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;
                    aplType = state === constants.STATES.GAME ? 'answer-question' : 'answer-score';
                } else {
                    speechText += questions.getPrevAndResume(handlerInput, 'used-magic');
                }
            } else {
                speechText += questions.getPrevAndResume(handlerInput, 'magic-unavailable');
            }
        } else if (state === constants.STATES.BONUS_QUESTION) {
            speechText += `${VO.get('MAGIC_NOT_ON_BONUS')} ${questions.bonusGetPrev(handlerInput)}`;
        } else {
            speechText += `${VO.get('MAGIC_ONLY_IN_GAME')} ${session.getAttributes(handlerInput, 'repromptText')}`;
        }

        session.persist(handlerInput);

        return common.createResponse(handlerInput, speechText, aplType);
    }
};

module.exports = MagicIntentHandler;