define([
	'backbone',
	'underscore',
	'js/baseView',
	'js/inputManager',
	'js/hwpTvApi',
	'js/engine/hub/achievementsManager',
	'js/engine/hub/hubRoomManager',
	'js/audioManager',
	"js/popupManager",
	'text!html/engine/hub/hubAchievements.html',
	'text!html/engine/hub/hubAchievementItem.html'
], function(Backbone, _, BaseView, InputManager, HwpTvApi, AchievementsManager, HubRoomManager, AudioManager, PopUpManager, TemplateHtml, AchievementItem) {
	'use strict';
	var CN = '[HubAchievements]';

	AchievementsManager = AchievementsManager.default;
	HubRoomManager = HubRoomManager.default;
	PopUpManager = PopUpManager.PopUpManager;

	return BaseView.extend({
		className: 'hub-achievements',

		template: _.template(TemplateHtml),
		itemTemplate: _.template(AchievementItem),

		disableInputManager: false,

		events: {
			'click button.prev': 'prevAchievement',
			'click button.next': 'nextAchievement',
			'click button.select': 'toggleAchievement'
		},

		initialize: function(options) {
			// console.log(CN, '[initialize]', { options });

			const filterObj = { room: HubRoomManager.getCurrentRoom() };
			
			// Featured achievements show up to the user even if they haven't unlocked it
			const featuredAchievements = AchievementsManager.featuredAchievements
				.where(filterObj)
				.filter(achievement => !AchievementsManager.achievements.has(achievement.id));
			this.achievements = new Backbone.Collection(
				AchievementsManager.achievements.where(filterObj).concat(featuredAchievements)
			);

			BaseView.prototype.initialize.apply(this, arguments);
			this.prevAchievement = this.prevAchievement.bind(this);
			this.nextAchievement = this.nextAchievement.bind(this);
			this.toggleAchievement = this.toggleAchievement.bind(this);

			this.currentAchievement = new Backbone.Model;

			if (!this.disableInputManager) {
				InputManager.add('hubAchievements', {
					selector: '.hub-achievements button'
				});
			}

			this.renderAchievements();
			this.selectAchievement(this.achievements.at(0));
		},

		renderAchievements: function() {
			// console.log(CN, '[renderAchievements]', this.achievements);

			const items = this.achievements.map(achievement => {
				return this.itemTemplate(achievement);
			});
			this.$('.achievements')
				.empty()
				.append(items);

			if (this.disableInputManager) {
				InputManager.on('left', this.prevAchievement);
				InputManager.on('right', this.nextAchievement);
				InputManager.on('enter', this.toggleAchievement);

				// .active class allows us to make button pulse, etc. even though it's not in focus()
				this.$el.find('button.select').addClass('active')
			}
		},

		doButtonClick: function(button) {
			console.log(CN, '[doButtonClick]', { button });
			if (PopUpManager.isDisplayed) return;

			button = this.$(button);
			button.removeClass("clicked");
			this.wait(0).then(() => {
				button.addClass("clicked");
			});
		},

		selectAchievement: function(achievement) {
			// console.log(CN, "[selectAchievement]", achievement.pick("id", "name"));

			if (achievement && achievement.get('id') != this.currentAchievement.get('id')) {
				this.currentAchievement = achievement;

				// Remove active class that's currently on any achievements 
				this.$(".achievement-item").removeClass("active");
				// Add active class to the achievement
				const newAchv = this.$(`#${achievement.get('id')}`);
				newAchv.addClass('active');

				// Try to scroll achievement into center
				const container = this.$('.achievements');
				const scrollAmount = container.scrollLeft() 
								   + ((newAchv.position().left + (newAchv.outerWidth()/2)) - (container.width() / 2));
				container.animate({ scrollLeft: scrollAmount }, 150);
				this.updateVisualState();
				return true
			} else {
				return false;
			}
		},

		// Currently adds a class to the container that only effects button text (e.g. "remove" or "locked")
		updateVisualState: function() {
			// console.log(CN, '[updateVisualState]');
			
			if(this.currentAchievement) {
				const achievement = this.currentAchievement;
				const isOwned = achievement.has('isOn');
				const isOn = isOwned && achievement.get('isOn');
				const isNew = achievement.get('isNew');

				// Add classes indicating if this achievement is activated or locked
				this.$el.removeClass('achievement-locked achievement-active')
				if (isOwned && isOn) {
					this.$el.addClass('achievement-active');
				} else if (!isOwned) {
					this.$el.addClass('achievement-locked');
				}

				if(isNew) {
					HwpTvApi.setUserAchievementProperty(achievement.get('id'), 'isNew', false).then(() => {
						this.$(`#${achievement.get('id')}`).removeClass('new');
					})
					
				}
				
				// Update indicators
				let currentIndex = this.achievements.indexOf(this.currentAchievement);
				this.$el.removeClass('atBeginning atEnd');
				if(currentIndex == 0) {
					this.$el.addClass('atBeginning');
				}
				if(!this.achievements.length || currentIndex == this.achievements.length - 1) {
					this.$el.addClass('atEnd');
				}
			}
		},

		prevAchievement: function() {
			// console.log(CN, '[prevAchievement]');
			if (PopUpManager.isDisplayed) return;

			let currentIndex = this.achievements.indexOf(this.currentAchievement);
			let prevAchievement = Math.max(currentIndex - 1, 0);
			if(this.selectAchievement(this.achievements.at(prevAchievement))) {
				this.doButtonClick('button.prev');
			}
		},

		nextAchievement: function() {
			// console.log(CN, '[nextAchievement]');
			if (PopUpManager.isDisplayed) return;

			let currentIndex = this.achievements.indexOf(this.currentAchievement);
			let nextIndex = Math.min(currentIndex + 1, this.achievements.length - 1);
			if(this.selectAchievement(this.achievements.at(nextIndex))) {
				this.doButtonClick('button.next');
			};
		},

		toggleAchievement: function() {
			// console.log(CN, '[toggleAchievement]');
			if (PopUpManager.isDisplayed) return;

			// Only achivements owned by the user has the 'isOn' property.
			const isOwned = this.currentAchievement.has('isOn');
			if(isOwned) {
				this.currentAchievement.set('isOn', !this.currentAchievement.get('isOn'));
	
				const activeItem = this.$('.achievement-item.active');
	
				if (this.currentAchievement.get('isOn')) {
					activeItem.find('input').prop( "checked", true );
					activeItem.addClass('checked');
					AudioManager.playSound('ding');
				} else {
					activeItem.find('input').prop( "checked", false );
					activeItem.removeClass('checked');
				}
				this.doButtonClick('button.select');
				this.updateVisualState();
			}
		},

		destroy: function() {
			BaseView.prototype.destroy.apply(this, arguments);

			if (this.disableInputManager) {
				InputManager.off("left", this.prevAchievement);
				InputManager.off("right", this.nextAchievement);
				InputManager.off("enter", this.toggleAchievement);
			}
		}
	});
});
