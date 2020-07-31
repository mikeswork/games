define([
	"underscore",
	"js/baseView",
	"js/inputManager",
	"js/audioManager",
	"js/alerts",
	"js/gameFactory",
	"js/hwpTvApi",
	"js/ga",
	"js/router",
	"text!html/endscreenDynamic.html",
	"text!html/engine/advent.html",
	"text!html/videoScreen.html",
	"text!html/genericInstructions.html",
	"js/engine/advent/adventControl",
], function (
	_,
	BaseView,
	InputManager,
	AudioManager,
	Alerts,
	GameFactory,
	HwpTvApi,
	GoogleAnalytics,
	Router,
	EndscreenHtml,
	AdventHtml,
	VideoHtml,
	InstructionsHtml,
	AdventControl
) {
	"use strict";
	var CN = "[AdventView]";

	return BaseView.extend({
		className: "advent",

		adventContainer: undefined,

		focusedIsAlwaysCentered: true,

		template: _.template(AdventHtml),
		instructionsTemplate: _.template(InstructionsHtml),
		endscreenTemplate: _.template(EndscreenHtml),
		videoTemplate: _.template(VideoHtml),

		prevFocus: undefined,

		events: {
			"click button.advent-item": "clickItem",
			"blur button.advent-item": "blurItem",
			"focus button.advent-item": "scrollToItem",
			"click .game-content > .instructions .btn-start": "closeGame",
			"click a[href='#adventCloseGame']": "closeGame",
			"click .close-game button": "closeGame",
		},

		control: {},

		items: [],

		gameView: undefined,

		pages: [],

		initialize: function (options) {
			// console.log(CN, "[initialize]", { options });

			this.options = options;
			_.extend(this, options);

			this.$el.addClass("loading");

			this.control = new AdventControl(this.options);
			this.control.on("initialized", () => {
				// Render now that we have all the data
				this.render(1)
					.then(() => this.control.preload())
					.then(() => {
						// Prep containers
						this.adventContainer.hide();
						this.gameContainer.hide();
						this.updateScore();

						// Show instructions or just preload and display the board
						if (this.control.has("instructions")) {
							this.displayInstructions();
						} else {
							this.$el.removeClass("loading");
							this.adventContainer.fadeIn();
						}
					});
			});

			InputManager.add("adventnodes", {
				selector: ".advent-items button.advent-item",
				rememberSource: true,
				defaultElement: ".advent-items button.advent-item:first-child",
				enterTo: "last-focused",
			});
			// In case user left for another route after adventnodes
			// got disabled and now they've opened it again:
			InputManager.enable("adventnodes");

			if (this.control.has("gameId")) {
				var gameId = this.control.get("gameId");
				GoogleAnalytics.sendEvent("Advent-" + gameId, "Start");
			}

			// Hijack the back functionality for our special case
			this.oldRouterBack = Router.back.bind(Router);
			Router.back = this.onBack.bind(this);
		},

		displayInstructions() {
			// console.log(CN, '[displayInstructions]');

			this.adventContainer.fadeOut(500, () => {
				this.gameContent
					.empty()
					.append(this.instructionsTemplate(this.control.get("instructions")));

				this.$el.removeClass("loading");
				this.gameContainer.fadeIn();
				setTimeout(() => InputManager.focus(".btn-start"));
			});
		},

		onBack: function () {
			var adventIsVisible = this.adventContainer.is(":visible");

			if (!adventIsVisible) {
				this.closeGame();
			} else {
				this.oldRouterBack();
			}
		},

		render: function (fadeDuration) {
			// console.log(CN, "[render]", { fadeDuration });

			return this.replaceView(this.template(this), fadeDuration).then(
				() => this.focusNode(),
				null,
				() => {
					// this.$(".advent-header .title").text(this.control.get("title"));
					// this.$(".advent-header .subtitle").text(this.control.get("subtitle"));

					this.adventContainer = this.$el.find(".advent-container");
					this.gameContainer = this.$el.find(".advent-game-container");
					this.gameContent = this.gameContainer.find(".game-content");
				}
			);
		},

		clickItem: function (event) {
			const nodeId = event.currentTarget.id;
			const gameData = this.control.adventItems.find((node) => node.id == nodeId);
			let { type, engine, content } = gameData;
			type = type || engine;
			const gameId = `${this.control.get("gameId")}-node-${nodeId}-${type}`;
			const contentUrl = this.control.get("content")[type];
			// console.log(CN, "[clickItem]", { nodeId, type, gameId, contentUrl, gameData });

			this.gameView = GameFactory.createGame(
				Object.assign({}, gameData, {
					type,
					gameId,
					contentUrl,
				})
			);

			// If in DX game, modify dxHints section so that the 'up' 'leaveFor'
			// action goes to the exit/home button and not skip past it
			if (type == "dx") {
				InputManager.set("dxHints", {
					leaveFor: {
						down: ".double-exposure .btn-dx-focus",
						up: ".exit-game-btn",
					},
				});
			}

			if (this.control.has("gameId")) {
				// Track node launched
				var category = `Advent-${this.control.get("gameId")}`;
				var action = "LaunchNode";
				var label = `Node-${nodeId}`;
				GoogleAnalytics.sendEvent(category, action, label);

				this.gameView.game.rounds.once("update", () => {
					// Track game launched
					var category = "Advent-" + this.control.get("gameId");
					var action = "GameLoaded";
					var label = `${gameId} [${content.join(",")}]`;
					GoogleAnalytics.sendEvent(category, action, label);
				});
			}

			this.gameView.game
				.off("game-complete")
				.on("game-complete combo-correct", this.handleGameDone.bind(this));

			this.currentNodeId = nodeId;
			InputManager.disable("adventnodes");

			this.adventContainer.fadeOut(() => {
				this.gameContent.empty().append(this.gameView.el);
				this.gameContainer.addClass(type).fadeIn(0);
			});
		},

		showEndscreenVideo: function () {
			this.gameContent.fadeOut(() => {
				this.gameContent
					.empty()
					.append(this.videoTemplate({ video: this.gameView.endscreenVideo }));

				var video = this.$("video");
				var videoDom = video.get(0);
				if (videoDom) {
					video.one("ended", () => {
						this.$(".advent-game-container .exit-game-btn").fadeIn();
						this.showEndscreen();
					});
					video.one("timeupdate", () => this.lockVideoSize());
					video.one("canplaythrough", () => {
						this.$(".advent-game-container .exit-game-btn").hide();
						AudioManager.stopAllSounds();
						this.playVideo(videoDom);
					});

					this.gameContent.fadeIn();
				} else {
					this.showEndscreen();
				}
			});
		},

		showEndscreen: function () {
			// console.log(CN, "[showEndscreen]");

			// Create new obj with copy of pages array. This is used in the endscreen template.
			// If uri is present, we insert into the copy of pages array a new item (i.e. Visit Show/Movie button)
			var endscreenData = { pages: this.pages.slice(0) };
			if (this.gameView.endscreenShowUri) {
				endscreenData.pages.push({
					name: this.gameView.endscreenShowText,
					uri: this.gameView.endscreenShowUri,
				});
			}

			let score = this.gameView.game.getScore();
			let possibleScore = this.gameView.game.getPossibleScore();
			let correctAnswers = this.gameView.game.getCorrectAnswers();

			this.gameContent.fadeOut(() => {
				this.gameContent.empty().append(this.endscreenTemplate(endscreenData));

				if (this.scoreGroups) {
					/*
						Score groups allow for customizing the endscreen text. It should consist of an object
						whose keys are a string identifier and values are a string to be evaluated. If it evaluates
						to false it will be added as a class to the endscreen. These can be targeted with CSS to
						customize endscreens.
					*/
					const replacementValues = {
						score: correctAnswers,
						percentage: correctAnswers / possibleScore,
					};
					let scoreLevel = Object.keys(this.scoreGroups).find((groupName) => {
						let rawCompareString = this.scoreGroups[groupName];
						let compareString = Object.keys(replacementValues).reduce((str, replacementKey) => {
							return str.replace(`{${replacementKey}}`, replacementValues[replacementKey]);
						}, rawCompareString);
						return eval(compareString);
					});
					this.$(".endscreen").addClass(scoreLevel);
				}

				this.gameContent.fadeIn(() => {
					InputManager.resume(); // In case any game paused InputManager
					InputManager.focus();
				});

				this.$(".advent-game-container .score").text(score);
				this.$(".advent-game-container .possible-score").text(possibleScore);

				if (this.gameView.endscreenImg) {
					this.$(".advent-game-container .msg-1").css(
						"background-image",
						`url(${this.gameView.endscreenImg})`
					);
				}
				if (this.gameView.endscreenHtml) {
					this.$(".advent-game-container .msg-2").html(this.gameView.endscreenHtml);
				} else if (this.gameView.pointsPerQuestion > 1) {
					// If each question is more than 1 point, we currently show it in
					// msg-2 but we might want to create a new container for it in the future
					this.$(".endscreen .msg-2").text(score);
				}
			});
		},

		handleGameDone: function () {
			// console.log(CN, '[handleGameDone]');

			let score = this.gameView.game.getScore();
			this.control.completeNode(this.currentNodeId, score);

			this.gameView.off();
			this.gameView.game.off();

			// Show video before the endscreen, if it's present.
			// showEndscreen() is then triggered from inside showEndscreenVideo().
			if (this.gameView.endscreenVideo) {
				this.showEndscreenVideo();
			} else {
				this.showEndscreen();
			}

			// Track node complete
			if (this.control.has("gameId")) {
				var category = "Advent-" + this.control.get("gameId");
				var action = "NodeComplete";
				var label = this.currentNodeId;
				GoogleAnalytics.sendEvent(category, action, label);
			}

			// Add completed class to node in hidden advent layer
			this.$(".advent-items #" + this.currentNodeId + ".advent-item").addClass("completed");
			this.updateScore();
		},

		updateScore: function () {
			// console.log(CN, '[updateScore]');

			this.$(".score-board .score").text(this.control.getDisplayScore());
		},

		closeGame: function () {
			// console.log(CN, "[closeGame]");

			if (event) {
				event.preventDefault();
			}

			// Dismiss the game container
			this.gameContainer.fadeOut(500, () => {
				// Remove identifier class from game container
				const allGameEngines = Object.keys(GameFactory.engines).join(" ");
				this.gameContainer.removeClass(allGameEngines);

				// Empty game content
				this.gameContent.empty();

				// Display the advent container again
				this.adventContainer.fadeIn(500, () => {
					InputManager.enable("adventnodes");

					this.focusNode();

					// If we are closing game but we haven't played it
					// all the way through, we still need to clean it up
					if (this.gameView) {
						if (this.gameView.game) {
							this.gameView.game.off();
						}

						this.gameView.off();
						this.gameView.destroy();
						this.gameView = null;
					}
				});
			});
		},

		blurItem: function (event) {
			this.prevFocus = event.target;
		},

		// Focuses on the given node or a valid node
		focusNode: function (nodeId) {
			// console.log(CN, "[focusNode]", { nodeId });

			var childId = this.control.getValidNodeId();
			var targetChild = this.$(`#${childId}`)[0];

			if (nodeId) {
				let givenChild = this.$(`#${nodeId}`)[0];
				if (givenChild) {
					if (!givenChild.disabled) {
						targetChild = givenChild;
					}
				}
			}

			this.wait(0).then(() => {
				InputManager.focus(targetChild);
			});
		},

		scrollToItem: function (event) {
			// console.log(CN, '[scrollToItem]', { event });

			const itemContainer = this.$(".advent-items");
			const containerWidth = itemContainer.width();
			const item = event.target;
			const itemLeft = item.offsetLeft;
			const itemWidth = item.clientWidth;

			if (this.focusedIsAlwaysCentered) {
				const calculatedLeftEdge = containerWidth / 2 - itemWidth / 2;
				const containerOffsetLeft = itemContainer[0].offsetLeft;
				const targetScrollLeft = itemLeft - calculatedLeftEdge - containerOffsetLeft;
				itemContainer.scrollLeft(targetScrollLeft);

				// Old way of scrolling below.
				// This has a bug because when an item that is not visible gets focus, the scroller goes there
				// automatically. Then we try to scroll based on the position differences and two scrolls occur:
				//
				// Scroll as much as the difference in position between previously selected and currently selected item
				// var prevItem = this.prevFocus;
				// if (prevItem != undefined && this.adventContainer != undefined) {
				// 	this.adventContainer.scrollLeft(this.adventContainer.scrollLeft() + (itemLeft - prevItem.offsetLeft));
				// }
			} else {
				// If focused item is partially off screen, scroll so it's fully in view
				const itemRight = itemLeft + itemWidth;
				const currentScrollLeft = itemContainer.scrollLeft();
				let newScrollLeft;

				if (itemRight > containerWidth + currentScrollLeft) {
					newScrollLeft = currentScrollLeft + (itemRight - containerWidth);
					itemContainer.scrollLeft(newScrollLeft);
				} else if (itemLeft < currentScrollLeft) {
					newScrollLeft = currentScrollLeft - (currentScrollLeft - itemLeft);
					itemContainer.scrollLeft(newScrollLeft);
				}
			}
		},

		// For testing, allows us to hook into Alerts from template
		alertify: function (message) {
			Alerts.show("info", message, 120000);
		},

		destroy: function () {
			Router.back = this.oldRouterBack;
		},
	});
});
