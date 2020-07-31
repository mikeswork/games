const util = require('../helpers/util');
const session = require('../helpers/session');
const constants = require('../constants');
const VO = require('../voiceOver/voiceOverService');

const urlPrefix = 'https://***/';

function createPlainText(content) {
    return {
        "type": "PlainText",
        "text": content
    };
}

module.exports = (handlerInput, aplType = 'welcome-prompt', speechText = '') => {
    const pages = {
        welcome: undefined,
        question: undefined,
        answer: undefined,
        score: undefined,
        prompt: undefined,
        bonus: undefined
    };

    const sessionAttributes = session.getAttributes(handlerInput);
    //const state = sessionAttributes.hasOwnProperty('state') ? sessionAttributes.state : undefined;

    // Always create an array of speechParts (mp3 urls and text strings), injecting them into apl data below.
    // In common.createResponse() is where we determine if we should play them or not.
    const speechParts = speechText.match(/https.+?mp3|(?<=>)[\w\s\d]+[\w\d].+?(?=\<audio)/g) || [];
    let speechProperties = {};
    let speechTransformers = [];

    speechParts.forEach( (sPart, num) => {
        // If text
        if (sPart.indexOf('https') == -1) {
            speechProperties[`text${num+1}`] = sPart;

            speechTransformers.push({
                "inputPath": `text${num+1}`,
                "outputName": `speech${num+1}`,
                "transformer": "textToSpeech"
            });

        // Else mp3 url
        } else {
            speechProperties[`speech${num+1}`] = sPart;
        }
    });
    console.log("speechProperties:", speechProperties, "speechTransformers", speechTransformers);

    let pageNames = [];
    let pagerData = { "items": [] };
    let pageOrPagerName = 'DynamicPager';

    let textData = {};
    let questionImageData = {};

    let score = 0;
    let totalScore = 0;
    let playerScores = [];
    let rankImageData = {};

    if (aplType.indexOf('welcome') !== -1) {
        pages.welcome = require('./welcomePage.json');
        pageNames.push('WelcomePage');

        textData.welcome = createPlainText("WELCOME TO NAME THE MOVIE!");
    }

    if (aplType.indexOf('answer') !== -1) {
        pages.answer = require('./answerPage.json');
        const gotMatch = sessionAttributes.hasOwnProperty('gotMatch') ? sessionAttributes.gotMatch : false;
        let answerText = '';

        if (gotMatch) {
            // Simplifying response to correct answer. After a bonus question, the state has already been changed 
            // from STATES.BONUS_QUESTION, so we can't detect this and tell user they got 5, etc. points.
            
            // const points = (state === constants.STATES.BONUS_QUESTION) ? constants.BONUS_POINTS : constants.NORMAL_POINTS;
            // answerText = `You got ${points === 1 ? 'a point.' : points + ' points.'} Good job!`;
            answerText = "You got it, good job!";
        } else {
            const previousCorrectAnswer = sessionAttributes.hasOwnProperty('previousCorrectAnswer') ? sessionAttributes.previousCorrectAnswer : '';
            // const correctAnswers = sessionAttributes.hasOwnProperty('correctAnswers') ? sessionAttributes.correctAnswers : '';

            // const correctAnswer = (state === constants.STATES.BONUS_QUESTION) ? correctAnswers[0] : previousCorrectAnswer;
            const correctAnswer = previousCorrectAnswer;
            answerText = `${correctAnswer} was the right answer.`;
        }
        pageNames.push('AnswerPage');

        textData.answer = createPlainText(answerText);
    }

    if (aplType.indexOf('question') !== -1) {
        pages.question = require('./questionPage.json');
        const clueAttributes = sessionAttributes.hasOwnProperty('movieClues') ? sessionAttributes.movieClues : [];

        let clues = clueAttributes.map( (attr) => {
            return attr.value;
        });
        pageNames.push('QuestionPage');

        questionImageData = {
            "contentDescription": null,
            "smallSourceUrl": null,
            "largeSourceUrl": null,
            "sources": [
                {
                    "url": `${urlPrefix}question-mark.png`,
                    "size": "large",
                    "widthPixels": 0,
                    "heightPixels": 0
                }
            ]
        };

        textData.question = {};
        textData.question.start = createPlainText("Your Clues Are:");
        textData.question.clues = createPlainText(`1. ${clues[0]}<br />2. ${clues[1]}<br />3. ${clues[2]}`);
        textData.question.end = createPlainText("What's the name of this movie?");
    }

    if (aplType.indexOf('prompt') !== -1) {
        pages.prompt = require('./promptPage.json');
        let promptText = sessionAttributes.hasOwnProperty('repromptText') ? sessionAttributes.repromptText : '';

        // If VO, change to text for APL
        if (promptText.indexOf('http') !== -1) {
            const voNameReg = /\/([\w|-]*).mp3/;
            promptText = VO.getText(voNameReg.exec(promptText)[1]);
        }

        pageNames.push('PromptPage');

        textData.prompt = createPlainText(promptText);
    }

    if (aplType.indexOf('bonus') !== -1) {
        pages.bonus = require('./bonusPage.json');
        const bonusQuote = sessionAttributes.hasOwnProperty('bonusQuote') ? sessionAttributes.bonusQuote : '';
        pageNames.push('BonusPage');

        questionImageData = {
            "contentDescription": null,
            "smallSourceUrl": null,
            "largeSourceUrl": null,
            "sources": [
                {
                    "url": `${urlPrefix}question-mark.png`,
                    "size": "large",
                    "widthPixels": 0,
                    "heightPixels": 0
                }
            ]
        };

        textData.bonus = {};
        textData.bonus.question = createPlainText("What movie character said:");
        textData.bonus.quote = createPlainText(bonusQuote);
    }    

    if (aplType.indexOf('score') !== -1) {
        const playerCount = sessionAttributes.hasOwnProperty('playerCount') ? sessionAttributes.playerCount : 1;
        let rank = '';
        let rankImg = '';
        let nextRank = '';
        let nextRankImg = '';
        let winAnnouncement = '';

        if (playerCount === 1) {
            pages.score = require('./scorePageSinglePlayer.json');

            score = sessionAttributes.hasOwnProperty('score') ? sessionAttributes.score : 0;
            totalScore = sessionAttributes.hasOwnProperty('totalScore') ? sessionAttributes.totalScore : 0;
            rank = sessionAttributes.hasOwnProperty('currentRankName') ? sessionAttributes.currentRankName : '';
            rankImg = sessionAttributes.hasOwnProperty('currentRankImg') ? sessionAttributes.currentRankImg : '';
            nextRank = sessionAttributes.hasOwnProperty('nextRankName') ? sessionAttributes.nextRankName : '';
            nextRankImg = sessionAttributes.hasOwnProperty('nextRankImg') ? sessionAttributes.nextRankImg : '';

            rankImageData = {
                "contentDescription": null,
                "smallSourceUrl": null,
                "largeSourceUrl": null,
                "sources": [
                    {
                        "url": rankImg,
                        "size": "large",
                        "widthPixels": 0,
                        "heightPixels": 0
                    },
                    {
                        "url": nextRankImg,
                        "size": "large",
                        "widthPixels": 0,
                        "heightPixels": 0
                    }
                ]
            };
        } else {
            pages.score = require('./scorePageMultiPlayer.json');

            const scores = sessionAttributes.hasOwnProperty('playerScores') ? sessionAttributes.playerScores : [];
            winAnnouncement = sessionAttributes.hasOwnProperty('winAnnouncement') ? sessionAttributes.winAnnouncement : '';

            playerScores = scores.map( (current, index) => {
                return `Player ${index+1}:<br/>${current === 1 ? current + ' point' : current + ' points'}`;
            })
        }
        pageNames.push('ScorePage');

        textData.score = {};
        textData.score.points = createPlainText(`Score: ${score === 1 ? score + ' point' : score + ' points'}`);
        textData.score.total = createPlainText(`Total Score: ${totalScore === 1 ? totalScore + ' point' : totalScore + ' points'}`);
        textData.score.rank = createPlainText(`Your Rank: ${rank}`);
        textData.score.nextRank = createPlainText(`${nextRank ? 'Next Rank: ' + nextRank : ''}`);
        textData.score.winner = createPlainText(winAnnouncement);
        textData.score.player1 = createPlainText(playerScores[0]);
        textData.score.player2 = createPlainText(playerScores[1]);
        textData.score.player3 = createPlainText(playerScores[2]);
        textData.score.player4 = createPlainText(playerScores[3]);
    }

    if (pageNames.length > 1) {
        // pageOrPagerName is already set to 'DynamicPager' by default.
        // We just need to fill it with the right pages:
        pagerData = { "parameters": [
                "payload"
            ],
            "items": [
                {
                    "type": "Pager",
                    "id": "aplPager",
                    "width": "100vw",
                    "height": "100vh",
                    "items": []
                }
            ]
        };

        pageNames.forEach( pName => {
            pagerData.items[0].items.push({
                "type": pName,
                "payload": "${payload}"
            })
        });
    } else {
        pageOrPagerName = pageNames[0];
    }

    return {
        type: 'Alexa.Presentation.APL.RenderDocument',
        token: 'hwp-kids-apl',
        document: {
            "type": "APL",
            "version": "1.0",
            "theme": "dark",
            "import": [
                {
                    "name": "alexa-layouts",
                    "version": "1.0.0"
                }
            ],
            "resources": [
                {
                    "colors": {
                        "colorTextPrimary": "#fafafa"
                    }
                },
                {
                    "description": "Standard font sizes",
                    "dimensions": {
                        "textSizeSmaller": 30,
                        "textSizeSmall": 36,
                        "textSizeMedium": "3.5vw"
                    }
                },
                {
                    "description": "Common spacing values",
                    "dimensions": {
                        "spacingSmall": 12,
                        "spacingMedium": 24
                    }
                },
                {
                    "description": "Common margins and padding",
                    "dimensions": {
                        "pagePadding": "5vw",
                        "bottomBuffer": "20vh"
                    }
                }
            ],
            "styles": {
                "textStyleSmaller": {
                    "values": [
                        {
                            "color": "@colorTextPrimary",
                            "fontSize": "@textSizeSmaller"
                        }
                    ]
                },
                "textStyleSmall": {
                    "values": [
                        {
                            "color": "@colorTextPrimary",
                            "fontSize": "@textSizeSmall"
                        }
                    ]
                },
                "textStyleMedium": {
                    "values": [
                        {
                            "color": "@colorTextPrimary",
                            "fontSize": "@textSizeMedium"
                        }
                    ]
                }
            },
            "layouts": {

                "WelcomePage": pages.welcome,
                
                "PromptPage": pages.prompt,

                "AnswerPage": pages.answer,

                "QuestionPage": pages.question,

                "BonusPage": pages.bonus,

                "ScorePage": pages.score,

                "DynamicPager": pagerData,
            },


            "mainTemplate": {
                "parameters": [
                    "payload"
                ],
                "items": [
                    {
                        "type": pageOrPagerName,
                        "payload": "${payload}"
                    }
                ]
            }
        },


        datasources: {
            "templateData": {
                "properties": speechProperties,
                "transformers": speechTransformers,
                // [
                //     {
                //       "inputPath": "text",
                //       "outputName": "speech",
                //       "transformer": "textToSpeech"
                //     }
                // ],
                "type": "object",
                "title": "Name The Movie",
                "backgroundImage": {
                    "contentDescription": null,
                    "smallSourceUrl": null,
                    "largeSourceUrl": null,
                    "sources": [
                        {
                            "url": `${urlPrefix}hwpk-bg-small.jpg`,
                            "size": "small",
                            "widthPixels": 0,
                            "heightPixels": 0
                        },
                        {
                            "url": `${urlPrefix}hwpk-bg.jpg`,
                            "size": "large",
                            "widthPixels": 0,
                            "heightPixels": 0
                        }
                    ]
                },
                "questionImage": questionImageData,
                "rankImages": rankImageData,
                "textContent": textData,
                "numberContent": {
                    "score": score,
                    "totalScore": totalScore,
                    "playerScores": playerScores
                },
                "logoUrl": `${urlPrefix}hwpk-icon-normal.png`,
                "logoImage": {
                    "contentDescription": null,
                    "smallSourceUrl": null,
                    "largeSourceUrl": null,
                    "sources": [
                        {
                            "url": `${urlPrefix}hwpk-icon-normal.png`,
                            "size": "small",
                            "widthPixels": 0,
                            "heightPixels": 0
                        },
                        {
                            "url": `${urlPrefix}hwpk-icon-large.png`,
                            "size": "large",
                            "widthPixels": 0,
                            "heightPixels": 0
                        }
                    ]
                },
                "largeLogoUrl": `${urlPrefix}hwpk-icon-large.png`,
                "hintText": "Try \"Help\""
            }
        }
    }
};