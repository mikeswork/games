import Backbone from 'backbone';
import $ from 'jquery';
import _ from 'underscore';
import Alerts from '../alerts';
import ArcadeConfig from '../arcadeConfig';
import HubChrome from '../engine/hub/hubChrome';
import Environment from '../environment';
import FontLoader from '../fontLoader';
import GoogleAnalytics from '../ga';
import Header from '../header';
import AppAuthManager from '../hwptvAppAuthManager';
import ImageLoader from '../imgLoader';
import Stats from '../performanceStats';
import Router from '../router';
import Home from '../home';
import Trivia from '../trivia';
import Bracket from '../redCarpet';
import WellConnected from '../wellConnected';
import { BallotPicker } from "../ballotPicker";
import Leaderboards from '../leaderboardsHwpTv';
import AwardCollection from '../awardCollection';
import { GamePool } from '../gamePool';


var CN = 'awards2020';

if (!Environment.isProd()) {
	var stats = new Stats();
	requestAnimationFrame(function updateStats() {
		stats.update();
		requestAnimationFrame(updateStats);
	});
	$('body').append(stats.domElement);
}

ArcadeConfig.set({
	arcadeName: CN,
	arcadeTitle: 'Awards 2020',
	deepLinkShow: '***'
});

// Configure tv mode
if (!Environment.isSetTopBox()) {
	$('body').addClass('web');
} else {
	$('body').removeClass('web');
}

// 1. PAGE MANIFEST
var appPages = {
	watchNow: {
		route: 'watchNow',
		name: 'Watch Now',
		uri: ArcadeConfig.get('deepLinkShow')
	},
	watchNowLong: {
		route: 'watchNowLong',
		name: 'Watch Nominated Movies Now',
		uri: ArcadeConfig.get('deepLinkShow')
	},
	home: {
		route: 'home',
		name: 'Home',
		description: 'Awards Season Arcade',
		visiblePages: ['watchNow', 'leaderboard'],
		module: Home
	},
	bracket: {
		route: 'bracket',
		name: 'Bracket',
		visiblePages: ['watchNow', 'home'],
		module: Bracket
	},
	triviaGoldenGlobes: {
		route: 'triviaGoldenGlobes',
		name: 'Golden Globes Trivia',
		visiblePages: ['watchNow', 'home'],
		module: Trivia
	},
	triviaAcademyAwards: {
		route: 'triviaAcademyAwards',
		name: 'Academy Awards Trivia',
		visiblePages: ['watchNow', 'home'],
		module: Trivia
	},
	pool: {
		route: 'pool',
		name: 'Star Connector',
		title: 'Star Connector',
		visiblePages: ['watchNow', 'home'],
		module: GamePool
	},
	gamePoolReset: {
		route: 'reset',
		name: 'Play More',
		visiblePages: []
	},
	ballotPicker: {
		route: 'ballotPicker',
		name: 'Ballot Picker',
		visiblePages: ['watchNow', 'home'],
		module: BallotPicker
	},
	leaderboard: {
		route: 'leaderboard',
		name: 'Standings',
		visiblePages: ['watchNow', 'home'],
		module: Leaderboards
	}
};

// 2. GAME DATA
const activePages = [];
const phase = 3;  // 1, 2, or 3

if(phase === 1) {
	activePages.push(
		/** Pages for phase 1 **/
		appPages.bracket,
		appPages.triviaGoldenGlobes
	)
}

if(phase === 2) {
	activePages.push(
		/** Pages for phase 2 **/
		appPages.bracket,
		appPages.triviaGoldenGlobes,
		appPages.triviaAcademyAwards
	)
}

if(phase === 3) {
	activePages.push(
		/** Pages for phase 3 **/
		appPages.pool,
		appPages.ballotPicker,
		appPages.triviaAcademyAwards,
		appPages.triviaGoldenGlobes
	)
}

appPages.home.data = {
	inputConfig: {
		defaultElement: ".game:nth-child(2) .game-button"
	},
	bgVideoUrl: '/awards2020/vid/awards2020/AWARDS_BG.mp4',
	pages: activePages
};

appPages.bracket.data = {
	type: 'bracket',
	name: 'Best Movie Bracket',
	gameId: '***',
	contentUrl: '/awards2020/json/bracketData.json',
	// silhouetteUrl: '',
	// resultsToDisplay: 8,
	pages: [appPages.watchNow, appPages.triviaGoldenGlobes, appPages.leaderboard]
};
appPages.triviaGoldenGlobes.data = {
	type: 'trivia',
	className: 'trivia goldenGlobes',
	gameId: '***',
	contentUrl: '/awards2020/json/triviaGoldenGlobes.json',
	name: 'Globes Trivia',
	title: 'Golden Globes Trivia',
	pages: [appPages.watchNowLong, appPages.ballotPicker, appPages.triviaAcademyAwards, appPages.pool, appPages.leaderboard]
};



appPages.triviaAcademyAwards.data = {
	type: 'trivia',
	className: 'trivia academyAwards',
	gameId: '***',
	contentUrl: '/awards2020/json/triviaAcademyAwards.json',
	name: 'Oscars Trivia',
	title: 'Academy Awards Trivia',
	pages: [appPages.watchNowLong, appPages.ballotPicker, appPages.triviaGoldenGlobes, appPages.pool, appPages.leaderboard]
};
// appPages.wellConnected.data = {
// 	type: 'wellConnected',
// 	gameId: '***',
// 	contentUrl: '/awards2020/json/wellConnectedData.json',
// 	name: 'Star Connector',
// 	title: 'Star Connector',
// 	pages: [appPages.watchNowLong, appPages.ballotPicker, appPages.triviaGoldenGlobes, appPages.triviaAcademyAwards, appPages.leaderboard]
// };

const poolGames = [
	{ gameId: '***', contentUrl: '/awards2020/json/wellConnectedData1.json' },
	{ gameId: '***', contentUrl: '/awards2020/json/wellConnectedData2.json' },
	{ gameId: '***', contentUrl: '/awards2020/json/wellConnectedData3.json' }
].map((gameData, i) => {
	return Object.assign(
		{
			engine: WellConnected,
			type: 'wellConnected',
			title: `Star Connector #${i + 1}`,
			name: `Star Connector ${i + 1}`,
			pages: [appPages.watchNowLong, appPages.gamePoolReset, appPages.ballotPicker, appPages.triviaGoldenGlobes, appPages.triviaAcademyAwards, appPages.leaderboard]
		},
		gameData
	);
});

appPages.pool.data = {
	type: 'gamePool',
	poolId: '***',
	poolGames,
	randomOrder: false,
	ignorePlayCounts: false,
	pages: []
};

appPages.ballotPicker.data = {
	type: 'ballotPicker',
	gameId: '***',
	name: 'Ballot Picker',
	contentUrl: '/awards2020/json/awards2020Ballot.json',
	pages: [appPages.watchNowLong, appPages.triviaGoldenGlobes, appPages.triviaAcademyAwards, appPages.pool, appPages.leaderboard]
};

appPages.leaderboard.data = {
	games: [
		appPages.triviaGoldenGlobes.data, 
		appPages.triviaAcademyAwards.data, 
		appPages.pool.data.poolGames[0], 
		appPages.pool.data.poolGames[1], 
		appPages.pool.data.poolGames[2]
	],
	bracketResultsToDisplay: 10,
};

// 3. Register all routes for the app
[
	appPages.home,
	appPages.triviaGoldenGlobes,
	appPages.triviaAcademyAwards,
	appPages.bracket,
	appPages.pool,
	appPages.ballotPicker,
	appPages.leaderboard
].forEach((page, index) => {
	let routePrefix = index == 0 ? '*' : ''; // Add * to first route to make a catch-all
	let route = `${routePrefix}${page.route}`;
	Router.registerRoute(route, page.name, page.module, page.data);
});

// 4. Create app views
var header = new Header({
	pages: Object.values(appPages)
});

var arcade = $('<div id="arcade"></div>')
	.append('<div id="page"></div>')
	.append(header.el);

// Preload all the things
Promise.all([
	ImageLoader.loadImages(["img/awards2020/banner_bg.png"]),
	FontLoader.loadFonts([]),
	AppAuthManager.isReady()
]).finally(() => {
	console.log("Application loaded");

	GoogleAnalytics.setPrefix(CN);
	GoogleAnalytics.sendEvent("Arcade", "launch");

	var app = $("body");
	app.fadeOut(500, () => {
		app.removeClass("splashed")
			.append(Alerts.el)
			.append(arcade)
			.append(HubChrome.el)
			.queue(function() {
				Backbone.history.start();
				app.dequeue().fadeIn();

				// InputManager.set('menu', {
				// 	defaultElement: ''
				// });
			});
	});
});
