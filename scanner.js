var http = require('http'),
    config = require('config'),
    cheerio = require('cheerio'),
    pool = require('./database').pool;

var languages = ['nl', 'be', 'uk', 'de', 'ie', 'at', 'pl'];
var languageLocations = [];
var languageProducts = {};
var languageHunts ={};

var fetched = false;

languages.forEach(function (language) {

    languageHunts[language] = false;

    var options = {
        method: 'HEAD',
        host: 'www.ibood.com',
        path: '/' + language
    };

    var request = http.request(options, function (res) {
        languageLocations[language] = res.headers.location;

        if (languages.length == Object.keys(languageLocations).length) {
            fetched = true;

            console.log('[SCANNER] Successfully fetched all language locations.');
        }
    });

    request.end();

});

setInterval(function() {
    if (fetched) {

        languages.forEach(function (language) {

            var languagePath= '/' + languageLocations[language].split('/')[3] + '/' + languageLocations[language].split('/')[4] + '/';

            var options = {
                host: 'www.ibood.com',
                path: languagePath
            };

            var request = http.request(options, function(res) {
                var data = '';

                res.on('data', function(chunk) {
                    data += chunk;
                });

                res.on('end', function() {
                    var $ = cheerio.load(data);

                    var isHunt = ($('.siren').length >= 1);

                    if (isHunt && !languageHunts[language]) {
                        console.log('[SCANNER] Enabling HUNT mode for ' + language);

                        languageHunts[language] = true;

                        process.send({ type: 'start_hunt', language: language });
                    }

                    if (!isHunt && languageHunts[language]) {
                        console.log('[SCANNER] Disabling HUNT mode for ' + language);

                        languageHunts[language] = false;

                        process.send({ type: 'stop_hunt', language: language });
                    }

                    var product = {};

                    product.hunt = isHunt;

                    product.full_name = $('span.long').html();
                    product.short_name = $('span.short').html();

                    product.image = 'http:' + $('.fluid').data('large');
                    product.small_image = 'http:' + $('.fluid').data('mobile');

                    product.forum_url = $('.topic').attr('href');
                    product.info_url = $('.sl').attr('href');

                    var options = {
                        host: 'www.ibood.com',
                        path: product.info_url.replace('http://www.ibood.com', '')
                    };


                    var request = http.request(options, function (res) {
                        var data = '';

                        res.on('data', function (chunk) {
                            data += chunk;
                        });

                        res.on('end', function () {
                            var $ = cheerio.load(data);

                            product.order_url = $('#addToBasketForm').attr('action');

                            $('.shipping-price .tooltip').remove(); //remove tooltip, on this way we can receive .text();

                            product.price = parseFloat($('.new-price').first().text().replace(/[^,\d]/g, '').trim().replace(',', '.'));
                            product.shipping = parseFloat($('.shipping-price').first().text().replace(/[^,\d]/g, '').trim().replace(',', '.'));
                            product.price_with_shipping = parseFloat(product.price + product.shipping).toFixed(2);

                            product.id = $('#productId').attr('value');
                            product.offer_id = $('input[name="offerId"]').attr('value');

                            $('#quantity option').each(function() {
                                if ($(this).attr('disabled') == 'disabled') {
                                    return;
                                }

                                product.quantity = $(this).attr('value');
                            });

                            if (languageProducts[language] !== product.full_name) {
                                languageProducts[language] = product.full_name;

                                console.log('[SCANNER] Found new product for language ' + language + '.');

                                process.send({ type: 'new_product', language: language, product: product });
                            }

                            data = null;
                        });
                    });

                    request.on('error', function(err) {
                        console.log('[SCANNER] Error from socket: ' + err.code);
                    });

                    request.end();

                    data = null;
                });
            });

            request.on('error', function(err) {
                console.log('[SCANNER] Error from socket: ' + err.code);
            });

            request.end();

        });

        if (config.debug) {
            console.log('[SCANNER] Interval tick - ' + new Date().toLocaleTimeString());
        }
    }
}, config.interval);
