const constants = require('../constants');
const session = require('../helpers/session');
const common = require('../common');

const MovieGuessIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = session.getAttributes(handlerInput);
        const state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;
        
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && ( handlerInput.requestEnvelope.request.intent.name === 'movieGuess' 
              || handlerInput.requestEnvelope.request.intent.name === 'characterGuess'
              || handlerInput.requestEnvelope.request.intent.name === 'MCGuess'
              || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NextIntent')
            && state === constants.STATES.GAME;
    },
    handle(handlerInput) {
        console.log('[MovieGuessIntentHandler]');
        const sessionAttributes = session.getAttributes(handlerInput);
        const correctAnswers = sessionAttributes.hasOwnProperty('correctAnswers') ? sessionAttributes.correctAnswers : [];
        
        const intent = handlerInput.requestEnvelope.request.intent;
        let guess = '';  // blank string is used in case of AMAZON.NextIntent

        if (intent.name === 'MCGuess') {
            const movieSlot = intent.slots['movieName'] || {};
            const charSlot = intent.slots['characterName'] || {};
            guess = movieSlot.value || charSlot.value || '';
        } else if (intent.name === 'movieGuess') {
            guess = intent.slots.hasOwnProperty('movieName') ? intent.slots['movieName'].value : '';
        } else if (intent.name === 'characterGuess') {
            guess = intent.slots.hasOwnProperty('characterName') ? intent.slots['characterName'].value : '';
        }

        // Look through array of acceptable movie title variations and determine if there is a match
        const gotMatch = correctAnswers.some((possibleAnswer) => {
            console.log(`Checking guess, does ${guess.toLowerCase()} === ${possibleAnswer.toLowerCase()}`);
            return guess.toLowerCase() === possibleAnswer.toLowerCase();
        })
        
        // Create response
        const speechText = common.handleGuessResult(handlerInput, gotMatch);

        // state gets updated in handleGuessResult()
        const state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;
        const aplType = state === constants.STATES.GAME ? 'answer-question' : 'answer-score';
        
        const upsellMessage = session.getAttributes(handlerInput, 'upsellMessage');
        // Reset upsellMessage attribute so that we don't keep surfacing upsell
        if (upsellMessage) {
            session.setAttributes(handlerInput, { "upsellMessage": undefined });
        }

        session.persist(handlerInput);

        return common.createResponse(handlerInput, speechText, aplType, upsellMessage);
    }
};

module.exports = MovieGuessIntentHandler;