'use strict';
// jshint node: true
/* global expect */

var nixt = require('nixt'),
  fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml');

module.exports = function(opts) {
  opts = opts || {};
  opts.port = opts.port || 6002;
  opts.smaasJSON = yaml.safeLoad(fs.readFileSync(path.resolve(__dirname + '/./../smaas.yml'), 'utf8'));
  opts.smaasJSON.host = 'localhost:' + opts.port;
  opts.tempPath = path.resolve(__dirname + '/.tmp/');
  opts.baseApi = '/api/v1/';
  opts.client = 'node ' + path.resolve(__dirname + '/../client.js') + ' -H http://localhost:' + opts.port + ' ';
  
  opts.beforeEach = function (done) {

    var app = require('express')();
    app.use(function(req, res, next) {
      req.body = '';
      req.on('data', function(data) {
        return req.body += data;
      });
      return req.on('end', next);
    });

    //Serve swagger client API
    app.get('/smaas.json', function (req, res) {
      res.status(200).send(opts.smaasJSON);
    });

    app.all('*', function (req, res) {
      //Pass request to specified interceptor or fail
      if(opts.passToTestRunner) opts.passToTestRunner(req, res);
      else res.sendStatus(404);
    });

    //Start listening for API calls
    opts.server  = app.listen(opts.port);

    nixt()
      .run('rm -rf ' + opts.tempPath)
      .run('mkdir ' + opts.tempPath)
      .exist(opts.tempPath)
      .end(done);
  };

  opts.afterEach = function (done) {
    //Cleanup temp folder
    nixt()
      .run('rm -rf ' + opts.tempPath)
      .end(done);

    // Remove API interceptor
    opts.passToTestRunner = null;

    //Close the server
    opts.server.close();
  };

  opts.checkStderr = function (result) {
    expect(result.stderr.length).toBe(0);
    if(result.stderr.length > 0) {
      console.log(result.stderr);
    }
  };

  opts.createHelloWorld = function (done) {
    // In order:
    // Change directory to temp
    // Run create command
    // Check for stderr
    // Check file existance
    nixt()
      .run(opts.client + 'create ' + opts.tempPath + '/helloworld.scxml')
      .expect(opts.checkStderr)
      .exist(opts.tempPath + '/helloworld.scxml')
      .end(done);
  };

  return opts;
};