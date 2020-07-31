import $ from "jquery";
import _ from "underscore";
import Backbone from "backbone";
import BaseView from "../../baseView";
import HwpTvApi from "../../hwpTvApi";
import HwpTvAppAuthManager from "../../hwptvAppAuthManager";
import { SpriteFactory } from "../../spriteFactory";
import GameBase from '../../models/gameBase';

var CN = "[AchievementsManager]";

class AchievementsManager extends BaseView {
	className() {
		return "hoard";
	}

	initialize(options) {
		// console.log(CN, '[initialize]', { options });

		if(this.initializePromise && !options) {
			return this.initializePromise;
		}

		BaseView.prototype.initialize.apply(this, arguments);

		this.achievements = new Backbone.Collection();
		this.featuredAchievements = new Backbone.Collection();
		this.spritePlayers = {};
		
		this.achievements.on("change:isOn", this.updateHoardItem.bind(this));

		window.addEventListener("message", event => {
			if (typeof event.data == "string" && event.data == "returnToHub") {
				this.fetchAchievements();
			}
		});

		this.initializePromise = this.fetchAchievements();
	}

	isReady() {
		return this.initialize();
	}

	fetchAchievements() {
		// console.log(CN, '[fetchAchievements]');

		return Promise.all([HwpTvAppAuthManager.isReady(), SpriteFactory.isReady()])
			.catch(error => {
				console.error(CN, "[Failed before able to fetch achievements]");
				console.error(error);
			})
			.then(() => {
				return Promise.all([
					HwpTvApi.getUserAchievements(),
					HwpTvApi.getFeaturedAchievements()
				]);
			})
			.then(
				([userAchievements, featuredAchievements]) => {
					this.achievements.set(userAchievements);
					this.featuredAchievements.set(featuredAchievements);
					this.refreshHoardItems();
					return GameBase.prototype.preloadContent.call(
						this,
						this.achievements.toJSON().concat(this.featuredAchievements.toJSON())
					)
				},
				error => {
					console.error(CN, "[Failed to fetch achievement data]");
					console.error(error);
				}
			);
	}

	refreshHoardItems(filterObj) {
		// console.log(CN, "[refreshHoardItems]", { filterObj });

		this.currentFilter = filterObj || this.currentFilter || { room: "" };

		const activeAchievements = this.achievements.where(this.currentFilter);
		const removedAchievements = this.achievements.without(activeAchievements);

		removedAchievements.forEach(this.removeHoardItem.bind(this));
		activeAchievements.forEach(this.addHoardItem.bind(this));
	}

	updateHoardItem(achievement) {
		// console.log(CN, "[updateHoardItem]", achievement.pick("id"), achievement);

		HwpTvApi.setUserAchievementProperty(achievement.get("id"), "isOn", achievement.get("isOn"));

		if (achievement.get("isOn")) {
			// Add the item if it doesn't already exist
			if (this.$el.find(`.hoard-item#${achievement.get("id")}`).length == 0)
				this.addHoardItem(achievement);
		} else {
			this.removeHoardItem(achievement);
		}
	}

	addHoardItem(achievement) {
		// console.log(CN, "[addHoardItem]", achievement.pick('id', 'isOn'));
		
		let existingItem = this.$(`${achievement.id}.hoard-item`).get(0);

		if(!achievement.get('isOn') || existingItem) {
			console.info(CN, "[Will not add achievement]", { existingItem });
			return;
		}

		if (achievement.has("spriteId")) {
			// Get sprite id and use factory to create
			const spriteId = achievement.get("spriteId");
			const sprite = SpriteFactory.createSprite({
				id: spriteId
			});
			// Add id and position information for the sprite
			sprite.$el.css(achievement.get("position") || {}).attr("id", achievement.get("id"));

			// spritePlayer can contain roomImg
			if (achievement.has("roomImg")) {
				sprite.$el.append(`<img src="${achievement.get("roomImg")}"/>`);
			}

			// Track our created sprite and append to the view
			this.spritePlayers[spriteId] = sprite;
			this.$el.append(sprite.el);

			sprite.play();
		} else if (achievement.has("roomImg")) {
			// Create a plain img hoard-item, set it's src, and append to the view
			const hoardItem = $(`<div class="hoard-item"><img/></div>`);
			hoardItem
				.attr("id", achievement.get("id"))
				.css(achievement.get("position"))
				.find("img")
				.attr("src", achievement.get("roomImg"));
			this.$el.append(hoardItem);
		}
	}

	removeHoardItem(achievement) {
		// console.log(CN, "[removeHoardItem]", achievement.pick("id"));
		
		this.$el.find(".hoard-item").remove(`#${achievement.id}`);

		// Clean up Sprite Player
		const spriteId = achievement.get("spriteId");

		var sPlayer = this.spritePlayers[spriteId];
		if (sPlayer) {
			sPlayer.stop();
			this.spritePlayers[spriteId] = null;
		}
	}
}

export default new AchievementsManager();
