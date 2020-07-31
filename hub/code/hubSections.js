define([
	'underscore',
	'js/baseView',
	'js/inputManager',
	'js/engine/hub/achievementsManager',
	'js/engine/hub/hubRoomManager',
	'js/engine/hub/hubUserInfo',
	"js/popupManager",
	'text!html/engine/hub/hubSections.html'
], function(_, BaseView, InputManager, AchievementsManager, HubRoomManager, UserInfo, PopUpManager, TemplateHtml) {
	'use strict';
	var CN = '[HubSections]';

	AchievementsManager = AchievementsManager.default;
	HubRoomManager = HubRoomManager.default;
	PopUpManager = PopUpManager.PopUpManager;

	return BaseView.extend({
		className: 'hub-sections',

		template: _.template(TemplateHtml),

		events: {
			'focus .section': 'onSectionFocused',
			'click .section': 'onSectionFocused'
		},

		initialize: function(options) {
			// console.log(CN, '[initialize]', { options });

			// Initialize module stuff
			this.currentSectionIndex = undefined;
			BaseView.prototype.initialize.apply(this, arguments);

			InputManager.add('hub-sections', {
				selector: '.hub-sections .section',
				enterTo: 'last-focused'
			});

			this.userInfo = new UserInfo(options);
			this.$('.section#profile').append(this.userInfo.el);

			this.checkRoomsAvailable();
			
			HubRoomManager.on("roomChanging", () => this.dismissView());
			HubRoomManager.on("roomChanged", () => {
				console.log(CN, "[roomChanged]");
				// Change sections almost immediately
				this.focusFirstSection(0).then(() => {
					// Start displaying view
					this.displayView();
					// Call focusFirstSection() again without an override duration to focus on the DOM element
					this.focusFirstSection();
				});
			});
			
			// Schedule activation of first section
			this.wait().then(() => this.focusFirstSection());
		},

		checkRoomsAvailable: function() {
			if(HubRoomManager.unlockedRooms.length > 1) {
				this.$('.section#rooms').addClass('unlocked');
			}
		},

		focusFirstSection: function(duration) {
			// console.log(CN, '[focusFirstSection]', {duration});

			InputManager.makeFocusable();
			let firstSection = this.$(".section")
				.filter((index, item) => {
					const height = $(item).height();
					const hasHeight = !!height;
					return hasHeight;
				})
				.get(0);
			
			if(Number.isInteger(duration)) {
				firstSection = this.pages.find((section) => (section.name == firstSection.id));
				return this.activateSection(firstSection, duration)
			} else {
				InputManager.focus(firstSection);
			}
		},

		// focusNextSection: function() {
		// 	console.log(CN, '[focusNextSection]');
		// 	this.activateSection(this.pages[this.currentSectionIndex+1]);
		// },

		// focusPreviousSection: function() {
		// 	console.log(CN, '[focusPreviousSection]');
		// 	this.activateSection(this.pages[this.currentSectionIndex-1]);
		// },

		onSectionFocused: function(event) {
			this.checkRoomsAvailable();
			
			const sectionId = event.target.id;
			const section = this.pages.find(section => section.name == sectionId);
			// console.log(CN, '[onSectionFocused]', { sectionId, section, event });

			return this.activateSection(section);
		},

		activateSection: function(section, duration) {
			// console.log(CN, "[activateSection]", { section, duration });

			const currentSection = this.pages[this.currentSectionIndex] || {};

			if (section && section.content) {
				if(section.name == currentSection.name) {
					// console.debug(CN, "[activateSection][sectionAlreadyActive]");
					return Promise.resolve();
				}
				
				// Update current section index
				this.currentSectionIndex = this.pages.indexOf(section);

				// Remove active class that's currently on any sections
				this.$('.section').removeClass('active');

				// Update the content with the new section content
				const Engine = section.content;
				const newContent = new Engine(section.data);

				return this.replaceElement(".content", newContent.el, duration).then(null, null, () => {
					// Addd active class to the section's tab
					let activeSection = this.pages[this.currentSectionIndex];
					this.$(`.${activeSection.name}`).addClass("active");
					
					// Destroy old content
					if (this.currentContent && this.currentContent.destroy) {
						this.currentContent.destroy();
					}
					// Save reference to new content
					this.currentContent = newContent;
				});
			} else {
				console.warn(CN, "[Invalid Hub Section]", { section, currentSection });
				return Promise.reject('Invalid Hub Section');
			}
		}
	});
});
