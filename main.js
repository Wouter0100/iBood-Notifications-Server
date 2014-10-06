var child_process = require('child_process'),
    config = require('config'),
    pool = require('./database').pool,
    gcm = require('./gcm');

var scanner = child_process.fork('scanner.js');
var webserver = child_process.fork('webserver.js');

/*
 * Scanner response
 */
scanner.on('message', function(res) {
    if (res.type == 'new_product') {
        console.log('[MAIN] Received new product from scanner for language ' + res.language + ((res.product.hunt) ? ' (only for disabled hunt-mode)' : '') + '.');

        var sql =   'SELECT ' +
                        'reg_id ' +
                    'FROM ' +
                        'clients ' +
                    'WHERE ' +
                        ((config.debug) ? 'debug = "1"' : 'last_id != ?') + ' AND ' +
                        'ibood_language = ? AND ' +
                        '(' +
                            'when_enabled = "both" OR ' +
                            'when_enabled = "normal"' +
                        ')';

        var values = [];

        if (!config.debug) {
            values.push(res.product.id);
        }
        values.push(res.language);

        pool.query(sql, values, function(err, rows) {
            if (err != null) {
                console.log('[MAIN] MySQL error');
                console.log(err);
                return;
            }

            if (Object.keys(rows).length > 0) {
                var registrationIds = new Array();

                rows.forEach(function(row) {
                    registrationIds.push(row.reg_id);
                });

                gcm.sendRequest(res.type, res.product, registrationIds, function() {

                    //Update all clients with latest ID, just a "small" query to minimize the load on the MySQL server.
                    var sql =   'UPDATE ' +
                                    'clients ' +
                                'SET ' +
                                    'last_id = ? ' +
                                'WHERE ' +
                                    ((config.debug) ? 'debug = "1" AND ' : '') +
                                    'ibood_language = ? AND ' +
                                    '(' +
                                        'when_enabled = "both" OR ' +
                                        'when_enabled = "normal"' +
                                    ')';

                    pool.query(sql, [ res.product.id, res.language ]);

                    console.log('[MAIN] Saved new state for all send reg_id\'s.');

                });

            }

            return;
        });
    } else if(res.type == 'start_hunt') {
        console.log('[MAIN] Received start HUNT request for language ' + res.language);
    } else if(res.type == 'stop_hunt') {
        console.log('[MAIN] Received stop HUNT request for language ' + res.language);
    }
});
