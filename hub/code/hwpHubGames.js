console.log("[Starting Arcade.....]");

import $ from "jquery";
import Backbone from "backbone";
import Alerts from "../alerts";
import Environment from "../environment";
import GoogleAnalytics from "../ga";
import ArcadeConfig from "../arcadeConfig";
import AppAuthManager from "../hwptvAppAuthManager";
import HubChrome from '../engine/hub/hubChrome';
import Stats from "../performanceStats";
import { Arcade } from "../engine/arcade/arcade";

if (!Environment.isProd()) {
	var stats = new Stats();
	requestAnimationFrame(function updateStats() {
		stats.update();
		requestAnimationFrame(updateStats);
	});
	$("body").append(stats.domElement);
}

let contentUrl = "/hwpHubGames/json/arcadeData.json";
const sParams = new URLSearchParams(location.search);
if (sParams.has("gameType")) {
	contentUrl = `/hwpHubGames/json/${sParams.get("gameType")}.json`;
}

const arcade = new Arcade({ contentUrl });

// Wait for arcade data to load and then wait for authentication to complete
new Promise(resolve => arcade.on("initialized", resolve))
	.then(() => AppAuthManager.isReady())
	.finally(() => {
		console.log(`[Arcade Loaded][${arcade.arcadeState.get("arcadeName")}]`);

		ArcadeConfig.set({
			arcadeName: arcade.arcadeState.get("arcadeName")
		});

		var body = $("body").fadeOut(200, () => {
			body.removeClass("splashed")
				.append(Alerts.el)
				.append(arcade.el)
				.append(HubChrome.el)
				.queue(() => {
					body.dequeue().fadeIn();
				});

			GoogleAnalytics.sendEvent("Arcade", "launch");
			Backbone.history.start();
			
			if (document.referrer) {
				window.parent.postMessage("finishedLoading", document.referrer);
			}
		});
	});
