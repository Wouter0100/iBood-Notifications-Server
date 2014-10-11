var http = require('http'),
    pool = require('./database').pool;


exports.event = new EventEmitter();

function startHunt() {
    //Starts hunt scanner and socket.io server for realtime notifications.
}
exports.startHunt = startHunt;
