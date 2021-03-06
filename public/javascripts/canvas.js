// This file manages the game's logic for most visual things and contains various functions
// for drawing on and manipulating the canvas, used by the game client.

//////////  Canvas  \\\\\\\\\\
function init() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	canvas = document.getElementById("game-canvas");
	ctx = canvas.getContext("2d");

	document.body.style.backgroundColor = BACKGROUND_COLOR;

	handleResize();
}

function animate() {
	requestAnimFrame(animate);
	tick();
}

//////////  Events  \\\\\\\\\\

var bearingCooldown = 60;
var lastBearingChange;
var lastBerringGoal;
function handleMouseMove(event) {
	if (!theWorld) return;
	var gameTime = new Date().getTime();
	if (lastBearingChange && (gameTime - lastBearingChange < bearingCooldown)) {
		return;
	}
	lastBearingChange = gameTime;
	var bearingGoal = Math.round(getAngle(event.pageX - canvas.width / 2, event.pageY - canvas.height / 2));
	if (lastBerringGoal !== bearingGoal) {
		emitMessage({type: BEARING, bearing: bearingGoal});
	}
}

function handleMouseDown(event) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	handleKey(32, true);
}

function handleMouseUp(event) {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	handleKey(32, false);
}

function handleKeyDown(event) {
	handleKey(event.keyCode, true);
}

function handleKeyUp(event) {
	handleKey(event.keyCode, false);
}

function handleKey(key, down) {
	if (!theWorld) return;
	emitMessage({type: KEYSTROKE, key: key, down: down});
}

function processMessages(t) {
	// console.log(`PROCESSING ${messages.length} MESSAGES ${t} ${thePlayer.lastMessage} ${messages[0].seq}`);
	// Process messages for next frame, that is, from t -> t + 30;
	// console.log(`process msg ${t}`);
	purgeIndex = 0;
	for (var i = 0; i < messages.length; i++) {
		var msg = messages[i];
		if (msg.seq <= thePlayer.lastMessage) {
			purgeIndex = i;
			continue;
		}
		if (msg.t >= t) {
			break;
		}
		console.log(`\tPROCESSING MESSAGE at ${msg.t - theWorld.startTime} for time interval ${t - theWorld.startTime}`);
		switch (msg.type) {
			case KEYSTROKE:
				// console.log(`HANDLING KEY: ${msg.key} ${msg.down} FOR ${msg.id} at ${msg.t} vs ${t}`);
				handleKeyMessage(thePlayer, msg.key, msg.down);
				break;
			case BEARING:
				// console.log(`HANDLING BEARING: ${msg.bearing} FOR ${msg.id} at ${msg.t} vs ${t}`);
				thePlayer.bearingGoal = msg.bearing;
				break;
		}
	}
	messages.splice(0, purgeIndex);
}

var firing = false;
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
		case 32:	// spacebar
			firing = down;
			break;
		default:
			break;
	}
}

/*
	dpi = window.devicePixelRatio;
	let style_height = +getComputedStyle(canvas).getPropertyValue("height").slice(0, -2);
	let style_width = +getComputedStyle(canvas).getPropertyValue("width").slice(0, -2);
	console.log(`${style_width} ${style_height} ${window.innerWidth} ${window.innerHeight} ${canvas.offsetWidth} ${canvas.offsetHeight}`);
	style_height = window.innerHeight;
	style_width = window.innerWidth;
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	if (style_height === 0 || style_width < style_height * aspect) {
		canvas.width = style_width;
		canvas.height = style_width / aspect;
		r = canvas.width / 1000;
	} else {
		canvas.width = style_height * aspect;
		canvas.height = style_height;
 		r = canvas.height * aspect / 1000;
	}
*/

function handleResize() {
	if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
}

////// Utils \\\\\\\\\
function getAngle(x, y) {
	var res = Math.atan2(-y, -x) / Math.PI * 180 + 180;
	return res;
}

function mod(n, m) {
	return ((n % m) + m) % m;
}

function round(val, digits) {
	return Math.floor(Math.abs(val) * Math.pow(10, digits)) / Math.pow(10, digits) * Math.sign(val);
}

///// Game logic \\\\\\

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
	console.log(`UPDATING SHIP ${tickTime - theWorld.startTime} ${ship.x} ${ship.y} ${ship.speed} ${ship.acceleratingForward} ${ship.acceleratingBackward} ${ship.bearing}`);
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
		if (playerId === player.id) {
			thePlayer = player;
			// console.log("FOUND PLAYER WHILE UPDATING PLAYERS: " + thePlayer.id + " " + thePlayer.lastMessage);
			continue;
		}
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
		} else {
			drawBullet(bullet);
		}
	}
}

var shootCooldown = 0;
function shoot() {
	if (shootCooldown > 0) {
		shootCooldown--;
		return;
	}
	if (!firing) { return; }
	shootCooldown = 20;
	theWorld.bullets.push({
		x: thePlayer.x + Math.cos(thePlayer.bearing * Math.PI / 180) * thePlayer.length / 2,
		y: thePlayer.y + Math.sin(thePlayer.bearing * Math.PI / 180) * thePlayer.length / 2,
		speed: thePlayer.speed + 15,
		bearing: thePlayer.bearing,
		width: 2,
		length: 5,
	})
}

var serverDelay = 120;
var tickTime, remoteTickTime;
var i = 0;
var thePlayer;

function tick() {
	// Throttle tick
	var newTime = new Date().getTime();
	if (tickTime && newTime - tickTime < 30) {
		return;
	}
	// Clear canvas
	drawRect(BACKGROUND_COLOR, 0, 0, canvas.width, canvas.height);

	if (worlds.length === 0) {
		// console.log("FIRST EMPTY?");
		drawText(0.5, 0.5, 50, "Waiting for server...");
		return;
	}

	var remoteTime = newTime - serverDelay;
	var remoteWorldTime = theWorld.startTime + Math.floor((remoteTime - theWorld.startTime) / 120) * 120;
	// Find the right remote world view.
	var index = 0;
	// console.log(`CURRENT TIME ${newTime}, REMOTE TIME ${remoteTime}, MOD: ${theWorld.startTime % 120}, FINDING WORLD WITH TIME ${remoteWorldTime} (current head ${worlds[0].t})`);
	while (index < worlds.length && worlds[index].t < remoteWorldTime) {
		// console.log(`\tWORLD TIME AT ${index} (of ${worlds.length}): ${worlds[index].t}`);
		index++;
	}
	if (index > 0 && worlds.length > 1) {
		console.log(`NEW WORLD!!!! ${index} ${worlds.length}`);
		theWorld = worlds[index];
		remoteTickTime = theWorld.t;
		tickTime = theWorld.t;
		worlds.splice(0, index);
	}
	// console.log(`END OF SEARCH: ${index} ${worlds.length}`);
	// console.log(`UPDATING FROM WORLD AT ${theWorld.t}: ${worlds.length}`);

	// Update remote players up to 120ms in the past.
	// console.log(`ADVANCING FROM ${remoteTickTime} -> ${remoteTime}`);
	// console.log(`${playerId} ${thePlayer} ${thePlayer ? thePlayer.id : 0}`);
	while (remoteTickTime < remoteTime) {
		updatePlayers(1);
		updateBullets(1);
		remoteTickTime += 30;
	}
	// console.log(`${playerId} ${thePlayer} ${thePlayer ? thePlayer.id : 0}`);
	// Update player with local messages
	console.log(`!!!!!!!!!!!!!!!!!! NEW CALCULATION OF PLAYER STARTING FROM ${tickTime - theWorld.startTime} -> ${newTime - theWorld.startTime} !!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
	while (tickTime < newTime) {
		processMessages(tickTime);
		// console.log(`tick ${tickTime} -> ${tickTime + 30} ... ${worlds.length} ${thePlayer}`)
		updateShip(thePlayer, 1);
		tickTime += 30;
	}

	// Do stuff that depends on player frame.
	drawGrid();
	shoot();

	// Always draw the player on top.
	drawPlayers();
	drawShip(thePlayer);
	drawBullets();

	if (theWorld.DEBUG) {
		drawText(0.95, 0.95, 15, `(${thePlayer.x}, ${thePlayer.y}, ${thePlayer.bearing}) ${thePlayer.speed}`);
	}
}

//////////  Drawing  \\\\\\\\\\

function drawText(x, y, size, text) {
	ctx.strokeStyle = "black";
	ctx.fillStyle = "black";
	ctx.textBaseline = "center";
	ctx.textAlign = "right";
	ctx.font = `${size}px Arial`;
	ctx.fillText(text, canvas.width * x, canvas.height * y);
}

function drawGrid() {
	var gridSize = 100;
	var widthStart = Math.max(0, Math.floor((thePlayer.x - canvas.width / 2) / gridSize));
	var widthEnd = Math.min(theWorld.width / gridSize, Math.floor((thePlayer.x + canvas.width / 2) / gridSize));
	for (var i = widthStart; i <= widthEnd; i++) {
		ctx.save();
		ctx.translate(canvas.width / 2 + i * gridSize - thePlayer.x, canvas.height / 2);
		ctx.beginPath();
		ctx.moveTo(0, -Math.min(thePlayer.y, canvas.height / 2));
		ctx.lineTo(0, Math.min(theWorld.height - thePlayer.y, canvas.height / 2));
		ctx.closePath();
		ctx.stroke();
		ctx.restore();
	}
	var heightStart = Math.max(0, Math.floor((thePlayer.y - canvas.height / 2) / gridSize));
	var heightEnd = Math.min(theWorld.height / gridSize, Math.floor((thePlayer.y + canvas.height / 2) / gridSize));
	for (var i = heightStart; i <= heightEnd; i++) {
		ctx.save();
		ctx.translate(canvas.width / 2, canvas.height / 2 + i * gridSize - thePlayer.y);
		ctx.beginPath();
		ctx.moveTo(-Math.min(thePlayer.x, canvas.width / 2), 0);
		ctx.lineTo(Math.min(theWorld.width - thePlayer.x, canvas.width / 2), 0);
		ctx.closePath();
		ctx.stroke();
		ctx.restore();
	}
}

function inView(obj) {
	return (
		obj.x + obj.length > thePlayer.x - canvas.width / 2 &&
		obj.x - obj.length < thePlayer.x + canvas.width / 2 &&
		obj.y + obj.length > thePlayer.y - canvas.height / 2 &&
		obj.y - obj.length < thePlayer.y + canvas.height / 2
	)
}

function drawShip(ship) {
	if (!inView(ship)) { return; }
	ctx.save();
	ctx.fillStyle = "grey";
	ctx.lineJoin = "miter"  ;
	ctx.translate(canvas.width / 2 + (ship.x - thePlayer.x), canvas.height / 2 + (ship.y - thePlayer.y));
	ctx.rotate(ship.bearing * Math.PI / 180);
	ctx.beginPath();
	ctx.moveTo(-ship.length / 2, -ship.width / 2);
	ctx.lineTo(-ship.length / 2, ship.width / 2);
	ctx.lineTo(ship.length / 2, 0);
	ctx.fill();
	drawText(0, 0, 15, `(${ship.x}, ${ship.y}`);
	ctx.restore();
}

function drawPlayers() {
	for (var player of theWorld.players) {
		// Always draw the player on top.
		if (player.id === playerId) continue;
		drawShip(player);
	}
}

function drawBullet(bullet) {
	if (!inView(bullet)) { return; }
	ctx.save();
	ctx.fillStyle = "red";
	ctx.translate(canvas.width / 2 + (bullet.x - thePlayer.x), canvas.height / 2 + (bullet.y - thePlayer.y));
	ctx.rotate(bullet.bearing * Math.PI / 180);
	drawRect("red", -bullet.length / 2, -bullet.width / 2, bullet.length, bullet.width)
	ctx.restore();
}

function drawBullets() {
	for (var bullet of theWorld.bullets) {
		drawBullet(bullet);
	}
}

function drawRect(color, x, y, w, h) {
	ctx.fillStyle = color;
	ctx.fillRect(x, y, w, h);
}

var FPS = 30;
var SEC_PER_FRAME = 1000 / FPS;

window.requestAnimFrame = (function () {
	return window.requestAnimationFrame ||
		   window.webkitRequestAnimationFrame ||
		   window.mozRequestAnimationFrame ||
		   window.oRequestAnimationFrame ||
		   window.msRequestAnimationFrame ||
		   function (callback, element) {
			   window.setTimeout(callback, SEC_PER_FRAME);
		   };
})();

var canvas, ctx;
var BACKGROUND_COLOR = "#eeeeee";

init();
animate();

window.addEventListener("resize", handleResize, false);
canvas.addEventListener("mousemove", handleMouseMove, false);
canvas.addEventListener("mousedown", handleMouseDown, false);
canvas.addEventListener("mouseup", handleMouseUp, false);
window.addEventListener("keydown", handleKeyDown, false);
window.addEventListener("keyup", handleKeyUp, false);