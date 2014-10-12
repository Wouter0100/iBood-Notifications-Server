var mysql = require('mysql'),
    config = require('config');

exports.pool = mysql.createPool({
    connectionLimit : 10,
    host            : config.MySQL.host,
    user            : config.MySQL.user,
    password        : config.MySQL.pass,
    database        : config.MySQL.database
});
