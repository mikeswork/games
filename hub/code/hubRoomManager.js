import _ from "underscore";
import BaseView from "../../baseView";
import HubPosterWidget from "./hubPosterWidget";
import AchievementsManager from "./achievementsManager";
import HomeBg from "../../../img/hwpHub/hub-bg.jpg";
import LibraryBg from "../../../img/hwpHub/hub-bg-library.jpg";
import HomeToLibVid from "../../../vid/hwpHub/homeToLib.mp4";
import LibToHomeVid from "../../../vid/hwpHub/libToHome.mp4";
import ImgLoader from "../../imgLoader";

const CN = "[HubRoomManager]";
const DEFAULTS = Object.freeze({
	transitionBuffer: 0.25,
});

/** URLs for background images. Hard coding until we find a reason to load this dynamically */
const ROOM_IMAGES = {
	home: HomeBg,
	library: LibraryBg,
};

export const ROOMS = Object.freeze({
	HOME: "home",
	LIBRARY: "library",
});

class HubRoomManager extends BaseView {
	className() {
		return "room-manager home";
	}

	initialize(options) {
		// console.log(CN, "[initialize]", { options });

		if (this.initializePromise && !options) {
			return this.initializePromise;
		}

		options = Object.assign({}, DEFAULTS, options);
		BaseView.prototype.initialize.call(this, options);

		this.posterWidget = new HubPosterWidget({
			image: "img/hwpHub/default_bracket_001.jpg",
			gameId: "fathersDayBracket2020",
			contentUrl: "/hwpHubGames/json/hubFathersDayBracket2020.json",
		});

		this.$el.append('<div id="bglayer" style="position: fixed; width: 100%; height: 100%;"></div>');
		this.bgLayer = this.$el.find("#bglayer");
		this.$el.append(this.posterWidget.el);
		this.$el.append(AchievementsManager.el);

		this.initializePromise = AchievementsManager.isReady()
			.then(() => ImgLoader.loadImages(Object.values(ROOM_IMAGES)))
			.then(() => this.changeRoom(ROOMS.HOME));
	}

	isReady() {
		return this.initialize();
	}

	get unlockedRooms() {
		return AchievementsManager.achievements.reduce((unlockedRooms, achievement) => {
			if (!unlockedRooms.includes(achievement.get("room"))) {
				unlockedRooms.push(achievement.get("room"));
			}
			return unlockedRooms;
		}, []);
	}

	redecorateRoom(room) {
		if (this.currentRoom) {
			this.$el.removeClass(this.currentRoom);
		}

		if (!Object.keys(ROOM_IMAGES).includes(room)) {
			room = ROOMS.HOME;
		}

		let backgroundImage = `url('${ROOM_IMAGES[room]}')`;
		this.$el.addClass(room);
		this.bgLayer.css({ backgroundImage });
		AchievementsManager.refreshHoardItems({ room });

		this.trigger('roomDecorated', room);

		return Promise.resolve(room);
	}

	displayRoomDecorations() {
		// console.log(CN, "[displayRoomDecorations]");

		return Promise.all([
			this.displayElement(this.posterWidget.el),
			this.displayElement(AchievementsManager.el),
		]);
	}

	dismissRoomDecorations() {
		// console.log(CN, "[dismissRoomDecorations]");
		return Promise.all([
			this.dismissElement(this.posterWidget.el),
			this.dismissElement(AchievementsManager.el),
		]);
	}

	displayBackground() {
		// console.log(CN, "[displayBackground]");
		return this.displayElement(this.bgLayer);
	}

	dismissBackground() {
		// console.log(CN, "[dismissBackground]");
		return this.dismissElement(this.bgLayer);
	}

	changeRoom(room = ROOMS.HOME) {
		// console.log(CN, "[changeRoom]", { room });

		// Setup default room upon initial load
		if (!this.currentRoom) {
			this.redecorateRoom(room);
			this.currentRoom = room;
			return;
		}

		// We're already in that room
		if(room == this.currentRoom) {
			return this.onRoomChanged();
		}

		// Skip video cleanup the first time since previous video won't exist yet
		if (this.vid) {
			this.cleanUpVideo(this.vid);
			this.vid.remove();
			this.vid = null;
		}

		// Determine correct transition to play
		// We don't have that many transitions now so this is straightforward.
		// With multiple room paths, we will need to check for 'room' too in addition to 'this.currentRoom'
		var vidSrc;

		switch (this.currentRoom) {
			case ROOMS.HOME:
				vidSrc = HomeToLibVid;
				break;

			case ROOMS.LIBRARY:
				vidSrc = LibToHomeVid;
				break;
		}

		// Prepend the <video/> element each time because just updating the src
		// adds a black frame to the beginning of the video the next time it's played
		this.$el.prepend(
			`<video id="transition-vid" src="${vidSrc}" style="position: fixed;" width="1280" height="720"/>`
		);
		this.vid = this.$el.find("#transition-vid");

		var canPlayPromise = new Promise((resolve, reject) => {
			this.vid.one("canplaythrough", resolve);
			this.vid.one("error", reject);
		});
		
		this.trigger("roomChanging", this.currentRoom, room);
		return Promise.all([canPlayPromise, this.dismissRoomDecorations()])
			.then(() => this.dismissBackground())
			.then(() => this.redecorateRoom(room))
			.then(
				() =>
					new Promise((resolve) => {
						this.redecorateRoom(room);
						this.currentRoom = room;
						const video = this.vid[0];
						video.play();

						this.videoCheckInterval = setInterval(() => {
							const { currentTime, duration } = video;
							const timeRemaining = duration - currentTime;
							if (timeRemaining < this.transitionBuffer) {
								video.pause();
								clearInterval(this.videoCheckInterval);
								resolve();
							}
						}, 100);
					})
			)
			.then(() => this.onRoomChanged())
			.then(() => this.displayBackground())
			.then(() => this.displayRoomDecorations())
	}

	onRoomChanged() {
		// console.log(CN, '[onRoomChanged]');

		this.trigger('roomChanged', this.currentRoom);
		return Promise.resolve(this.currentRoom);
	}

	getCurrentRoom() {
		return this.currentRoom;
	}
}

export default new HubRoomManager();
