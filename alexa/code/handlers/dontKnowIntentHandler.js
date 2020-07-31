const constants = require('../constants');
const common = require('../common');
const session = require('../helpers/session');

// Handle if user answers "I don't know"

const DontKnowIntentHandler = {
    canHandle(handlerInput) {
        const state = session.getAttributes(handlerInput, 'state');
        
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'dontKnow'
            && ( state === constants.STATES.GAME || state === constants.STATES.BONUS_QUESTION );
    },
    handle(handlerInput) {
        console.log('[DontKnowIntentHandler]');
        const sessionAttributes = session.getAttributes(handlerInput);

        // Create response
        const speechText = common.handleGuessResult(handlerInput, false);
        
        const upsellMessage = sessionAttributes.hasOwnProperty('upsellMessage') ? sessionAttributes.upsellMessage : undefined;
        // Reset upsellMessage attribute so that we don't keep surfacing upsell
        if (upsellMessage) {
            session.setAttributes(handlerInput, { "upsellMessage": undefined });
        }

        // state gets updated in handleGuessResult()
        const state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;
        // There's only one bonus question so we don't need to check if STATES.BONUS_QUESTION: 
        const aplType = state === constants.STATES.GAME ? 'answer-question' : 'answer-score';

        session.persist(handlerInput);

        return common.createResponse(handlerInput, speechText, aplType, upsellMessage);
    }
};

module.exports = DontKnowIntentHandler;