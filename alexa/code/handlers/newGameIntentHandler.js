const constants = require('../constants');
const session = require('../helpers/session');
const VO = require('../voiceOver/voiceOverService');
const common = require('../common');

// Handle if user wants to restart/start a new game

const NewGameIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = session.getAttributes(handlerInput);
        const state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;
        
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'newGame' 
             || handlerInput.requestEnvelope.request.intent.name === 'changePlayers')
            && state === constants.STATES.GAME;
    },
    handle(handlerInput) {
        console.log('[NewGameIntentHandler]');

        const speechText = VO.get('REPROMPT_START_NEW_GAME');
        const repromptText = VO.get('REPROMPT_START_NEW_GAME');
        
        session.setAttributes(handlerInput, { 
            "state": constants.STATES.RESTART_PROMPT,
            "repromptText": repromptText
        });

        session.persist(handlerInput);

        return common.createResponse(handlerInput, speechText, 'prompt');
    }
};

module.exports = NewGameIntentHandler;