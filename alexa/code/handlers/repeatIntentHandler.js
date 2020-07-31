const constants = require('../constants');
const session = require('../helpers/session');
const questions = require('../questions');
const common = require('../common');

const RepeatIntentHandler = {
    canHandle(handlerInput) {
        const state = session.getAttributes(handlerInput, 'state');
        
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
               handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent' &&
              (state === constants.STATES.GAME || state === constants.STATES.BONUS_QUESTION);
    },
    handle(handlerInput) {
        console.log('[RepeatIntentHandler]');
        const state = session.getAttributes(handlerInput, 'state');
        let speechText;

        if (state === constants.STATES.GAME) {
            speechText = questions.getPrevAndResume(handlerInput, 'repeat');
        } else {
            speechText = questions.bonusGetPrev(handlerInput);
        }

        session.persist(handlerInput);

        return common.createResponse(handlerInput, speechText);
    }
};

module.exports = RepeatIntentHandler;