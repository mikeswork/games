import Backbone from "backbone";
import _ from "underscore";
import BaseView from "../../baseView";
import InputManager from "../../inputManager";
import AudioManager from "../../audioManager";
import RoomManager from "./hubRoomManager";
import TemplateHtml from "text!../../../html/engine/hub/hubRooms.html";
import { PopUpManager } from "../../popupManager";

("use strict");
var CN = "[HubRooms]";

const DEFAULTS = Object.freeze({
	disableInputManager: false,
	rooms: [],
	availableRooms: [],
});

export class HubRooms extends BaseView {
	className() {
		return "hub-rooms";
	}
	get template() {
		return _.template(TemplateHtml);
	}

	events() {
		return Object.assign({}, BaseView.prototype.events, {
			"click button.to-left": "prevRoom",
			"click button.to-right": "nextRoom",
			"click button.goto": "gotoRoom",
		});
	}

	initialize(options) {
		// console.log(CN, '[initialize]', { options });

		Object.assign(this, DEFAULTS, options);
		BaseView.prototype.initialize.apply(this, arguments);

		this.roomWrapper = this.$el.find(".room-wrapper");
		this.roomAnimator = this.$el.find(".room-animator");

		if (!this.disableInputManager) {
			InputManager.add("hubRooms", {
				selector: ".hub-rooms button",
			});
		} else {
			this.addKeyListeners();
			// .active class allows us to make button pulse, etc. even though it's not in focus()
			this.$el.find("button.goto").addClass("active");
		}

		this.renderRooms();
		this.wait(500)
			.then(() => this.setupRooms())
			.then(() => this.wait(200))
			.then(() => this.setupRooms());
	}

	renderRooms() {
		// console.log(CN, "[renderRooms]");

		let rooms = this.rooms.map(({ thumbnail }) => {
			return `<div class="room img-container"><img src="${thumbnail}" /></div>`;
		});
		this.$(".rooms").append(rooms);
	}

	setupRooms() {
		// console.log(CN, '[setupRooms]');

		const currentRoomIndex = this.rooms.findIndex(({ name }) => name == RoomManager.currentRoom);
		// Currently we only have 2 rooms. We intend to highlight the 'other' room when this module is displayed.
		const targetRoom = (currentRoomIndex + 1) % this.rooms.length;
		this.setCurrentThumb(targetRoom);
	}

	toggleEnabled(enabled = false) {
		// console.log(CN, "[toggleEnabled]", { enabled });

		this.enabled = enabled;

		if (this.disableInputManager) {
			if (!enabled) {
				this.removeKeyListeners();
			} else {
				this.addKeyListeners();
			}
		}
	}

	prevRoom() {
		// console.log(CN, '[prevRoom]');

		AudioManager.playSound("woosh");

		const index = this.rooms.indexOf(this.currentRoom);
		const nextIndex = Math.max(index - 1, 0);
		this.setCurrentThumb(nextIndex);
	}

	nextRoom() {
		// console.log(CN, '[nextRoom]');

		AudioManager.playSound("woosh");

		const index = this.rooms.indexOf(this.currentRoom);
		const nextIndex = Math.min(index + 1, this.rooms.length - 1);
		this.setCurrentThumb(nextIndex);
	}

	setCurrentThumb(index) {
		// console.log(CN, "[setCurrentThumb]", { index });

		this.currentRoom = this.rooms[index];
		const activeRoom = this.$(".room").removeClass("active").eq(index).addClass("active");

		if (activeRoom.length) {
			const isBeginning = this.currentRoom && this.currentRoom == this.rooms[0];
			const isEnd = this.currentRoom && this.currentRoom == this.rooms[this.rooms.length - 1];
			if (isBeginning) {
				this.$el.addClass("atBeginning");
			} else {
				this.$el.removeClass("atBeginning");
			}
			if (isEnd) {
				this.$el.addClass("atEnd");
			} else {
				this.$el.removeClass("atEnd");
			}

			// Try to scroll achievement into center
			const container = this.$(".rooms");
			const scrollAmount =
				container.scrollLeft() +
				(activeRoom.position().left + activeRoom.outerWidth() / 2 - container.width() / 2);
			container.animate({ scrollLeft: scrollAmount });
		}
	}

	gotoRoom() {
		// console.log(CN, '[gotoRoom]');

		/**
		 * this.enabled prevents user from changing rooms via click
		 * with keyboard/remote, the listeners have already been
		 * removed so gotoRoom() won't get called during room switch
		 */
		if (this.enabled || this.enabled == undefined) {
			this.toggleEnabled(false);

			RoomManager.changeRoom(this.currentRoom.name).then(() => {
				/**
				 * We might not be on the page anymore.
				 * Only display ourselves if we are.
				 */

				if (document.contains(this.el)) {
					this.setupRooms();
					this.toggleEnabled(true);
					this.displayView();
				}
			});
		}
	}

	addKeyListeners() {
		// console.log(CN, '[addKeyListeners]');

		if (!this.listeners) {
			this.listeners = {
				enter: () => this.doButtonClick(this.$("button.goto")),
				left: () => this.doButtonClick(this.$("button.to-left")),
				right: () => this.doButtonClick(this.$("button.to-right")),
			};
		}

		InputManager.on("enter", this.listeners.enter);
		InputManager.on("left", this.listeners.left);
		InputManager.on("right", this.listeners.right);
	}

	removeKeyListeners() {
		// console.log(CN, '[removeKeyListeners]');

		if (this.listeners) {
			InputManager.off("enter", this.listeners.enter);
			InputManager.off("left", this.listeners.left);
			InputManager.off("right", this.listeners.right);
		}
	}

	doButtonClick(button) {
		// console.log(CN, '[doButtonClick]', { button });
		if (PopUpManager.isDisplayed) return;

		button.trigger("click");
		button.removeClass("clicked");
		this.wait(0).then(() => {
			button.addClass("clicked");
		});
	}

	destroy() {
		BaseView.prototype.destroy.apply(this, arguments);

		if (this.disableInputManager) {
			this.removeKeyListeners();
		}
	}
}
