define([
	'underscore',
	'js/router',
	'js/hwpTvApi',
	'js/baseView',
	'js/inputManager',
	'js/engine/registration',
	'js/engine/hub/achievementsManager',
	'js/engine/hub/hubUserInfo',
	'js/popupManager',
	'text!html/engine/hub/hubProfile.html',
	'text!html/privacyPolicyPopup.html',
	'text!html/termsOfServicePopup.html'
], function(
	_,
	Router,
	HwpTvApi,
	BaseView,
	InputManager,
	Registration,
	AchievementsManager,
	UserInfo,
	PopUpManager,
	TemplateHtml,
	PrivacyPolicyTemplate,
	TermsOfServiceTemplate
) {
	'use strict';
	var CN = '[HubProfile]';

	AchievementsManager = AchievementsManager.default;
	PopUpManager = PopUpManager.PopUpManager;

	return BaseView.extend({
		className: 'hub-profile',

		template: _.template(TemplateHtml),

		disableInputManager: false,

		events: {
			'click button.profile-btn': 'editProfile'
		},

		initialize: function(options) {
			// console.log(CN, '[initialize]', { options });
			
			this.userInfo = new UserInfo(Object.assign({}, options, {manuallyGrowXp: true}));
			BaseView.prototype.initialize.apply(this, arguments);

			if (!this.disableInputManager) {
				console.warn({ disableInputManager: this.disableInputManager });
				
				InputManager.add('hubProfile', {
					selector: '.hub-profile > .button-container button'
				});
			}

			this.$el.addClass('loading');
			
			this.userInfo.onReady().then(() => {
				this.$el.removeClass('loading');
				this.render();
				this.userInfo.growXpBar();
			}, () => { console.log("Failed to load user info.") });

			HwpTvApi.getUserStats().then(stats => {
				Object.assign(this.options, stats);
				this.render();
			}, () => { console.log("Failed to load user stats.")} )
		},

		onBack: function() {
			// console.log(CN, '[onBack]');

			if(PopUpManager.isDisplayed) {
				PopUpManager.nextPopUp().then(() => this.focusInput());
			} else if(this.popupIsOpen) {
				this.dismissEditProfile();
			}
		},

		render: function() {
			BaseView.prototype.render.apply(this, arguments);

			// After main template loads, we can insert userInfo $el
			this.$('.content-placeholder').replaceWith(this.userInfo.$el);

			// Adjust visuals after user info has loaded
			if (this.userInfo && this.userInfo.user) {
				if (this.userInfo.user['email']) {
					this.$el.addClass('logged-in');
					this.$el.find('button.profile-btn').addClass('edit');
				} else {
					this.$el.find('button.profile-btn').addClass('create');
				}

				if (this.disableInputManager) {
					this.addKeyListeners();

					// .active class allows us to make button pulse, etc. even though it's not in focus()
					this.$el.find('button.profile-btn').addClass('active')
				}
			}

			// Show stats only if the data has loaded
			if (this.options.triviaAccuracy !== undefined || 
				this.options.triviaRank !== undefined || 
				this.options.numberOfAchievements !== undefined) {
					
				this.$el.find('.stats').show();
			}
		},

		addKeyListeners: function() {
			if(!this.listeners) {
				this.listeners = { enter: () => this.doButtonClick(this.$("button.profile-btn")) };
			}
			InputManager.on("enter", this.listeners.enter);
		},

		removeKeyListeners: function() {
			if(this.listeners) {
				InputManager.off("enter", this.listeners.enter);
			}
		},

		doButtonClick: function(button) {
			// console.log(CN, '[doButtonClick]', button);
			if (PopUpManager.isDisplayed) return;

			button.trigger("click");
			button.removeClass("clicked");
			this.wait(0).then(() => {
				button.addClass("clicked");
			});
		},

		/**
		 * Prep the registration component and place into display to allow users to update the information
		 */
		editProfile: function() {
			if(this.popupIsOpen) return;
			// console.log(CN, '[EditProfile]');
			
			if (this.disableInputManager) {
				this.removeKeyListeners();
			}
			
			this.popupIsOpen = true;
			
			this.oldRouterBack = Router.back;
			Router.back = this.onBack.bind(this);

			if (!this.registration) {
				// Create ther registration module once
				const user = this.userInfo.user || {};
				const fields = [
					{ name: 'email', label: 'Email Address', type: 'email', value: user.email },
					{ name: 'firstName', label: 'First Name', value: user.firstName },
					{ name: 'lastName', label: 'Last Name', value: user.lastName },
					{ name: 'acceptPrivacy', label: 'Accept Terms &  Conditions:', type: 'checkbox' },
					{ label: 'Privacy Policy', type: 'popuplink', popupContent: PrivacyPolicyTemplate },
					{ label: 'Terms of Service', type: 'popuplink', popupContent: TermsOfServiceTemplate }
				];

				// If InputManager sections are being overridden, create new Registration object with this option
				this.registration = this.inputManagerSections 
					? new Registration({ "fields": fields, "inputManagerSections": this.inputManagerSections }) 
					: new Registration({ "fields": fields});

				// Add event listener for user completes registration
				this.registration.on("close", this.dismissEditProfile.bind(this));
				this.registration.on('registrationComplete', this.onRegistrationComplete.bind(this));
				this.registration.on('registrationFailed', this.onRegistrationFailed.bind(this));
			} else {
				// Update registration field values before rendering
				this.registration.fields.forEach(field => {
					let userProp = field.name;
					if (this.userInfo.user && this.userInfo.user[userProp]) {
						field.value = this.userInfo.user[userProp];
					}
				});

				this.registration.render();

				// Delegate events in case $el was removed from view
				this.registration.delegateEvents();
			}

			this.replaceView(this.registration.el).then(null, null, () => {
				// Registration added to DOM. Focus first input.
				this.focusInput();
			});
		},

		focusInput: function() {
			// console.log(CN, '[focusInput]');
			this.$("input").first().focus();
		},

		/**
		 * Handler for when user succesfully updates their information
		 */
		onRegistrationComplete: function() {
			// console.log(CN, 'onRegistrationComplete]', { userData });

			AchievementsManager.fetchAchievements();
			this.userInfo.fetchData();
			HwpTvApi.getUserStats().then(stats => Object.assign(this.options, stats));

			this.wait(3000)
				.then(() => this.dismissEditProfile());
		},

		/**
		 * Handler for when a user fails to update their information
		 */
		onRegistrationFailed: function() {
			// console.log(CN, 'onRegistrationFailed');
			console.error('Failed to register user');
			this.wait(3000).then(() => this.dismissEditProfile());
		},

		/**
		 * Dismisses the current view and re-renders the main profile
		 */
		dismissEditProfile: function() {
			// console.log(CN, '[dismissEditProfile]');

			this.dismissView().then(() => {
				if (this.disableInputManager) {
					this.addKeyListeners();
					InputManager.focus('hub-sections');
				}
				
				this.registration.destroy();
				this.registration = undefined;
				
				if(this.oldRouterBack) {
					Router.back = this.oldRouterBack;
					this.oldRouterBack = null;
				}

				this.render();

				this.popupIsOpen = false;
				return this.displayView();
			});
		},

		destroy: function() {
			BaseView.prototype.destroy.apply(this, arguments);
			if(this.oldRouterBack) {
				Router.back = this.oldRouterBack;
				this.oldRouterBack = null;
			}

			if (this.disableInputManager) {
				this.removeKeyListeners();
			}
		}
	});
});
