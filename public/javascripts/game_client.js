// This file manages the games client's logic. It's here that Socket.io connections are handled
// and functions from canvas.js are used to manage the game's visual appearance.

// Debug settings
DEBUG = false;
var logFull = true;

var socket = io(); 

// Game state
var playerId, theWorld;
var worlds = [];
var realStartTime, worldStartTime;
var messages = [];

// Constants
BEARING = "bearing";
KEYSTROKE = "keystroke";

// Main update function.
socket.on("enter game", function(world, player) {
	playerId = player.id;
	worlds.push(world);
	theWorld = world;
	// console.log(`ENTER WORLD ${worldStartTime}`);
});

socket.on("update world", function(world) {
	if (world) {
		worlds.push(world);
	} else {
		console.log("<<<<<<<<<<<<<<<< DISCONNECTED!!!! >>>>>>>>>>>>>>>>>>>");
		worlds = [];
	}
});

socket.on("disconnect", function() {
	// console.log("Server Disconnected!!!");
	theWorld = false;
});

//////////  Functions  \\\\\\\\\\

var msgCount = 0;
function emitMessage(msg) {
	msg.t = new Date().getTime();
	msg.seq = msgCount++;
	messages.push(msg);
	socket.emit("player message", msg);
}