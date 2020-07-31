define(['js/baseView', 'js/redCarpetCollection', 'text!html/engine/hub/hubPosterWidget.html'], function(
	BaseView,
	RedCarpetCollection,
	TemplateHtml
) {
	'use strict';
	var CN = '[HubPosterWidget]';

	var Module = BaseView.extend({
		className: 'hub-poster-widget',

		template: _.template(TemplateHtml),

		initialize: function(options) {
			// console.log(CN, '[initialize]', { options });

			BaseView.prototype.initialize.apply(this, arguments);

			this.receiveMessage = this.receiveMessage.bind(this);

			this.data = new RedCarpetCollection([], options);
			this.data.on('initialized', () => {
				this.fetchData();
				window.addEventListener('message', this.receiveMessage);
			});
		},

		fetchData() {
			// console.log(CN, '[fetchData]');

			this.data
				.fetch()
				.then(() => {
					return this.data.find(item => item.get('winner'));
				})
				.then(userPicked => {
					if(userPicked) {
						let image = userPicked.get('altImage') || userPicked.get('image');
						if(this.options.image != image) {
							this.options.image = image;
							this.render();
						}
					}
				});
		},

		receiveMessage: function(event) {
			// console.log(CN, '[receiveMessage]', event);

			if (typeof event.data == 'string' && event.data == 'returnToHub') {
				this.fetchData();
			}
		},

		destroy: function() {
			window.removeEventListener('message', this.receiveMessage);
			BaseView.prototype.destroy.apply(this, arguments);
		}
	});

	return Module;
});
