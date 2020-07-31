const constants = require('../constants');
const common = require('../common');
const session = require('../helpers/session');

const CharacterGuessIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = session.getAttributes(handlerInput);
        const state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;
        
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && ( handlerInput.requestEnvelope.request.intent.name === 'characterGuess'
              || handlerInput.requestEnvelope.request.intent.name === 'movieGuess'
              || handlerInput.requestEnvelope.request.intent.name === 'MCGuess'
              || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NextIntent' )
            && state === constants.STATES.BONUS_QUESTION;
    },
    handle(handlerInput) {
        console.log('[CharacterGuessIntentHandler]');
        const sessionAttributes = session.getAttributes(handlerInput);
        const correctAnswers = sessionAttributes.hasOwnProperty('correctAnswers') ? sessionAttributes.correctAnswers : [];

        const intent = handlerInput.requestEnvelope.request.intent;
        let guess = '';  // blank string is used in case of AMAZON.NextIntent

        if (intent.name === 'MCGuess') {
            const movieSlot = intent.slots['movieName'] || {};
            const charSlot = intent.slots['characterName'] || {};
            guess = charSlot.value || movieSlot.value || '';
        } else if (intent.name === 'characterGuess') {
            guess = intent.slots.hasOwnProperty('characterName') ? intent.slots['characterName'].value : '';
        } else if (intent.name === 'movieGuess') {
            guess = intent.slots.hasOwnProperty('movieName') ? intent.slots['movieName'].value : '';
        }
        
        // Look through array of acceptable character name variations and determine if there is a match
        const gotMatch = correctAnswers.some((possibleAnswer) => {
            console.log(`Checking guess; does ${guess.toLowerCase()} === ${possibleAnswer.toLowerCase()}`);
            return guess.toLowerCase() === possibleAnswer.toLowerCase();
        })

        // Create response
        const speechText = common.handleGuessResult(handlerInput, gotMatch);

        session.persist(handlerInput);

        return common.createResponse(handlerInput, speechText, 'answer-score');
    }
};

module.exports = CharacterGuessIntentHandler;