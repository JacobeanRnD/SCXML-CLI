'use strict';
// jshint node: true
/* global describe, beforeEach, afterEach, it, expect */

var nixt = require('nixt'),
  fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  port = 6002,
  smaasJSON = yaml.safeLoad(fs.readFileSync(path.resolve(__dirname + '/./../smaas.yml'), 'utf8'));

smaasJSON.host = 'localhost:' + port;

var tempPath = path.resolve(__dirname + '/.tmp/'),
  baseApi = '/api/v1/',
  client = 'node ' + path.resolve(__dirname + '/../client.js') + ' -H http://localhost:' + port + ' ';

var passToTestRunner, server;

describe('SCXML-CLI', function () {
  beforeEach(function(done) {
    //Cleanup and prepare temp folder
    nixt()
      .run('rm -rf ' + tempPath)
      .run('mkdir ' + tempPath)
      .exist(tempPath)
      .end(done);

    var app = require('express')();

    //Serve swagger client API
    app.get('/smaas.json', function (req, res) {
      res.status(200).send(smaasJSON);
    });

    app.all('*', function (req, res) {
      //Pass request to specified interceptor or fail
      if(passToTestRunner) passToTestRunner(req, res);
      else res.send(404);
    });

    //Start listening for API calls
    server = app.listen(port);
  });

  afterEach(function (done) {
    //Cleanup temp folder
    nixt()
      .run('rm -rf ' + tempPath)
      .end(done);

    // Remove API interceptor
    passToTestRunner = null;

    //Close the server
    server.close();
  });

  function checkStderr (result) {
    expect(result.stderr.length).toBe(0);
  }

  function createHelloWorld (done) {
    // In order:
    // Change directory to temp
    // Run create command
    // Check for stderr
    // Check file existance
    nixt()
      .run(client + 'create ' + tempPath + '/helloworld.scxml')
      .expect(checkStderr)
      .exist(tempPath + '/helloworld.scxml')
      .end(done);
  }

  it('should create helloworld file locally', function (done) {
    createHelloWorld(done);
  });

  it('should save helloworld.scxml with various options', function (done) {
    passToTestRunner = function (req, res) {
      // Intercepted API call should be: PUT /api/v1/helloworld.scxml with application/xml
      expect(req.path).toBe(baseApi + 'helloworld.scxml');
      expect(req.method).toBe('PUT');
      expect(req.headers['content-type']).toBe('application/xml');
      res.sendStatus(201);
    };

    // Create helloworld
    createHelloWorld(function () {
      //Save created file
      nixt()
        .run(client + 'save ' + tempPath + '/helloworld.scxml')
        .expect(checkStderr)
        .end(done);
    });
  });
});