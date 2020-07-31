define([
	'underscore',
	'js/hwpTvApi',
	'js/baseView',
	'js/hwptvAppAuthManager',
	'text!html/engine/hub/hubUserInfo.html'
], function(_, HwpTvApi, BaseView, HwpTvAppAuthManager, TemplateHtml) {
	'use strict';
	var CN = '[HubUserInfo]';

	return BaseView.extend({
		className: 'hub-user-info loading',

		template: _.template(TemplateHtml),
		manuallyGrowXp: false,

		initialize: function(options) {
			// console.log(CN, '[initialize]', { options });
			BaseView.prototype.initialize.apply(this, arguments);

			this.fetchData();

			// Every time we post to server is a potential change to
			// xp, so fetchData each time this happens and re-render
			HwpTvApi.on("posted", this.fetchData.bind(this));
			window.addEventListener('message', (event) => {
				if (typeof event.data == 'string' && event.data == 'returnToHub') {
					this.fetchData();
				}
			});
		},

		/**
		 * Fetch the latest data and re-render
		 */
		fetchData: function() {
			// console.log(CN, '[fetchData]');

			return HwpTvAppAuthManager.isReady()
				.then(() => {
					return HwpTvApi.getUser();
				})
				.then(
					user => {
						this.options.user = user;
						this.$el.removeClass('loading');

						this.user = this.options.user;  // For more convenient external access

						if (!user.email) {
							this.$el.addClass('as-guest');
						} else {
							this.$el.removeClass('as-guest');
						}
						
						this.render();

						if (!this.manuallyGrowXp) this.growXpBar();

						this.onReady().resolve(user);
					},
					error => {
						console.error('Error fetching profile data:', error.message);
					}
				);
		},

		growXpBar: function() {
			clearTimeout(this.growXpTimeout);

			this.growXpTimeout = setTimeout(() => {
				this.$el.addClass('grow');

				clearTimeout(this.growXpTimeout);
			}, 700)
		},

		shrinkXpBar: function() {
			this.$el.removeClass('grow');
		},

		onReady: function() {
            // console.log(CN, '[onReady]');

            if (!this.readyPromise) {
                this.readyPromise = new $.Deferred();
            }

            return this.readyPromise;
        }
	});
});
