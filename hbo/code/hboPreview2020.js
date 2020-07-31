import $ from "jquery";
import _ from "underscore";
import Backbone from "backbone";
import Router from "../router";
import Header from "../header";
import HubChrome from "../engine/hub/hubChrome";
import ImageLoader from "../imgLoader";
import FontLoader from "../fontLoader";
import Alerts from "../alerts";
import Environment from "../environment";
import GoogleAnalytics from "../ga";
import ArcadeConfig from "../arcadeConfig";
import AppAuthManager from "../hwptvAppAuthManager";
import Stats from "../performanceStats";
import Home from "../home";
import { SlidePuzzle } from "../engine/slidePuzzle/slidePuzzle";
import Trivia from "../trivia";
import Advent from "../engine/advent/adventView";
import AdventControl from "../engine/advent/adventControl";
import Leaderboards from "../leaderboardsHwpTv";
import { GamePool } from "../gamePool";
import BoxMoment from '../util/boxMoment';

var CN = "hboPreview2020";

if (!Environment.isProd()) {
	var stats = new Stats();
	requestAnimationFrame(function updateStats() {
		stats.update();
		requestAnimationFrame(updateStats);
	});
	$("body").append(stats.domElement);
}

ArcadeConfig.set({
	arcadeName: CN,
	arcadeTitle: "HBO Preview 2020",
	deepLinkShow:
		"***",
	deepLinkNetwork: "***"
});

// Configure tv mode
if (!Environment.isSetTopBox()) {
	$("body").addClass("web");
} else {
	$("body").removeClass("web");
}

// Setup arcade pages
var appPages = {
	home: {
		route: "home",
		name: "Home",
		visiblePages: [],
		module: Home
	},
	advent: {
		route: "advent",
		name: "HBO Trivia",
		subtitle: "Unlock New Trivia Games Each Week",
		visiblePages: ["home","subscribeNow"],
		module: Advent
	},
	personalityTrivia: {
		route: "personalityTrivia",
		name: "Which HBO Show Are You?",
		subtitle: "Take This Quiz to See How You Match Up",
		visiblePages: ["subscribeNow", "home"],
		module: Trivia
	},
	slider: {
		route: "slider",
		name: "Scene Slider",
		subtitle: "See how fast you can assemble the image",
		visiblePages: ["subscribeNow", "home"],
		module: GamePool,
	},
	subscribeNow: {
		route: "subscribeNow",
		name: "Order HBO",
		subtitle: "Westworld premieres 3/15",
		uri: ArcadeConfig.get("deepLinkNetwork")
	},
	watchSelectEpisodes: {
		route: "watchSelectEpisodes",
		uri: ArcadeConfig.get("deepLinkShow"),
		name: "Click to Watch HBO",
		subtitle: "Watch Select Episodes for Free"
	},
	watchNow: {
		route: "watchNow",
		uri: ArcadeConfig.get("deepLinkShow"),
		name: "Watch HBO Free Preview",
		subtitle: "3/13 - 3/16"
	},
	leaderboards: {
		route: "leaderboards",
		name: "Leaderboards",
		visiblePages: ["subscribeNow", "home"],
		module: Leaderboards
	},
	gamePoolReset: {
		route: 'reset',
		name: 'Play More',
		visiblePages: []
	}
};

// Create game data
appPages.home.data = {
	pages: [
		appPages.advent,
		appPages.personalityTrivia,
		appPages.slider,
		appPages.subscribeNow,
		appPages.watchNow,
		appPages.leaderboards
	],
	bgVideoUrl: '/hboPreview2020/vid/HBO_PREVIEW2_BG_v1.1.mp4'
};
appPages.advent.data = {
	gameId: "***",
	name: "HBO Show Trivia",
	subTitle: "New games unlock each week.",
	type: "advent",
	pages: [appPages.subscribeNow, appPages.watchNow, appPages.home, appPages.leaderboards],
	contentUrl: "/hboPreview2020/json/hboPreview2020Advent.json"
};
appPages.personalityTrivia.data = {
	contentUrl: "/hboPreview2020/json/hboPreview2020Personality.json",
	className: 'trivia personalityQuiz',
	gameId: "***",
	name: "Personality Quiz",
	type: "trivia",
	pages: [appPages.watchNow, appPages.subscribeNow],
	scoreGroups: {
		SUCCESSION: "{score} == 0",
		VEEP: "{score} == 1",
		INSECURE: "{score} == 2",
		GOT: "{score} == 3",
		BLL: "{score} == 4",
		SOPRANOS: "{score} == 5",
		WESTWORLD: "{score} == 6",
	}
};
appPages.slider.data = {
	type: "gamePool",
	engine: SlidePuzzle,
	poolId: "hboPreview2020SlidePuzzle",
	randomOrder: false,
	ignorePlayCounts: false,
	poolGames: [{}, {}, {}, {}, {}].map((gameData, i) => {
		const version = i + 1;
		return Object.assign(
			{
				gameId: `***${version}`,
				contentUrl: `/hboPreview2020/json/hboPreview2020Slider${version}.json`,
				type: "slidePuzzle",
				title: `Puzzle #${version}`,
				name: `Puzzle #${version}`,
				pages: [appPages.gamePoolReset, appPages.subscribeNow, appPages.watchNow, appPages.home]
			},
			gameData
		);
	})
};

appPages.leaderboards.data = {
	games: []
};

// Register routes for the app
[
	appPages.home,
	appPages.advent,
	appPages.personalityTrivia,
	appPages.slider,
	appPages.leaderboards
].forEach((page, index) => {
	if (index == 0) {
		// Catch all route comes first
		Router.registerRoute(`*${page.route}`, page.name, page.module, page.data);
	} else {
		Router.registerRoute(page.route, page.name, page.module, page.data);
	}
});

// Create app views
var header = new Header({
	pages: Object.keys(appPages).map(pageName => appPages[pageName]),
	logoLink: ArcadeConfig.get("deepLink")
});

var arcade = $('<div id="arcade"></div>')
	.append(header.el)
	.append('<div id="page"></div>');

// Preload all the things
var promises = [AppAuthManager.isReady(), ImageLoader.loadImages([]), FontLoader.loadFonts(['Presicav Light', 'Presicav Heavy'])];

// Wait for preload to complete
Promise.all(promises).finally(() => {
	console.info(`[Arcade ${CN} launched]`);

	GoogleAnalytics.setPrefix(CN);
	GoogleAnalytics.sendEvent("Arcade", "launch");

	var app = $("body");
	app.fadeOut(500, () => {
		app.removeClass("splashed")
			.append(Alerts.el)
			.append(arcade)
			.append(HubChrome.el)
			.queue(() => {
				
				// Now that MoneyBadger is available compare dates
				const freePreviewStart = new BoxMoment('2020-03-13');
				const freePreviewEnd = new BoxMoment('2020-03-16');
				const now = new BoxMoment();
				if(now.isBefore(freePreviewStart) || now.isAfter(freePreviewEnd)) {
					// Override endscreen button if it's not during the free preview period
					let {watchNow, watchSelectEpisodes} = appPages;
					Object.assign(appPages.watchNow, appPages.watchSelectEpisodes);
				}

				// Add advent games to leaderboards if they are unlocked
				const adventControl = new AdventControl(Object.assign({}, appPages.advent.data));
				adventControl.on('initialized', function() {
					const filteredItems = this.adventItems
						.filter(item => !item.isLocked)
						.map((gameData, index) => {
							const { content, engine: type } = gameData;
							const name = `Trivia ${index + 1}`;
							const gameId = `${this.get('gameId')}-node-${index}-${type}`;
							const contentUrl = adventControl.get('content')[type];
							return { gameId, type, name, contentUrl, content };
						});
					
					appPages.leaderboards.data.games = filteredItems;
				});

				Backbone.history.start();
				app.dequeue().fadeIn(500);
			});
	});
});
