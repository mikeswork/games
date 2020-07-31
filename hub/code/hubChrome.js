define([
	'underscore',
	'js/router',
	'js/baseView',
	'js/hwpTvApi',
	'js/inputManager',
	'js/environment',
	'js/ga',
	'js/engine/hub/hubUserInfo',
	'text!html/engine/hub/hubChrome.html'
], function(_, Router, BaseView, HwpTvApi, InputManager, Environment, Analytics, UserInfo, ChromeHtml) {
	'use strict';
	var CN = '[HubChrome]';

	var HubChrome = BaseView.extend({
		className: 'hub-chrome',

		template: _.template(ChromeHtml),

		events: {
			'focus .hub-return-btn': 'expand',
			'blur .hub-return-btn': 'collapse',
			'click .hub-return-btn': () => {
				Router.exit();
			}
		},

		initialize: function(options) {
			// console.log(CN, '[initialize]', options);

			if (Environment.isInHub()) {
				console.info(CN, '[Running in Hub]');

				InputManager.add('hubchrome', {
					selector: '.hub-chrome-main .hub-return-btn'
				});

				this.userInfo = new UserInfo(Object.assign({}, options, {manuallyGrowXp: true}));

				// Forces view to render
				BaseView.prototype.initialize.apply(this, arguments);

				this.fetchMessages();
	
				// Every time we post to server is a potential change
				// to messages, so fetchMessages each time this happens
				HwpTvApi.on('posted', this.fetchMessages.bind(this));
			} else {
				console.info(CN, '[No HWP Hub detected]');
				this.$el.hide();
			}
		},

		fetchMessages: function() {
			// console.log(CN, '[fetchMessages]');

			if(this.isDisplaying || this.isFetching) {
				return Promise.resolve(this.options.messages);
			}
			
			// Set flag to indicate we are fetching data
			this.isFetching = true;
			return HwpTvApi.getUserUnreadMessages().then(messages => {
				// Unset fetching flag
				this.isFetching = false; 
				if (messages && messages.length) {
					// Store messages in chronological order
					this.options.messages = messages.sort((one, two) => {
						return one.created > two.created ? 1 : two.created > one.created ? -1 : 0;
					});
					
					if (this.isExpanded()) {
						this.displayNextMessage();
					} else {
						this.alert();
					}
				}
				return messages;
			});
		},

		render: function() {
			BaseView.prototype.render.apply(this, arguments);
			this.chromeMainEl = this.$el.find('.hub-chrome-main');
			this.chromeMainEl.prepend(this.userInfo.el);
		},

		hasMessages: function() {
			return this.options.messages && this.options.messages.length > 0;
		},

		isExpanded: function() {
			return this.$el && this.$el.hasClass('expanded');
		},

		expand: function() {
			// console.log(CN, '[expand]');
			
			if (!this.isExpanded()) {
				Analytics.sendEvent('HubDrawer', 'Expand');
				this.$el.addClass('expanded');
				this.chromeMainEl.removeClass('notifying');
				this.fetchMessages();
				this.userInfo.growXpBar();
			}
		},

		collapse: function() {
			// console.log(CN, '[collapse]');

			if (this.$el) {
				Analytics.sendEvent('HubDrawer', 'Collapse');
				this.$el.removeClass('expanded');
				this.userInfo.shrinkXpBar();
				if(this.hasMessages()) {
					this.alert();
				}
			}
		},

		alert: function() {
			// console.log(CN, '[alert]');

			if (!this.isExpanded() && !this.chromeMainEl.hasClass('notifying')) {
				this.chromeMainEl.addClass('notifying');
				this.wait(1000)
					.then(() => {
						this.chromeMainEl.removeClass('notifying');
					})
					.then(() => {
						return this.wait(1000);
					})
					.then(() => {
						this.alert();
					});
			}
		},

		displayNextMessage: function() {
			// console.log(CN, '[displayNextMessage]', { messages: this.options.messages });

			if (this.isExpanded() && !this.isDisplaying) {
				if (this.hasMessages()) {
					let message = this.options.messages[0];
					// Show message
					this.isDisplaying = true;
					this.replaceElement('.hub-alert-messages', message.message)
						.then(() => {
							if (this.isExpanded()) {
								// Wait 1/2 second
								return this.wait(500);
							} else {
								//  Do nothing
								return Promise.resolve();
							}
						})
						.then(() => {
							if (this.isExpanded()) {
								// Mark the message as read
								return HwpTvApi.setUserMessageAsRead(this.options.messages.shift().id);
							} else {
								// Do nothing
								return Promise.resolve();
							}
						})
						.then(() => {
							this.isDisplaying = false;

							if (this.isExpanded()) {
								// Display the next message
								this.displayNextMessage();
							} else {
								// Do nothing
								this.emptyMessage();
							}
						});
				} else {
					// Clear current message and check for more.
					this.emptyMessage().then(() => this.fetchMessages());
				}
			}
		},

		emptyMessage: function() {
			return this.replaceElement('.hub-alert-messages', '');
		}
	});

	return new HubChrome();
});
