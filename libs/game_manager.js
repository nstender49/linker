// This file handles all socket.io connections and manages the serverside game logic.
var ENV = process.env.NODE_ENV || "dev";
var DEBUG = ENV === "dev";

BEARING = "bearing";
KEYSTROKE = "keystroke";

var socketio = require("socket.io");

var theWorld, players, messages;
var startTime;
var players = [];
var messages = [];

var logFull = true;

function makeWorld() {
	var t = new Date().getTime();
	return {
		width: 5000,
		height: 5000,
		players: [],
		bullets: [],
		DEBUG: true,
		t: t,
		startTime: t,
	}
}

//////////  Socket.io  \\\\\\\\\\
module.exports.listen = function(app) {
	io = socketio.listen(app);

	theWorld = makeWorld();

	io.on("connection", function(socket) {
		handleNewConnection(socket);

		socket.on("disconnect", function() {
			handleDisconnect(socket);
		});

		socket.on("player message", function(msg) {
			msg.id = socket.id;
			msg.t = new Date().getTime();
			messages.push(msg);
		});
	});
	return io;
};

//////////  Functions  \\\\\\\\\\

module.exports.tick = tick;

var FPS = 30;
var SEC_PER_FRAME = 1000 / FPS;
var serverDelay = 120; 
var i = 0;

function tick() {
	var newTime = new Date().getTime();
	// Process messages, delayed by 120ms (4 frames)
	while (theWorld.t < newTime - serverDelay) {
		messages.sort((a, b) => a.t < b.t);
		processMessages(theWorld.t);
		updateBullets(1);
		updatePlayers(1);
		theWorld.t += 30;
		if ((theWorld.t -  theWorld.startTime) % 120 === 0) {
			// console.log(`EMITTING ${theWorld.t} ${theWorld.players.length}`);
			// Emit world to players
			if (theWorld.players.length > 0) {
				// console.log(`AT t = ${theWorld.t}, PROCESSED ${theWorld.players[0].lastMessage}`)
			}
			for (var player of players) {
				player.socket.emit("update world", theWorld);
			}
		}
	}
	setImmediate(tick);
}

///////// Events / messages \\\\\\\\\\\

function processMessages(t) {
	index = 0;
	while (index < messages.length) {
		var msg = messages[index];
		if (msg.t < t - 30) {
			// console.log(`!!!!!!!!!!!!!!!!!!! MESSAGE BACKWARD IN TIME! ${msg.t} vs ${t} !!!!!!!!!!!!!!!!!!!!!!!!!!`);
		}
		//console.log(`Found msg: ${msg.t} ${msg.type}`);
		if (msg.t >= t) {
			break;
		}
		var player = getWorldPlayerById(msg.id);
		if (!player) continue;
		player.lastMessage = Math.max(msg.seq, player.lastMessage);
		console.log(`\tPROCESSING MESSAGE at ${msg.t - theWorld.startTime} for time interval ${t - theWorld.startTime}  ---- ${msg.type}`);
		switch (msg.type) {
			case KEYSTROKE:
				// console.log(`HANDLING KEY: ${msg.key} ${msg.down} FOR ${msg.id} at ${msg.t} vs ${t}`);
				handleKeyMessage(player, msg.key, msg.down);
				break;
			case BEARING:
				// console.log(`HANDLING BEARING: ${msg.bearing} FOR ${msg.id} at ${msg.t} vs ${t}`);
				player.bearingGoal = msg.bearing;
				break;
		}
		index++;
	}
	messages.splice(0, index);
}

function handleKeyMessage(player, key, down) {
	switch (key) {
		case 87:	// w
		case 38:	// up arrow
			player.acceleratingForward = down;
			break;
		case 83:	// s
		case 40:	// down arrow
			player.acceleratingBackward = down;
			break;
		default:
			break;
	}
}

////// Utils \\\\\\\\

function mod(n, m) {
	return ((n % m) + m) % m;
}

function round(val, digits) {
	return Math.floor(Math.abs(val) * Math.pow(10, digits)) / Math.pow(10, digits) * Math.sign(val);
}

/////// Game logic \\\\\\\
function updatePosition(obj, frames) {
	var rad = obj.bearing * Math.PI / 180;
	var cos = Math.cos(rad);
	var offX = Math.abs(obj.length / 2 * cos);
	obj.x = round(Math.min(theWorld.width - offX, Math.max(offX, obj.x + frames * obj.speed * cos)), 2);
	var sin = Math.sin(rad);
	var offY = Math.abs(obj.length / 2 * sin);
	obj.y = round(Math.min(theWorld.height - offY, Math.max(offY, obj.y + frames * obj.speed * sin)), 2);
}

var FRICTION = 0.04;
function updateShip(ship, frames) {
	// if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	console.log(`UPDATING SHIP ${(theWorld.t- theWorld.startTime)} ${ship.lastMessage}  ${ship.x} ${ship.y} ${ship.speed} ${ship.acceleratingForward} ${ship.acceleratingBackward} ${ship.bearing}`);
	// Update speed, acceleration, and position
	ship.speed *= (1 - FRICTION * frames);
	if (ship.acceleratingForward) {
		ship.speed += frames * ship.forwardAcceleration;
	}
	if (ship.acceleratingBackward) {
		ship.speed -= frames * ship.reverseAcceleration;
	}
	ship.speed = Math.min(ship.maxForwardSpeed, Math.max(ship.maxReverseSpeed, round(ship.speed, 2)));
	updatePosition(ship, frames);
	// Update bearing
	var diff = (ship.bearingGoal - ship.bearing + 360) % 360;
	diff = diff > 180 ? diff - 360 : diff;
	ship.bearing = round(mod(ship.bearing + Math.min(frames * ship.maxTurn, Math.abs(diff)) * Math.sign(diff), 360), 2);
}

function updatePlayers(frames) {
	for (var player of theWorld.players) {
		updateShip(player, frames);
	}
}

function updateBullet(bullet, frames) {
	updatePosition(bullet, frames);
}

function updateBullets(frames) {
	for (var i = theWorld.bullets.length - 1; i >= 0; i--) {
		var bullet = theWorld.bullets[i];
		updateBullet(bullet, frames);
		if (
			bullet.x - bullet.length < 0 || 
			bullet.x + bullet.length > theWorld.width ||
			bullet.y - bullet.length < 0 ||
			bullet.y + bullet.length > theWorld.height
		) {
			theWorld.bullets.splice(i, 1);
		}
	}
}

//////////// Connection logic \\\\\\\\\\\\\\\\

function handleNewConnection(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	players.push({
		socket: socket,
	})
	var newPlayer = makeNewPlayer(socket.id);
	theWorld.players.push(newPlayer);
	socket.emit("enter game", theWorld, newPlayer);
}

function makeNewPlayer(id) {
	return {
		id: id,
		lastMessage: -1,
		x: 200,
		y: 200,
		// Size
		width: 40,
		length: 60,
		// Movementw
		speed: 0,
		maxForwardSpeed: 20,
		maxReverseSpeed: -4,
		acceleratingForward: false,
		acceleratingBackward: false,
		forwardAcceleration: 1,
		reverseAcceleration: 0.2,
		// Angle, and max angle turn per tick, in degrees.
		bearingGoal: 0,
		bearing: 0,
		maxTurn: 2,
	}
}

function handleDisconnect(socket) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	var worldPlayer = getWorldPlayerById(socket.id);
	if (worldPlayer) {
		var index = theWorld.players.indexOf(worldPlayer);
		theWorld.players.splice(index, 1);
	}
	var player = getPlayerById(socket.id);
	if (player) {
		var index = players.indexOf(player);
		players.splice(index, 1);
		socket.emit("update world", false);
	}
}

function getWorldPlayerById(id) {
	for (var player of theWorld.players) {
		if (player.id === id) {
			return player;
		}
	}
	return false;
}

function getPlayerById(id) {
	for (var player of players) {
		if (player.socket.id === id) {
			return player;
		}
	}
	return false;
}