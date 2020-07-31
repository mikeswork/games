import _ from "underscore";
import BaseGameView from "./baseGameView";
import TimeKeeper from "./timeKeeper";
import InputManager from "./inputManager";
import Environment from "./environment";
import InstructionsHtml from "text!../html/genericInstructions.html";
import PickerTemplateHtml from "text!../html/ballotPicker.html";
import BallotResultsHtml from "text!../html/ballotResults.html";
import { GameBallotPicker } from "./models/gameBallotPicker";

var CN = "[BallotPicker]";

const DEFAULTS = Object.freeze({
	scrollerIndex: 0
});

export class BallotPicker extends BaseGameView {
	className() {
		return "ballot";
	}

	get instructionsTemplate() {
		return _.template(InstructionsHtml);
	}

	get ballotPickerTemplate() {
		return _.template(PickerTemplateHtml);
	}
	get ballotResultsTemplate() {
		return _.template(BallotResultsHtml);
	}
	get eventStartTime() {
		return this.game.get("eventStartTime");
	}

	events() {
		return Object.assign(
			{
				"focus .ballot-nominee": "scrollIfNecessary",
				"click .ballot-nominee": "onNomineeSelected",
				"click .btn-back": "previousCategory",
				"click .results .scroller .right-arrow": "scrollScrollerRight",
				"click .results .scroller .left-arrow": "scrollScrollerLeft"
			},
			_.result(BaseGameView.prototype, "events", {})
		);
	}

	initialize(options) {
		// console.log(CN, "[initialize]", options);

		// Set as loading
		this.$el.addClass("loading");

		// Set defaults
		Object.assign(this, DEFAULTS, options);

		// Setup input handling
		InputManager.add("ballotPicker", {
			selector: ".ballot .ballot-nominee, .ballot .btn-back"
		});
		InputManager.add("ballotResults", {
			selector: ".ballot .results .btn"
		});

		// Setup Ballot game state and event handlers
		if (!this.game) this.game = new GameBallotPicker(options); // Create Game if it was not provided
		this.game.once("initialized", () => {
			return this.game.preloadMedia().then(() => {
				this.$el.removeClass("loading");
				BaseGameView.prototype.initialize.call(this, options);
			});
		});
		this.game.on("game-round", this.populateCategory.bind(this));
		this.game.on("game-complete", this.displayResultsScreen.bind(this));
	}

	render() {
		// console.log(CN, "[render]");

		const afterEvent = TimeKeeper.currentTime > this.eventStartTime;
		const userHasCompleted = this.game.userHasCompleted();

		if (afterEvent) {
			this.$el.addClass("after-event");
		}

		if (!userHasCompleted || afterEvent) {
			this.displayInstructions();
		} else {
			this.displayResultsScreen();
		}
	}

	startGame() {
		// console.log(CN, "[startGame]");
		this.dismissView().then(() => this.game.nextRound());
	}

	nextCategory() {
		// console.log(CN, "[nextCategory]");
		this.game.nextRound();
	}

	skipToLast() {
		// console.log(CN, "[skipToLast]");
		this.game.roundIndex(this.game.rounds.length - 2);
		this.nextCategory();
	}

	previousCategory() {
		// console.log("[previousCategory]");
		this.game.prevRound();
	}

	populateCategory(category) {
		// console.log(CN, "[populateCategory]", { category });
		if (!category) {
			console.error("no category to populate");
			return;
		}

		const categoryIndex = this.game.roundIndex();
		const newCategory = this.ballotPickerTemplate(category);
		this.replaceView(newCategory).then(
			() => {
				// displayed

				var focusNominee =
					this.$(".ballot-nominee.selected").get(0) || this.$(".ballot-nominee").get(0);
				InputManager.focus(focusNominee);
			},
			null, // No errors for view replacement
			() => {
				// Updated
				if (categoryIndex > 0) {
					this.$(".btn-back").show();
				} else {
					this.$(".btn-back").hide();
				}

				this.setProgressIndicator(categoryIndex + 1);
				this.wait().then(() => {
					var focusNominee =
						this.$(".ballot-nominee.selected").get(0) ||
						this.$(".ballot-nominee").get(0);
					InputManager.focus(focusNominee);
				});

				// Add a class if the body needs to scroll. We can use this to change justify-content, 
				// insert an empty spacer after the last item since padding/margin at the end of a list is ignored, etc.
				const catBody = this.$('.body');
				if (catBody.length > 0 && catBody[0].scrollWidth > $('body').outerWidth()) {
					catBody.addClass('needs-to-scroll');
				}
			}
		);
	}

	/**
	 * Scroll the list to the focused item if it's not fully in view
	 * @param {Event} event DOM event
	 */
	scrollIfNecessary(event) {
		//console.log(CN, '[scrollIfNecessary]');
		const itemContainer = this.$('.body');
		const item = event.target;

		// Focused item is too far to the left. Execute compensatory scroll!
		if (item.offsetLeft - itemContainer.scrollLeft() < 0) {
			event.preventDefault();

			let scrollAmount = itemContainer.scrollLeft() - item.clientWidth;
			itemContainer.scrollLeft(scrollAmount);
			console.log("[scrollIfNecessary], scrolling left", scrollAmount)

		// Focused item is too far to the right. Execute compensatory scroll!
		} else if ((item.offsetLeft + item.clientWidth - itemContainer.scrollLeft()) > itemContainer.width()) {
			event.preventDefault();

			let scrollAmount = itemContainer.scrollLeft() + item.clientWidth;
			itemContainer.scrollLeft(scrollAmount);
			console.log("[scrollIfNecessary], scrolling right", scrollAmount);
		}
	}

	/**
	 * Handler for when a user selects a nominee (i.e. "clicks" it)
	 * @param {Event} event Dom event object
	 */
	onNomineeSelected(event) {
		// console.log(CN, "[onNomineeSelected]", { event });

		if (TimeKeeper.currentTime > this.eventStartTime && !Environment.isDebug()) {
			console.warn("Selections will not update after the event has started");
		} else {
			// Process picked nominee
			const pickId = $(event.currentTarget).data("id");
			this.game.submitCategorySelection(pickId);

			// Update visuals of selected element
			this.$(".ballot-nominee").removeClass("selected");
			this.$(".ballot-nominee[data-id=" + pickId + "]").addClass("selected");
		}

		// Move on to next round
		this.wait(this.game.get("delayAfterSelection")).then(() => {
			this.game.nextRound();
		});
	}

	displayResultsScreen() {
		// console.log(CN, "[displayResultsScreen]");

		this.replaceView(this.ballotResultsTemplate(this)).then(
			function() {
				this.updateCountdownTimer();
				this.startResultsCountdown();
				InputManager.focus();
			}.bind(this),
			null,
			InputManager.focus.bind(InputManager)
		);
	}

	/*******************************************************
	 * Methods to update visual countdown on the endscreen
	 ******************************************************/

	startResultsCountdown() {
		// console.log(CN, "[startResultsCountdown]");
		if (this.countdownInterval) {
			clearInterval(this.countdownInterval);
		}
		this.countdownInterval = setInterval(this.updateCountdownTimer.bind(this), 1000);
	}

	updateCountdownTimer() {
		// console.log(CN, "[updateCountdownTimer]");

		var time = this.$(".countdown").html() || "";
		var t = this.getTimeRemaining();
		if (t) {
			time = `<span class="days">${t.days}</span><span class="hours">${t.hours}</span><span class="minutes">${t.minutes}</span><span class="seconds">${t.seconds}</span>`;
		}
		this.$(".countdown").html(time);
	}

	getTimeRemaining() {
		// console.log(CN, "[getTimeRemaining]", this.timeRemaining);

		var t = this.eventStartTime - TimeKeeper.currentTime;

		if (t <= 0) {
			// Return 0 if no time remaining;
			return {
				seconds: this.padTimeDigits(0),
				minutes: this.padTimeDigits(0),
				hours: this.padTimeDigits(0),
				days: this.padTimeDigits(0)
			};
		}

		var seconds = Math.floor((t / 1000) % 60);
		var minutes = Math.floor((t / 1000 / 60) % 60);
		var hours = Math.floor((t / (1000 * 60 * 60)) % 24);
		var days = Math.floor(t / (1000 * 60 * 60 * 24));
		return {
			seconds: this.padTimeDigits(seconds),
			minutes: this.padTimeDigits(minutes),
			hours: this.padTimeDigits(hours),
			days: this.padTimeDigits(days)
		};
	}

	padTimeDigits(time) {
		// console.log(CN, '[padTimeDigits]');
		var s = time.toString();
		if (s.length < 2) {
			s = "0" + s;
		} else if (s.length > 2) {
			s = s.slice(-2);
		}
		return s;
	}

	/******************************************************
	 * Methods to assist scrollable elements on endscreen
	 *****************************************************/

	scrollScrollerRight() {
		// console.log(CN, "[scrollScrollerRight]");

		this.scrollerIndex = Math.min(this.scrollerIndex + 1, this.game.rounds.length - 4);

		var scrollContent = this.$(".scroller .content");
		var pick = this.$(".pick").eq(this.scrollerIndex);
		var newLeft = -pick.position().left;

		scrollContent.animate({
			left: newLeft
		});
	}

	scrollScrollerLeft() {
		// console.log(CN, "[scrollScrollerLeft]");

		this.scrollerIndex = Math.max(this.scrollerIndex - 1, 0);

		var scrollContent = this.$(".scroller .content");
		var pick = this.$(".pick").eq(this.scrollerIndex);
		var newLeft = -pick.position().left;

		this.$(".scroller .content").animate({
			left: newLeft
		});
	}
}
