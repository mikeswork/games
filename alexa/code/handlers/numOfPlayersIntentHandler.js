const constants = require('../constants');
const session = require('../helpers/session');
const questions = require('../questions');
const common = require('../common');
const VO = require('../voiceOver/voiceOverService');

const NumOfPlayersIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = session.getAttributes(handlerInput);
        const state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;
        
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'numOfPlayers'
            && state === constants.STATES.PLAYER_COUNT_PROMPT;
    },
    handle(handlerInput) {
        console.log('[NumOfPlayersIntentHandler]');
        const slots = handlerInput.requestEnvelope.request.intent.slots;
        const players = slots['number'].value ? parseInt(slots['number'].value) : undefined;

        let speechText = '';
        let aplType = '';
        
        // Valid player count
        if (players > 0 && players <= 4) {
            session.setAttributes(handlerInput, { playerCount: players });
            speechText = questions.generateAndPlay(handlerInput, 'new-x-players');
            aplType = 'question';
        
        // Invalid number of players
        } else {
            speechText = VO.get('REPROMPT_HOW_MANY_ARE_PLAYING');
        }

        session.persist(handlerInput);

        return common.createResponse(handlerInput, speechText, aplType);
    }
};

module.exports = NumOfPlayersIntentHandler;