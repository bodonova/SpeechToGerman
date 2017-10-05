/**
 * Copyright 2014, 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'),
    app = express(),
	bodyParser = require("body-parser"), //L.R.
    errorhandler = require('errorhandler'),
    bluemix = require('./config/bluemix'),
    watson = require('watson-developer-cloud'),
    path = require('path'),
    // environmental variable points to demo's json config file
    extend = require('util')._extend;

// For local development, put username and password in config
// or store in your environment
var config = {
  version: 'v1',
  url: 'https://stream.watsonplatform.net/speech-to-text/api',
  username: '3882c0c3-60f1-47c3-9946-26b6c9aefd73',
  password: 'GkhU74b1vGDx'
};

// if bluemix credentials exists, then override local
var credentials = extend(config, bluemix.getServiceCreds('speech_to_text'));
var authorization = watson.authorization(credentials);

// redirect to https if the app is not running locally
if (!!process.env.VCAP_SERVICES) {
  app.enable('trust proxy');
  app.use (function (req, res, next) {
    if (req.secure) {
      next();
    }
    else {
      res.redirect('https://' + req.headers.host + req.url);
    }
  });
}

// Setup static public directory
app.use(express.static(path.join(__dirname , './public')));

// Get token from Watson using your credentials
app.get('/token', function(req, res) {
  authorization.getToken({url: credentials.url}, function(err, token) {
    if (err) {
      console.log('error:', err);
      res.status(err.code);
    }
    res.send(token);
  });
});

// L.R.
// ------------------------------- MT ---------------------------------
app.use(bodyParser.urlencoded({ extended: false }));
var mt_credentials = extend({
  old_url: 'https://gateway.watsonplatform.net/language-translation/api',
  url: 'https://gateway.watsonplatform.net/language-translator/api',
  username: '2c33d5ba-4aa2-496d-83be-62eb1c396cdb',
  password: 'j6UVno7bBfaE',
  //version: '2017-07-01',
  version: 'v2'
}, bluemix.getServiceCreds('language-translation')); // VCAP_SERVICES

var language_translation = watson.language_translation(mt_credentials);
//console.log(' ---> mt_credentials == ' + JSON.stringify(mt_credentials));

app.post('/api/translate', function(req, res, next) {
  //console.log('/v2/translate');

  var params = extend({ 'X-WDC-PL-OPT-OUT': req.header('X-WDC-PL-OPT-OUT')}, req.body);
  console.log(' ---> MT params: ' + JSON.stringify(params)); //L.R.

  // Hack to get NMT model Called BOD
  var unirest = require('unirest');
  var nmt_url = mt_credentials.url + '/v2/translate?version=2017-07-01';
  console.log(' ---> hack URL '+nmt_url+' param '+JSON.stringify(params));
  unirest.post(nmt_url)
  .header('Accept', 'application/json')
  .auth(mt_credentials.username, mt_credentials.password, true)
  .send(params)
  .end(function (response) {
    console.log(' ---> response code: '+response.code+' JSON: '+JSON.stringify(response.body));
    res.json(response.body);
  });

  // calling the official library
  // language_translation.translate(params, function(err, models) {
  // if (err)
  //   return next(err);
  // else
  //   res.json(models);
  // });
});
// ----------------------------------------------------------------------

// L.R.
// -------------------------------- TTS ---------------------------------
var tts_credentials = extend({
  url: 'https://stream.watsonplatform.net/text-to-speech/api',
  version: 'v1',
  username: '8561d912-9223-4f49-9015-217afdaf4cf7',
  password: 'zSX3pRvBCVSh',
}, bluemix.getServiceCreds('text_to_speech'));

// Create the service wrappers
var textToSpeech = watson.text_to_speech(tts_credentials);

app.get('/synthesize', function(req, res) {
  var transcript = textToSpeech.synthesize(req.query);
  console.log ('synthesize query: '+JSON.stringify(req.query));
  transcript.on('response', function(response) {
    if (req.query.download) {
      response.headers['content-disposition'] = 'attachment; filename=transcript.ogg';
    }
  });
  transcript.on('error', function(error) {
    console.log('Synthesize error: ', error)
  });
  transcript.pipe(res);
});

// ----------------------------------------------------------------------

// Add error handling in dev
if (!process.env.VCAP_SERVICES) {
  app.use(errorhandler());
}
var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);
