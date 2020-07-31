const constants = require('../constants');
const common = require('../common');
const session = require('../helpers/session');
const questions = require('../questions');
const util = require('../helpers/util');
const isp = require('../helpers/isp');
const VO = require('../voiceOver/voiceOverService');

const YesIntentHandler = {
    canHandle(handlerInput) {
        if (handlerInput.requestEnvelope.request.type === 'IntentRequest') {
            if (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.YesIntent') {
                return true;
            } else {
                // Alex treats "yes" as a movie name and fictional character so we need to handle these cases
                if (handlerInput.requestEnvelope.request.intent.name === 'MCGuess') {
                    const slots = handlerInput.requestEnvelope.request.intent.slots;
                    const movieSlot = slots['movieName'] || {};
                    const charSlot = slots['characterName'] || {};
                    const utterance = movieSlot.value || charSlot.value || '';

                    return utterance === 'yes';
                } else {
                    return false;
                }
            }
        } else {
            return false;
        }
    },
    async handle(handlerInput) {
        console.log('[YesIntentHandler] top');
        const state = session.getAttributes(handlerInput, 'state');
        
        let speechText = '';
        let aplType = '';
        
        switch (state) {
            case constants.STATES.RESUME_PROMPT:
            case constants.STATES.RETURN_PROMPT:
                speechText = questions.getPrevAndResume(handlerInput, 'pick-up');
                aplType = 'question';
                break;
                
            case constants.STATES.NEW_PROMPT:
            case constants.STATES.NEW_FROM_ONESHOT_PROMPT:
            case constants.STATES.RESTART_PROMPT:
                // Load product
                const productJustBought = await isp.loadProduct(handlerInput);
                
                if (isp.isPremiumExperience(handlerInput)) {
                    // Check if parent approved purchase since last game
                    if (productJustBought) {
                        speechText = util.getIspCongratsText(handlerInput);
                    }

                    speechText += common.promptPlayerCount(handlerInput);
                    aplType = 'prompt';
                } else {
                    speechText += questions.generateAndPlay(handlerInput, 'lets-new-game');
                    aplType = 'question';
                }
                break;
                
            case constants.STATES.GAME:
                speechText = session.getAttributes(handlerInput, 'repromptText');
                break;

            case constants.STATES.BONUS_PROMPT:
                speechText = questions.bonusGenerateAndPlay(handlerInput);
                aplType = 'bonus';
                break;
                
            default:
                speechText = `${VO.get('I_DONT_UNDERSTAND')}${session.getAttributes(handlerInput, 'repromptText')}`;
        }

        session.persist(handlerInput);

        console.log('[YesIntentHandler] bottom', 'state:', state, 'speechText:', speechText, 'aplType:', aplType)

        return common.createResponse(handlerInput, speechText, aplType);
    }
};

module.exports = YesIntentHandler;