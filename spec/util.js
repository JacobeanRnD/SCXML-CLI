'use strict';
// jshint node: true
/* global expect */

var nixt = require('nixt'),
  fs = require('fs'),
  path = require('path');

module.exports = function(opts) {
  opts = opts || {};
  opts.port = opts.port || 6002;
  opts.smaasJSON = require('smaas-swagger-spec');
  opts.smaasJSON.host = 'localhost:' + opts.port;
  opts.tempPath = path.resolve(__dirname + '/.tmp/');
  opts.baseApi = '/api/v3/';
  opts.mainProgram = path.resolve(__dirname + '/../client.js');
  opts.host = 'http://localhost:' + opts.port;
  opts.client = 'node ' + opts.mainProgram + ' -H ' + opts.host + ' ';
  opts.colorRemoval = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g;
  
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
    app.get('/api/v3/smaas.json', function (req, res) {
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

  opts.read = function (path) {
    return fs.readFileSync(path, 'utf-8');
  };

  opts.write = function (path, data) {
    return fs.writeFileSync(path, data, 'utf-8');
  };

  return opts;
};
