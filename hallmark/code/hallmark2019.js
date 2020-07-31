require([
	'jquery',
	'underscore',
	'backbone',
	'js/router',
	'js/audioManager',
	'js/header',
	'js/imgLoader',
	'js/alerts',
	'js/environment',
	'js/ga',
	'js/hwpTvAppAuthManager',
	'js/arcadeConfig',
	'js/fontLoader',
	'js/performanceStats',
	// Modules for other arcade pages
	'js/engine/advent/adventView'
], function(
	$,
	_,
	Backbone,
	Router,
	AudioManager,
	Header,
	ImageLoader,
	Alerts,
	Environment,
	GoogleAnalytics,
	AppAuthManager,
	ArcadeConfig,
	FontLoader,
	Stats,
	Advent
) {
	'use strict';

	var CN = 'Hallmark2019';

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
		arcadeTitle: 'Hallmark 2019',
		deepLinkChannel: '***',
		deepLinkNetwork:
			'***'
	});

	var appPageManifest = {
		advent: {
			route: 'home',
			name: 'Home',
			title: 'someTitle',
			// subTitle: 'someSubTitle',
			visiblePages: ['deepLinkNetwork', 'deepLinkChannel'],
			description: 'Make your way to the finish!',
			module: Advent
		},
		closeGame: {
			route: 'closeGame',
			uri: 'adventCloseGame',
			name: 'Play More Games',
			visiblePages: ['watchNow']
		},
		deepLinkNetwork: {
			route: 'deepLinkNetwork',
			name: '',
			uri: ArcadeConfig.get('deepLinkNetwork')
		},
		deepLinkChannel: {
			route: 'deepLinkChannel',
			name: '',
			uri: ArcadeConfig.get('deepLinkChannel')
		}
	};

	var header = new Header({
		pages: Object.values(appPageManifest)
	});

	appPageManifest.advent.data = {
		gameId: '***',
		contentUrl: `/hallmark2019/json/hallmarkAdventData.json?t=${Date.now()}`,
		pages: [appPageManifest.deepLinkChannel, appPageManifest.deepLinkNetwork, appPageManifest.closeGame]
	};

	// Register all routes
	Router.registerRoute(
		`*${appPageManifest.advent.route}(/:startNode)`,
		appPageManifest.advent.name,
		appPageManifest.advent.module,
		appPageManifest.advent.data
	);

	// List all things to preload
	var promises = [
		AppAuthManager.isReady(), 
		FontLoader.loadFonts(['Raleway']),
		ImageLoader.loadImages([
			'img/hallmark2019/main-bg.jpg',
			'img/hallmark2019/tree.png',
			'img/hallmark2019/present-bow.png',
			'img/hallmark2019/present-bow-pink.png',
			'img/hallmark2019/game-bg-trivia.png',
			'img/hallmark2019/game-bg-spot.png',
			'img/hallmark2019/game-bg-memory.png',
			'img/hallmark2019/game-bg-lockbox.png'
		])
	];

	var arcade = $('<div id="arcade"></div>')
		.append(header.el)
		.append('<div id="page"></div>');

	// Wait for preload to complete
	Promise.all(promises).finally(() => {

		GoogleAnalytics.setPrefix(CN);
		GoogleAnalytics.sendEvent('Arcade', 'launch');
		
		var app = $('body').fadeOut(500, () => {
			app.removeClass('splashed')
				.append(Alerts.el)
				.append(arcade)
				.queue(() => {
					Backbone.history.start();
					app.dequeue().fadeIn();
				});
		});
	});
});
