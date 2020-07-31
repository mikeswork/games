// Handle if user tries to guess movie but not during gameplay
const common = require('../common');
const session = require('../helpers/session');
const VO = require('../voiceOver/voiceOverService');

const MovieGuessIntentHandlerBackup = {
    canHandle(handlerInput) {
      if (handlerInput.requestEnvelope.request.type === 'IntentRequest') {
        if (handlerInput.requestEnvelope.request.intent.name === 'MCGuess') {
          const movieSlot = handlerInput.requestEnvelope.request.intent.slots['movieName'] || {};
          return movieSlot.hasOwnProperty('value');
        } else {
          return handlerInput.requestEnvelope.request.intent.name === 'movieGuess';
        }
      } else {
        return false;
      }
    },
    handle(handlerInput) {
        console.log('[MovieGuessIntentHandlerBackup]');

        const repromptText = session.getAttributes(handlerInput, 'repromptText');
        const speechText = `${VO.get('GUESS_MOVIE_ONLY_DURING_GAME')}${repromptText}`;

        return common.createResponse(handlerInput, speechText);
    }
};

module.exports = MovieGuessIntentHandlerBackup;