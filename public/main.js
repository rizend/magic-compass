/*
Modes of interest
- commander - mapping for one
- mapping all
- one to one, map or compass
- <wild dream> text / voice / video for all
- check for lost connection
- setup screen
- allow reconnecting
- e2e encryption
*/
let room = location.hash.length >= 2 ? location.hash.substr(1) : location.hash.substr(1);
let idSent = false;
let ws;

function say(txt) {
	let p = document.getElementById("p");
	p.innerText = txt;
}

const loadingAnimation = (function(say) {
	const LOADING_CHARS = "/-\\|";
	const LOADING_INTERVAL = 400;
	let interval = undefined;
	let animationIndex = 0;
	function isRunning() {
		return interval !== undefined;
	}
	function animate() {
		if (animationIndex >= LOADING_CHARS.length) {
			animationIndex = 0;
		}
		say(LOADING_CHARS[animationIndex]);
		animationIndex++;
	}
	function start() {
		if (isRunning()) {
			throw new Error("Animation is already running!");
		}
		animationIndex = 0;
		interval = setInterval(animate, LOADING_INTERVAL);
	}
	function stop() {
		if (isRunning()) {
			clearInterval(interval);
			interval = undefined;
		}
	}
	return {isRunning, start, stop};
})(say);

function send(data) {
	if (data === undefined) {
		throw new Error("blah!");
	}
	if (typeof data !== "string") {
		data = JSON.stringify(data);
	}
	console.log("sending", data);
	if (!ws) {
		throw new Error("websocket is not open!");
	}
	ws.send(data);
}
function sendGeo(data) {
	if (idSent) {
		send(data);
	}
}
if (room) {
	ws = new WebSocket(`wss://${location.host}/wbiE`);
	ws.onopen = function () {
		console.log('open!', room);
		ws.send(room);
		if (geo.lastPoint) {
			send(geo.lastPoint);
		}
	};
	ws.onerror = function (error) {
		ws = null;
		console.log('WebSocket Error ' + error);
		say('!');
		console.log('said');
	};
	function onClose() {
		clearInterval(closeCheckInterval);
		console.log('close!');
		say('_');
	}
	const closeCheckInterval = setInterval(function() {
		if (ws.readyState === 3) {
			console.log('alt close');
			onClose();
		}
	}, 700);
	ws.onclose = function() {
		onClose();
	}
	ws.onmessage = function (e) {
		console.log('Server: ' + e.data);
		let msg = JSON.parse(e.data);
		if (msg.typ === "loading") {
			loadingAnimation.start();
		} else if(msg.typ === "char") {
			loadingAnimation.stop();
			say(msg.char);
		} else {
			loadingAnimation.stop();
			console.log("Unknown message typ: %s", msg.typ);
		}
		if (!window.idSent) {
			window.idSent = true;
		}
	};
}
/*
window.addEventListener("deviceorientation", handleOrientation, true);
function handleOrientation(event) {
	let {absolute, alpha, beta, gamma} = event;
}

coords.latitude	double	decimal degrees
coords.longitude	double	decimal degrees
coords.altitude	double or null	meters above the reference ellipsoid
coords.accuracy	double	meters
coords.altitudeAccuracy	double or null	meters
coords.heading	double or null	degrees clockwise from true north
coords.speed	double or null	meters/second
timestamp
*/
let geo = (function() {
	let state = {
		running: false,
		success: undefined,
		onGeo: undefined
	};
	function geo_success(position) {
			const {latitude, longitude, altitude, accuracy, altitudeAccuracy, heading, speed} = position.coords;
			state.success = true;
			const lastPoint = {latitude, longitude, altitude, accuracy, altitudeAccuracy, heading, speed};
			console.log(lastPoint);
			state.onGeo && state.onGeo(lastPoint);
			state.lastPoint = lastPoint;
	}
	function geo_error(err) {
		alert(`Sorry, no position available (${err.message})`);
		state.success = false;
		state.running = false;
		if (state.onerror) {
			return state.onerror(err);
		}
	}
	const geo_options = {
		enableHighAccuracy: true, 
		maximumAge : 30000, 
		timeout : 3000
	};
	let watch_position_id;
	function stop() {
		if (state.running) {
			navigator.geolocation.clearWatch(watch_position_id);
			watch_position_id = undefined;
			state.running = false;
		}
	}
	function start() {
		if (!state.running) {
			state.running = true;
			watch_position_id = navigator.geolocation.watchPosition(geo_success, geo_error, geo_options);
		}
	}
	return Object.assign(state, {start, stop});
})();
geo.onGeo = coords => {
	console.log(coords);
	sendGeo(JSON.stringify(coords));
};
geo.start();
