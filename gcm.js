var gcm = require('node-gcm'),
    config = require('config'),
    EventEmitter = require('events').EventEmitter,
    pool = require('./database').pool;

exports.event = new EventEmitter();

var retryCount = 0;

function sendRequest(type, data, registrationIds, callbackAfterSend) {

    var message = new gcm.Message();
    var sender = new gcm.Sender(config.gcm);
    var retryRegistrationIds = [];

    message.addDataWithObject(data);
    message.addDataWithKeyValue('type', type);

    message.collapseKey = type;
    message.delayWhileIdle = true;
    message.timeToLive = 80000;

    sender.send(message, registrationIds, 4, function (err, result) {
        if (err == null) {
            console.log('[GCM] Successfully send GCM request.');

            if (result.success != 0) {
                console.log('[GCM] Success: ' + result.success + '.');
            }

            if (result.failure != 0) {
                console.log('[GCM] Failure: ' + result.failure + '.');
            }

            if (result.canonical_ids != 0) {
                console.log('[GCM] Canonical IDs: ' + result.canonical_ids + '.');

                console.log(result);
            }

            if (result.failure != 0 || result.canonical_ids != 0) {
                console.log('[GCM] Checking result, failure or canonical ids isn\'t zero.');

                result.results.forEach(function(result, index) {
                    var checkError = true;

                    if (typeof result.message_id != 'undefined') {
                        // Message ID is set

                        if (typeof result.registration_id != 'undefined') {
                            // Canonical registration ID is set, replace with old registration id.

                            console.log('[GCM] MessageID and canonicalRegistrationID are set, updating.');

                            var newRegId = result.registration_id;
                            var oldRegId = registrationIds[index];

                            pool.query('UPDATE clients SET reg_id = ? WHERE reg_id = ? LIMIT 1', [ newRegId, oldRegId ], function(err, result) {
                                if (err == null) {
                                    console.log('[GCM] Successfully updated regId to canonical ID.');
                                } else {
                                    if (err.errno == 1062) {
                                        pool.query('DELETE FROM clients WHERE reg_id = ? LIMIT 1', [ oldRegId ]);

                                        console.log('[GCM] Deleted old id from database because of a duplicate.');
                                    } else {
                                        console.log('[GCM] Failed to update regId to canonical ID.');
                                    }

                                    console.log('[GCM] newRegId: "' + newRegId + '".');
                                    console.log('[GCM] oldRegId: "' + oldRegId + '".');
                                }
                            });

                            checkError = false;
                        }
                    }


                    if (checkError && typeof result.error != 'undefined') {
                        console.log('[GCM] Checking for error in response.');

                        switch(result.error) {
                            case 'Unavailable':
                                console.log('[GCM] Unavailable, we\'re sending again.');

                                retryRegistrationIds.push(registrationIds[index]);
                                return;

                            case 'NotRegistered':
                                console.log('[GCM] NotRegistered, disabling user.');

                                var removeRegId = registrationIds[index];

                                pool.query('DELETE FROM clients WHERE reg_id = ? LIMIT 1', [ removeRegId ], function(err, result) {
                                    if (err == null) {
                                        console.log('[GCM] Successfully removed client.');
                                    } else {
                                        console.log('[GCM] Failed to remove client.');
                                        console.log('[GCM] removeRegId: "' + removeRegId + '".');
                                    }
                                });
                                return;

                            default:
                                console.log('[GCM] Couldn\'t catch error "' + result.error + '".');
                                break;
                        }
                    }
                });
            }

            if (retryRegistrationIds.length == 0) {
                retryCount = 0;

                callbackAfterSend();
            }

            if (retryRegistrationIds.length != 0) {
                if (retryCount <= 5) {
                    retryCount++;

                    console.log('[GCM] Failed to send some reg_ids, we\'re retrying for the ' + retryCount + ' time.');
                    sendRequest(type, data, retryRegistrationIds, callbackAfterSend);
                } else {
                    console.log('[GCM] Retry count of 5 exceeded, could not send the following reg_ids:');

                    retryRegistrationIds.forEach(function(reg_id) {
                        console.log('[GCM] ' + reg_id);
                    });
                }
            }
        } else {
            console.log('[GCM] Failed send GCM request.');
            console.log(err);
            console.log(result);
        }
    });
}
exports.sendRequest = sendRequest;
