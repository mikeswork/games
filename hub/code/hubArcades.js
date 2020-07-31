define([
	"underscore",
	"js/baseView",
	"js/inputManager",
	"js/hwptvAppAuthManager",
	"js/hwpTvApi",
	"js/comcastMoneyBadger",
	"js/alerts",
	"js/audioManager",
	"js/imgLoader",
	"js/ga",
	"js/popupManager",
	"text!html/engine/hub/hubArcades.html",
], function (
	_,
	BaseView,
	InputManager,
	HwpTvAppAuthManager,
	HwpTvApi,
	MoneyBadger,
	Alerts,
	AudioManager,
	ImageLoader,
	GoogleAnalytics,
	PopUpManager,
	HubHtml
) {
	"use strict";
	var CN = "[HubArcades]";

	PopUpManager = PopUpManager.PopUpManager;

	return BaseView.extend({
		className: "hub-arcades collapsed",
		arcades: [],
		template: _.template(HubHtml),

		disableInputManager: false,

		events: {
			"click button.expand-hub-btn": "expandHub",
			"click button.prev-arcade-btn": "prevArcade",
			"click button.next-arcade-btn": "nextArcade",
		},

		initialize: function (options) {
			// console.log(CN, '[initialize]', options);

			BaseView.prototype.initialize.apply(this, arguments);
			this.iframeWrapper = this.$el.find(".iframe-wrapper");
			this.iframeAnimator = this.$el.find(".iframe-animator");
			this.iframe = this.$el.find("iframe");

			if (!this.disableInputManager) {
				InputManager.add("hub-arcades", {
					selector: ".hub-arcades .hub-arcade-nav button",
					defaultElement: ".hub-arcades .hub-arcade-nav button.expand-hub-btn",
					enterTo: "defaultElement",
				});
			} else {
				this.addKeyListeners();
				// .active class allows us to make button pulse, etc. even though it's not in focus()
				this.$el.find("button.expand-hub-btn").addClass("active");
			}

			window.addEventListener("message", this.receiveMessage.bind(this), false);

			const onArcadesLoaded = () => {
				return this.preloadThumnails().then(() => {
					this.setCurrentArcade(0);
					this.autoPlay();

					// Prevent animations from queueing up when user switches tabs or minimizes window
					window.onblur = () => {
						this.stopAutoPlay();
					};
					window.onfocus = () => {
						this.autoPlay();
					};
				});
			};

			// Use arcades data if provided otherwise fetch from url
			if (!this.arcades || !this.arcades.length) {
				this.loadArcadeData().then(onArcadesLoaded);
			} else {
				onArcadesLoaded();
			}
		},

		loadArcadeData: function () {
			// console.log(CN, '[loadArcadeData]');

			const url = this.contentUrl || "json/arcadeData.json";
			return Backbone.ajax(url).then(({ pages }) => (this.arcades = pages));
		},

		preloadThumnails() {
			// console.log(CN, '[preloadThumnails]');

			return ImageLoader.loadImages(this.arcades.map((arcade) => arcade.thumbnail));
		},

		addKeyListeners: function () {
			if (!this.listeners) {
				this.listeners = {
					enter: () => this.doButtonClick(this.$("button.expand-hub-btn")),
					left: () => this.doButtonClick(this.$("button.prev-arcade-btn")),
					right: () => this.doButtonClick(this.$("button.next-arcade-btn")),
				};
			}
			InputManager.on("left", this.listeners.left);
			InputManager.on("right", this.listeners.right);
			InputManager.on("enter", this.listeners.enter);
		},

		doButtonClick: function (button) {
			// console.log(CN, "[doButtonClick]", { button, canDisplay: !PopUpManager.isDisplayed });

			if (!PopUpManager.isDisplayed) {
				button.trigger("click");
				button.removeClass("clicked");
				this.wait(0).then(() => {
					button.addClass("clicked");
				});
			}
		},

		removeKeyListeners: function () {
			if (this.listeners) {
				InputManager.off("left", this.listeners.left);
				InputManager.off("right", this.listeners.right);
				InputManager.off("enter", this.listeners.enter);
			}
		},

		setCurrentArcade: function (index) {
			// console.log(CN, '[setCurrentArcade]', index);

			this.currentArcade = this.arcades[index];
			this.iframeAnimator.css("background-image", `url(${this.currentArcade.thumbnail})`);
		},

		isVisible: function (index) {
			return this.$el.is(":visible");
		},

		autoPlay: function (initialDelay = 9000, delay = 4000) {
			// Before creating a new timeOut, clear the previous one if it exists
			this.stopAutoPlay();

			this.autoPlayTimer = setTimeout(() => {
				this.nextArcade(null, true);

				// In the next call, initialDelay will be null and therefore ignored
				this.autoPlay(null);
			}, initialDelay || delay);
		},

		stopAutoPlay: function () {
			clearTimeout(this.autoPlayTimer);
		},

		nextArcade: function (e, wasAutomatic) {
			// console.log(CN, '[nextArcade]');
			if (!wasAutomatic) {
				this.autoPlay();
			}

			if (!this.isVisible()) {
				return;
			}

			AudioManager.playSound("woosh");

			let index = this.arcades.indexOf(this.currentArcade);

			this.iframeAnimator.animate({ marginLeft: "-100%" }, 350, () => {
				this.iframeAnimator.css("margin-left", "100%");
				this.iframeAnimator.animate({ marginLeft: "0" }, 350);

				if (index == this.arcades.length - 1) {
					this.setCurrentArcade(0);
				} else {
					this.setCurrentArcade(index + 1);
				}
			});
		},

		prevArcade: function () {
			// console.log(CN, '[prevArcade]');
			this.autoPlay();

			if (!this.isVisible()) {
				return;
			}

			AudioManager.playSound("woosh");

			let index = this.arcades.indexOf(this.currentArcade);

			this.iframeAnimator.animate({ marginLeft: "100%" }, 350, () => {
				this.iframeAnimator.css("margin-left", "-100%");
				this.iframeAnimator.animate({ marginLeft: "0" }, 350);

				if (index == 0) {
					this.setCurrentArcade(this.arcades.length - 1);
				} else {
					this.setCurrentArcade(index - 1);
				}
			});
		},

		expandHub: function () {
			console.log(CN, "[expandHub]");

			if (this.disableInputManager) {
				this.removeKeyListeners();
			}

			if (!this.isVisible()) {
				return;
			}

			// this.wait().then(() => AudioManager.playSound("swoosh"));

			// Prevent user from changing hub sections while arcade is loading
			InputManager.pause();
			this.wait(4000).then(() => InputManager.resume());

			this.stopAutoPlay();
			this.$el.removeClass("collapsed").addClass("loading");

			// Delay load so that "dim-lights" css animation can play without bitterly competing for precious, scant resources.
			// Memories of past struggles were ever present as painful, insistive recollections...
			return this.wait(500).then(() => {
				const uri = new URL(this.currentArcade.uri, location.origin);
				const params = new URLSearchParams(uri.search);
				params.set("token", HwpTvAppAuthManager.getIdentifier());
				params.set("session", HwpTvApi.headers.session);
				uri.search = params;

				this.iframe.attr("src", uri);
				this.$el.focus();

				// Catch unresponsive arcades
				setTimeout(() => {
					if (this.$el.hasClass("loading")) {
						console.error(CN, "[UNACCEPTABLE LOAD TIME][COLLAPSING HUB]");
						GoogleAnalytics.sendEvent(
							"HubArcades",
							"LaunchArcade",
							"UnacceptableLoadTime",
							this.currentArcade.uri
						);
						this.$el.removeClass("loading");
						this.collapseHub();
					}
				}, 10000);
			});
		},

		collapseHub: function () {
			// console.log(CN, '[collapseHub]');

			if (this.disableInputManager) {
				this.addKeyListeners();
			}

			this.$el.addClass("collapsed");

			return this.wait(100)
				.then(() => {
					InputManager.resume();
					InputManager.focus();
					return this.wait(500);
				})
				.then(() => {
					this.iframe.attr("src", "");
					this.autoPlay();
				});
		},

		receiveMessage: function (event) {
			// console.log(CN, '[receiveMessage]', event);

			if (typeof event.data == "string") {
				if (event.data == "returnToHub") {
					this.collapseHub();
				} else if (event.data == "finishedLoading") {
					this.$el.removeClass("loading");
				} else if (event.data.includes("xre://")) {
					MoneyBadger.badgerDeepLink(event.data);
				}
			}
		},

		destroy: function () {
			BaseView.prototype.destroy.apply(this, arguments);

			this.stopAutoPlay();

			if (this.disableInputManager) {
				this.removeKeyListeners();
			}
		},
	});
});
