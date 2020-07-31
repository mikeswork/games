import $ from "jquery";
import Backbone from "backbone";
import Router from "../router";
import Alerts from "../alerts";
import Environment from "../environment";
import GoogleAnalytics from "../ga";
import ArcadeConfig from "../arcadeConfig";
import AppAuthManager from "../hwptvAppAuthManager";
import Stats from "../performanceStats";
import FontLoader from "../fontLoader";
import HwpTutorial from "../hwpTutorial";
import HubRoomManager, { ROOMS } from '../engine/hub/hubRoomManager';
import HubArcades from "../engine/hub/hubArcades";
import HubSections from "../engine/hub/hubSections";
import HubAchievements from "../engine/hub/hubAchievements";
import HubProfile from "../engine/hub/hubProfile";
import { HubRooms } from "../engine/hub/hubRooms";

// Tutorial Images
import TutorialSections from "../../img/hwpHub/tutorial-sections.png";
import TutorialContent from "../../img/hwpHub/tutorial-content.png";
import TutorialHubRooms from "../../img/hwpHub/tutorial-hub-rooms.gif";

// Room Thumbnails
import RoomTvThumb from "../../img/hwpHub/room-entertainment.png";
import RoomLibThumb from "../../img/hwpHub/room-library.png";

var CN = 'hwpHub';
var app = $('body');

if (!Environment.isProd()) {
	var stats = new Stats();
	requestAnimationFrame(function updateStats() {
		stats.update();
		requestAnimationFrame(updateStats);
	});
	app.append(stats.domElement);
}

ArcadeConfig.set({
	arcadeName: CN,
	arcadeTitle: 'Hollywood Player'
});

GoogleAnalytics.setPrefix(CN);

// Configure tv mode
app.addClass('tv');

var appPages = {
	home: {
		route: 'home',
		name: 'Hub',
		description: 'Hollywood Player',
		visiblePages: []
	}
};

const hubArcadesData = {
	disableInputManager: true,
	contentUrl: '/hwpHub/json/arcadeData.json'
};

const hubRoomsData = {
	disableInputManager: true,
	rooms: [
		{
			name: ROOMS.HOME,
			title: 'Home',
			thumbnail: RoomTvThumb
		},
		{
			name: ROOMS.LIBRARY,
			title: 'The Library',
			thumbnail: RoomLibThumb
		}
	]
}

const hubProfileData = {
	disableInputManager: true,
	inputManagerSections: [
		{
			name: 'registration-top',
			options: {
				selector: '.registration-page input:not([type=checkbox])',
				leaveFor: {
					left: '',
					up: '',
					right: '',
					down: '.registration-page input[type=checkbox]'
				}
			}
		},
		{
			name: 'registration-bottom',
			options: {
				selector:
					'.registration-page input[type=checkbox], .registration-page a, .registration-page button',
				leaveFor: {
					left: '',
					right: '',
					down: ''
				}
			}
		}
	]
};

let hubData = {
	pages: [
		{
			name: 'arcades',
			title: 'Play Games',
			content: HubArcades,
			data: hubArcadesData
		},
		{
			name: 'achievements',
			title: 'Achievements',
			content: HubAchievements,
			data: { disableInputManager: true }
		},
		{
			name: 'profile',
			title: 'View Profile',
			content: HubProfile,
			data: hubProfileData
		},
		{
			name: 'rooms',
			title: 'Move Rooms',
			content: HubRooms,
			data: hubRoomsData
		}
	]
};

// Register all routes for the app
Router.registerRoute(`*${appPages.home.route}`, appPages.home.name, HubSections, hubData);

// Create app views
const arcade = $('<div id="page"></div>');
const tutorial = new HwpTutorial({
	items: [
		{
			id: "menuTabs",
			selector: ".hub-sections > .sections",
			orientation: "column rightOf",
			style: {
				marginLeft: "24vw",
				width: "20%",
			},
			title: null,
			text:
				"Use your remote to scroll up and down to access games, view your Achievements, or view your Profile",
			icon: TutorialSections,
			exitButtons: ["up", "down"],
		},
		{
			id: "hubContent",
			selector: ".hub-sections .hub-arcade-nav",
			orientation: "row above",
			style: {
				width: "50%",
				margin: "auto",
				bottom: "27%",
				left: 0,
				right: 0,
			},
			title: "You're all set!",
			text: 'Use your remote to scroll left and right and press "OK" to select an item',
			icon: TutorialContent,
			exitButtons: ["left", "right", "enter"],
		},
		{
			id: "hubRooms",
			selector: ".hub-sections .sections .rooms",
			orientation: "row rightOf",
			style: {
				marginLeft: "24vw",
				top: "26vmin",
				width: "50%",
			},
			icon: TutorialHubRooms,
			title: "Congrats!",
			text:
				"You have unlocked the secret passage to the Library, where you can place your new achievements!",
			exitButtons: ["enter"],
		},
	],
});

// Preload all the things
var promises = [
	FontLoader.loadFonts(["Montserrat Regular", "Montserrat Black", "Gotham Rounded Book"]),
	HubRoomManager.isReady()
];

// Wait for preload to complete
Promise.all(promises).finally(function() {
	console.log('Application loaded');

	GoogleAnalytics.sendEvent('Arcade', 'launch');

	app.fadeOut(
		500,
		() => {
			app.removeClass('splashed')
				.append(Alerts.el)
				.append(tutorial.el)
				.append(HubRoomManager.el)
				.append(arcade)
				.queue(function() {
					Backbone.history.start();
					app.dequeue().fadeIn();
					
					if (document.referrer) {
						window.parent.postMessage('finishedLoading', document.referrer);
					}
				});
		}
	);
});