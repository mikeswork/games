const constants = require('../constants');
const common = require('../common');
const session = require('../helpers/session');
const questions = require('../questions');
const isp = require('../helpers/isp');
const VO = require('../voiceOver/voiceOverService');

const NoIntentHandler = {
    canHandle(handlerInput) {
        if (handlerInput.requestEnvelope.request.type === 'IntentRequest') {
            if (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NoIntent') {
                return true;
            } else {
                // Alex treats "no" as a movie name and fictional character so we need to handle these cases
                if (handlerInput.requestEnvelope.request.intent.name === 'MCGuess') {
                    const slots = handlerInput.requestEnvelope.request.intent.slots;
                    const movieSlot = slots['movieName'] || {};
                    const charSlot = slots['characterName'] || {};
                    const utterance = movieSlot.value || charSlot.value || '';

                    return utterance === 'no';
                } else {
                    return false;
                }
            }
        } else {
            return false;
        }
    },
    handle(handlerInput) {
        console.log('[NoIntentHandler]');
        let shouldEnd = false;
        const state = session.getAttributes(handlerInput, 'state');
        
        let speechText = '';
        let aplType = '';
        
        switch (state) {
            case constants.STATES.RESUME_PROMPT:
                if (isp.isPremiumExperience(handlerInput)) {
                    speechText = VO.get('OK_START_NEW_GAME');
                    speechText += common.promptPlayerCount(handlerInput);
                    aplType = 'prompt';
                } else {
                    speechText += questions.generateAndPlay(handlerInput, 'ok-new-game');
                    aplType = 'question';
                }
                break;
                
            case constants.STATES.NEW_PROMPT:
            case constants.STATES.NEW_FROM_ONESHOT_PROMPT:
            case constants.STATES.RETURN_PROMPT:
            case constants.STATES.BONUS_PROMPT:
                speechText = VO.get('MUSIC_EXIT_MESSAGE_HAVE_GOOD');
                shouldEnd = true;
                break;
                
            case constants.STATES.RESTART_PROMPT:
                speechText = questions.getPrevAndResume(handlerInput, 'lets-continue');
                aplType = 'question';
                break;
                
            case constants.STATES.GAME:
                speechText = session.getAttributes(handlerInput, 'repromptText');
                break;
                
            default:
                speechText = `${VO.get('I_DONT_UNDERSTAND')} ${session.getAttributes(handlerInput, 'repromptText')}`;
        }

        session.persist(handlerInput);

        return common.createResponse(handlerInput, speechText, aplType, null, shouldEnd);
    }
};

module.exports = NoIntentHandler;