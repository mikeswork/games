const constants = require('./constants');
const session = require('./helpers/session');
const util = require('./helpers/util');
const QuestionDatabase = require('./db/questionDatabase');
const VO = require('./voiceOver/voiceOverService');
const ISP = require('./helpers/isp');

exports.generateAndPlay = (handlerInput, type) => {
	const sessionAttributes = session.getAttributes(handlerInput);
	const nextRound =
		1 + (sessionAttributes.hasOwnProperty('roundCounter') ? sessionAttributes.roundCounter : 1);
	const playerCount = sessionAttributes.hasOwnProperty('playerCount') ? sessionAttributes.playerCount : 1;
	const currentPlayer = util.roundToPlayer(nextRound, playerCount);
    let correctAnswers = [];
    let previousCorrectAnswer = '';

	// 1. Construct beginning and end of question
	let voID;
	let questionSpeech = '';
    let questionSuffix = '';

	switch (type) {
        case 'full-welcome':
            questionSpeech = VO.get('MUSIC_FULL_WELCOME_LETS_GET_STARTED_QUESTION');
            questionSuffix = VO.getRandomPrefixed('QUESTION_SUFFIX');
            break;
        case 'welcome-back':
            questionSpeech = VO.get('MUSIC_WELCOME_BACK_LETS_GET_STARTED_QUESTION');
            questionSuffix = VO.getRandomPrefixed('QUESTION_SUFFIX');
            break;
        case 'ok-new-game':
            questionSpeech = VO.get('OK_START_NEW_GAME_QUESTION');
            questionSuffix = VO.getRandomPrefixed('QUESTION_SUFFIX');
            break;
        case 'new-x-players':
            voID = ['OK_ONE_PLAYER','OK_TWO_PLAYERS','OK_THREE_PLAYERS','OK_FOUR_PLAYERS'][playerCount-1];
            questionSpeech = VO.get(voID);
            questionSuffix = VO.getRandomPrefixed('QUESTION_SUFFIX');
            break;
        case 'lets-new-game':
            questionSpeech = VO.get('LETS_PLAY_NEW_GAME_QUESTION');
            questionSuffix = VO.getRandomPrefixed('QUESTION_SUFFIX');
            break;
        case 'right-answer':
            voID = playerCount === 1 
                 ? ['ANSWER_RIGHT_NEXT_DING_1',
                    'ANSWER_RIGHT_NEXT_DING_2',
                    'ANSWER_RIGHT_NEXT_DING_3',
                    'ANSWER_RIGHT_NEXT_DING_4',
                    'ANSWER_RIGHT_NEXT_DING_5'][Math.floor(Math.random() * 5)]
                 : ['ANSWER_RIGHT_NEXT_PLAYER_ONE_DING', 
                    'ANSWER_RIGHT_NEXT_PLAYER_TWO_DING', 
                    'ANSWER_RIGHT_NEXT_PLAYER_THREE_DING', 
                    'ANSWER_RIGHT_NEXT_PLAYER_FOUR_DING'][currentPlayer-1];

            questionSpeech = VO.get(voID);
            questionSuffix = VO.getRandomPrefixed('QUESTION_SUFFIX');
            break;
        case 'wrong-answer':
            correctAnswers = sessionAttributes.hasOwnProperty('correctAnswers') ? sessionAttributes.correctAnswers : [];
            questionSpeech = VO.getRightMovie(correctAnswers[0]);

            voID = playerCount === 1
                 ? ['ANSWER_WRONG_NEXT_DING_1',
                    'ANSWER_WRONG_NEXT_DING_2',
                    'ANSWER_WRONG_NEXT_DING_3',
                    'ANSWER_WRONG_NEXT_DING_4',
                    'ANSWER_WRONG_NEXT_DING_5'][Math.floor(Math.random() * 5)]
                 : ['ANSWER_WRONG_NEXT_PLAYER_ONE_DING', 
                    'ANSWER_WRONG_NEXT_PLAYER_TWO_DING', 
                    'ANSWER_WRONG_NEXT_PLAYER_THREE_DING', 
                    'ANSWER_WRONG_NEXT_PLAYER_FOUR_DING'][currentPlayer-1];

            questionSpeech += ` ${VO.get(voID)}`;
            // no questionSuffix

            previousCorrectAnswer = correctAnswers[0]; // For APL
            break;
        case 'magic-answer':
            correctAnswers = sessionAttributes.hasOwnProperty('correctAnswers') ? sessionAttributes.correctAnswers : [];
            questionSpeech = VO.getRightMovie(correctAnswers[0]);

            questionSpeech += ` ${VO.get('ANSWER_MAGIC_NEXT_DING')}`;
            // no questionSuffix
            break;
	}

	// 2. Construct clue part, middle part of question
	let availableMovies = sessionAttributes.availableMovies || [];
	if (availableMovies.length === 0) {
		// Once all movies have been used, we "refresh" the array from full db
		const currentDifficulty = sessionAttributes.currentDifficulty || 2;
		const dbVersion = ISP.isPremiumExperience(handlerInput) ? 'PREMIUM' : 'FREE';
		availableMovies = QuestionDatabase.getDB(dbVersion)
			.generateQuestions(3, currentDifficulty);
	}

	const currMovie = availableMovies.shift();

	// Grab clues
	let clues = currMovie.clues.map(clue => {
        const clueContent = VO.get(clue.snd) || clue.value;
		return `${clueContent}${clueContent.indexOf('https') === -1 ? '.' : ''}`;
	});
	questionSpeech += clues.join(' ');

	// 3. Append end of question
    questionSpeech += ` ${questionSuffix}`;

	// 4. Set attributes and return speech
    const newAttributes = {
		state: constants.STATES.GAME,
		correctAnswers: currMovie.title,
        previousCorrectAnswer: previousCorrectAnswer,
		availableMovies: availableMovies,
		movieClues: currMovie.clues,
		totalQuestions: playerCount === 1 ? constants.SP_QUESTIONS : constants.MP_QUESTIONS,
        repromptText: VO.get('REPROMPT_PLEASE_GUESS')
	};

    if (type === 'right-answer' || type === 'wrong-answer' || type === 'magic-answer') {
        // Increment the current game round
        newAttributes.roundCounter = nextRound;
    } else {
        // Set round to 1 at beginning of game and reset score(s) and magic
        newAttributes.roundCounter = 1;
        newAttributes.magicUsed = false;

        if (playerCount === 1) {
            // Set score of player in single-player game to 0
            newAttributes.score = 0;
        } else {
            let allScores = [];
            for (let i = 1; i <= playerCount; i++) {
                allScores.push(0);
            }
            // Set score of all players in multi-player game to 0
            newAttributes.playerScores = allScores;
        }
    }

	session.setAttributes(handlerInput, newAttributes);
	return questionSpeech;
};

exports.getPrevAndResume = (handlerInput, type) => {
	const sessionAttributes = session.getAttributes(handlerInput);
    const currentRound = sessionAttributes.hasOwnProperty('roundCounter') ? sessionAttributes.roundCounter : 1;
	const playerCount = sessionAttributes.hasOwnProperty('playerCount') ? sessionAttributes.playerCount : 1;
    const currentPlayer = util.roundToPlayer(currentRound, playerCount);
    const correctAnswers = sessionAttributes.hasOwnProperty('correctAnswers') ? sessionAttributes.correctAnswers : [];

    session.setAttributes(handlerInput, { 
        state: constants.STATES.GAME,
        previousCorrectAnswer: correctAnswers[0],  // For APL
        repromptText: VO.get('REPROMPT_PLEASE_GUESS')
    });

    let questionSpeech = '';
    let questionSuffix = VO.getRandomPrefixed('QUESTION_SUFFIX');
    let voID = null;

    switch (type) {
        case 'welcome-back':
            voID = playerCount === 1
                 ? 'MUSIC_WELCOME_BACK_LETS_GET_BACK_IN_QUESTION'
                 : ['MUSIC_WELCOME_BACK_LETS_GET_BACK_IN_PLAYER_ONE_QUESTION',
                    'MUSIC_WELCOME_BACK_LETS_GET_BACK_IN_PLAYER_TWO_QUESTION',
                    'MUSIC_WELCOME_BACK_LETS_GET_BACK_IN_PLAYER_THREE_QUESTION',
                    'MUSIC_WELCOME_BACK_LETS_GET_BACK_IN_PLAYER_FOUR_QUESTION'][currentPlayer-1];
            
            questionSpeech = VO.get(voID);
            break;
        case 'welcome-back-congrats':
            // This type will only be used when returning to single-player
            // game since in this scenario, the Mega Pack was just bought.
            questionSpeech = VO.get('MUSIC_WELCOME_BACK');
            questionSpeech += util.getIspCongratsText(handlerInput);
            questionSpeech += VO.get('BACK_IN_QUESTION_BRIEF');

            questionSuffix = '';
            break;
        case 'lets-get-back':
            voID = playerCount === 1
                 ? 'BACK_IN_QUESTION'
                 : ['BACK_IN_PLAYER_ONE_QUESTION',
                    'BACK_IN_PLAYER_TWO_QUESTION',
                    'BACK_IN_PLAYER_THREE_QUESTION',
                    'BACK_IN_PLAYER_FOUR_QUESTION'][currentPlayer-1];

            questionSpeech = VO.get(voID);
            break;
        case 'used-magic':
            questionSpeech = VO.get('ALREADY_USED_MAGIC_QUESTION');
            break;
        case 'magic-unavailable':
            voID = ['MAGIC_UNAVAILABLE_PLAYER_ONE_QUESTION',
                    'MAGIC_UNAVAILABLE_PLAYER_TWO_QUESTION',
                    'MAGIC_UNAVAILABLE_PLAYER_THREE_QUESTION',
                    'MAGIC_UNAVAILABLE_PLAYER_FOUR_QUESTION'][currentPlayer-1];

            questionSpeech = VO.get(voID);
            break;
        case 'lets-continue':
            voID = playerCount === 1
                 ? 'CONTINUE_QUESTION'
                 : ['CONTINUE_PLAYER_ONE_QUESTION',
                    'CONTINUE_PLAYER_TWO_QUESTION',
                    'CONTINUE_PLAYER_THREE_QUESTION',
                    'CONTINUE_PLAYER_FOUR_WHAT_MOVIE_CLUES'][currentPlayer-1];

            questionSpeech = VO.get(voID);
            break;
        case 'pick-up':
            voID = playerCount === 1
                 ? 'PICK_UP_QUESTION'
                 : ['PICK_UP_PLAYER_ONE_QUESTION',
                    'PICK_UP_PLAYER_TWO_QUESTION',
                    'PICK_UP_PLAYER_THREE_QUESTION',
                    'PICK_UP_PLAYER_FOUR_QUESTION'][currentPlayer-1];

            questionSpeech = VO.get(voID);
            break;
        case 'repeat':
            voID = playerCount === 1
                 ? 'QUESTION_PROMPT_BRIEF'
                 : ['QUESTION_PROMPT_BRIEF_PLAYER_ONE',
                    'QUESTION_PROMPT_BRIEF_PLAYER_TWO',
                    'QUESTION_PROMPT_BRIEF_PLAYER_THREE',
                    'QUESTION_PROMPT_BRIEF__PLAYER_FOUR'][currentPlayer-1];

            questionSpeech = VO.get(voID);
            break;
    }	

	// Add clues
	questionSpeech += sessionAttributes.movieClues
		.map(clue => {
            const clueContent = VO.get(clue.snd) || clue.value;
			return `${clueContent}${clueContent.indexOf('https') === -1 ? '.' : ''}`;
		})
		.join(' ');

    questionSpeech += ` ${questionSuffix}`;
    
    return questionSpeech;
};

// Internal utility function only used in this module
const findBonusQuestion = (rankId) => {
    const matchedRank = constants.RANKS.find( rank => rank.ID === rankId );

    if (matchedRank) {
        return matchedRank.hasOwnProperty('BONUS') ? matchedRank.BONUS : undefined;        
    } else {
        return undefined;
    }
};

exports.bonusGenerateAndPlay = (handlerInput) => {
    const rankId = session.getAttributes(handlerInput, 'userRankId');
    const bonusQuestion = findBonusQuestion(rankId);

    session.setAttributes(handlerInput, { 
        "state": constants.STATES.BONUS_QUESTION,
        "bonusQuote": VO.getCharacterQuote(bonusQuestion.CHARACTER[0], "text"),
        "correctAnswers": bonusQuestion.CHARACTER,
        "previousCorrectAnswer": bonusQuestion.CHARACTER,  // For APL. Template uses this, not correctAnswers
        "totalQuestions": 1,
        "score": 0,
        "repromptText": VO.get('REPROMPT_PLEASE_GUESS_CHARACTER')
    });

    return `${VO.get('QUESTION_PROMPT_BONUS')} "${VO.getCharacterQuote(bonusQuestion.CHARACTER[0])}"`;
};

// So far, state is always already set when bonusGetPrev() is called
// so there's no need to set state, repromptText, etc.
exports.bonusGetPrev = handlerInput => {
    const rankId = session.getAttributes(handlerInput, 'userRankId');
    const bonusQuestion = findBonusQuestion(rankId);
    
    return `${VO.get('QUESTION_PROMPT_BONUS')} "${VO.getCharacterQuote(bonusQuestion.CHARACTER[0])}"`;
};