var config = require('config'),
    express = require('express'),
    bodyParser = require('body-parser'),
    pool = require('./database').pool;

/*
 * API webserver
 */
var app = express();

app.use(bodyParser.urlencoded({ extended: false }));

app.post('/save/preference', function(req, res){
    if (req.body.preference == 'when_enabled' || req.body.preference == 'ibood_language') {
        console.log('[WEBSERVER][API] Save preference "' + req.body.preference + '" to value "' + req.body.value + '".');

        pool.query('UPDATE clients SET ' + req.body.preference + ' = ? WHERE reg_id = ?', [ req.body.value, req.body.registration_id ], function (err, result) {

            if (err == null) {
                console.log('[WEBSERVER][API] Successfully saved latest save preference request.');

                return res.send('OK');
            } else {
                console.log('[WEBSERVER][API] Failed to save latest save preference request.');

                return res.send('NOTOK');
            }
        });
    } else {
        return res.send('NOTOK');
    }
});

app.post('/save/registration', function(req, res) {
    console.log('[WEBSERVER][API] Save registration request received.')

    pool.query('INSERT INTO clients (reg_id) VALUES (?)', [ req.body.registration_id ], function(err, result) {
        if (err == null) {
            console.log('[WEBSERVER][API] Successfully registered GCM device.');

            return res.send('OK');
        } else {
            if (err.errno == 1062) {
                console.log('[WEBSERVER][API] Received duplicated reg_id request.');

                return res.send('OK');
            } else {
                console.log('[WEBSERVER][API] Failed to register GCM device.');

                return res.send('NOTOK');
            }
        }
    });
});

app.use(function(req, res){
    console.log('[WEBSERVER] Received 404 request for URL "' + req.url + '".');

    return res.send('NOTOK');
});

app.listen(8080);

console.log('[WEBSERVER] Started webserver successfully.');

