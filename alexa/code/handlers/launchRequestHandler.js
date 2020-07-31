const constants = require('../constants');
const common = require('../common');
const session = require('../helpers/session');
const questions = require('../questions');
const util = require('../helpers/util');
const isp = require('../helpers/isp');
const VO = require('../voiceOver/voiceOverService');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    async handle(handlerInput) {
        console.log('[LaunchRequestHandler]', JSON.stringify({handlerInput}));
        const sessionAttributes = session.getAttributes(handlerInput);
        const lastActivityTime = sessionAttributes.hasOwnProperty('lastActivityTime') ? sessionAttributes.lastActivityTime : undefined;
        
        // Load product (Mega Pack)
        const productJustBought = await isp.loadProduct(handlerInput);
        const product = sessionAttributes.hasOwnProperty('availableProduct') ? sessionAttributes.availableProduct : undefined;
        console.log("Loaded availableProduct:", product);
        
        const now = Date.now();
        let speechText = '';
        let actualQuestion = '';
        let aplType = 'welcome-prompt';
        
        // First time ever launched
        if (!lastActivityTime) {
            // Start new game
            if (isp.isPremiumExperience(handlerInput)) {
                speechText = VO.get('MUSIC_FULL_WELCOME_LETS_GET_STARTED');
                actualQuestion = common.promptPlayerCount(handlerInput);
            } else {
                actualQuestion = questions.generateAndPlay(handlerInput, 'full-welcome');
                aplType = 'welcome-question';
            }
        
        // Coming back
        } else {
            // Check if parent approved purchase since last game
            let congrats = productJustBought ? util.getIspCongratsText(handlerInput) : '';
            const state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;
            
            // If there is a game in progress last played very recently, automatically resume it
            if (state === constants.STATES.GAME && (now - lastActivityTime) < constants.QUICK_RETURN_TIMEOUT) {
                const qType = productJustBought ? 'welcome-back-congrats' : 'welcome-back';
                actualQuestion = questions.getPrevAndResume(handlerInput, qType);

                aplType = 'welcome-question';
            
            // If there is a game in progress last played within 24 hours, allow the user to resume it if they want to
            } else if (state === constants.STATES.GAME && (now - lastActivityTime) < constants.SAME_DAY_TIMEOUT) {
                speechText = `${VO.get('MUSIC_WELCOME_BACK')}${congrats}`;
                actualQuestion = VO.get('DO_YOU_WANT_TO_RESUME');

                session.setAttributes(handlerInput, { 
                    "state": constants.STATES.RESUME_PROMPT,
                    "repromptText": VO.get('REPROMPT_DO_YOU_WANT_TO_RESUME')
                });

            // Start a new game
            } else {
                if (isp.isPremiumExperience(handlerInput)) {
                    speechText = `${VO.get('MUSIC_WELCOME_BACK')}${congrats}${VO.get('LETS_GET_STARTED')}`;
                    actualQuestion = common.promptPlayerCount(handlerInput);
                } else {
                    actualQuestion = questions.generateAndPlay(handlerInput, 'welcome-back');
                    aplType = 'welcome-question';
                }
            }
        }

        speechText = `${speechText} ${actualQuestion}`;

        session.persist(handlerInput);

        console.log("aplType in launch handler:", aplType)
        return common.createResponse(handlerInput, speechText, aplType);
    }
};

module.exports = LaunchRequestHandler;