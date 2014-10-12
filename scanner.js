var http = require('http'),
    env = require('jsdom').env,
    config = require('config'),
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
    }

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

            var languagePath= '/' + languageLocations[language].split('/')[3] + '/' + languageLocations[language].split('/')[4];

            var options = {
                host: 'www.ibood.com',
                path: languagePath
            }

            var request = http.request(options, function (res) {
                var data = '';

                res.on('data', function (chunk) {
                    data += chunk;
                });

                res.on('end', function () {
                    env(data, function (errors, window) {
                        var $ = require('jquery')(window);

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

                        product.full_name = $('#link_product').html();
                        product.short_name = $('#link_more_info span').html();

                        product.image = $('#product_img').attr('href');
                        product.small_image = $('#main-prod-img').attr('src');

                        product.forum_url = $('#link_forum').attr('href');
                        product.info_url = 'http://www.ibood.com' + $('#link_more_info').attr('href');
                        product.order_url = $('.btn_order').attr('href');

                        product.price = parseInt($('.price span').html().replace(',', '.'));
                        product.shipping = parseInt($('.shipping span').html().replace(',', '.'));
                        product.price_with_shipping = parseInt(product.price + product.shipping);

                        product.hunt = isHunt;

                        //Receiving ID: The nasty way.
                        product.info_url.split('/').forEach(function (i) {
                            if (i != "" && i % 1 === 0 && i.length >= 5) {
                                product.id = parseInt(i);
                            }
                        });

                        if (languageProducts[language] !== product.full_name) {
                            languageProducts[language] = product.full_name;

                            console.log('[SCANNER] Found new product for language ' + language + '.');

                            process.send({ type: 'new_product', language: language, product: product });
                        }

                        product = null;

                        window.close();
                    });

                    data = null;
                });
            });

            request.end();

        });

        if (config.debug) {
            console.log('[SCANNER] Interval tick - ' + new Date().toLocaleTimeString());
        }
    }
}, config.interval);
