'use strict';
// jshint node: true
/* global describe, beforeEach, afterEach, it, expect */

var spawn = require('child_process').spawn,
  util = require('./util')();

var instanceId = 'helloworld.scxml/helloinstance',
  resultConf = ['b'];

describe('SCXML-CLI - interact', function () {
  beforeEach(function(done) {
    util.beforeEach(done);
  });

  afterEach(function (done) {
    util.afterEach(done);
  });

  function interactSuccess (event, commandArg, done) {
    var stdout = '', stderr = '';

    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + instanceId);
      expect(req.method).toBe('POST');
      expect(JSON.parse(req.body)).toEqual(event);

      res.setHeader('X-Configuration', JSON.stringify(resultConf));
      
      res.sendStatus(200);
    };

    var subscribed = spawn('node', [util.mainProgram, '-H', util.host, 'interact', instanceId]);
    subscribed.stdout.on('data', function (data) { stdout += data; });
    subscribed.stderr.on('data', function (data) { stderr += data; });

    subscribed.stdin.write(commandArg + '\n');

    setTimeout(function () {
      expect(stdout).toBe('scxml >\'' + JSON.stringify(resultConf) + '\'\nscxml >');
      expect(stderr.length).toBe(0);
      done();
    }, 1500);
  }

  function interactFail (fileName, commandArg, done) {
    var stdout = '', stderr = '', serverCalled = false;

    util.passToTestRunner = function (req, res) {
      serverCalled = true;
      res.sendStatus(200);
    };

    var subscribed = spawn('node', [util.mainProgram, '-H', util.host, 'interact', instanceId]);
    subscribed.stdout.on('data', function (data) { stdout += data; });
    subscribed.stderr.on('data', function (data) { stderr += data; });

    subscribed.stdin.write(commandArg + '\n');

    setTimeout(function () {
      expect(serverCalled).toBe(false);
      
      var versionFix = '';
      if(process.version.substring(0, 5) !== 'v0.10') {
        versionFix = 'scxml >';
      }

      expect(stdout).toBe('scxml >ENOENT, open \'' + fileName + '\'\nscxml >' + versionFix);
      expect(stderr.length).toBe(0);
      done();
    }, 1500);
  }

  it('should interact and send the event { name: helloname }', function (done) {
    var event = { name: 'helloname' },
      commandArg = event.name;

    interactSuccess(event, commandArg, done);
  });

  // TODO: test for data: string
  it('should interact and send the event { name: helloname, data: { test: "hellodata" } }', function (done) {
    var event = { name: 'helloname', data: { test: 'hellodata' } },
      commandArg = event.name + ' ' + JSON.stringify(event.data);

    interactSuccess(event, commandArg, done);
  });

  it('should interact and send the event name: helloname, data: @eventData.json', function (done) {
    var event = { name: 'helloname', data: { test: 'hellodata' } },
      filePath = util.tempPath + '/eventData.json',
      commandArg = event.name + ' @' + filePath;

    util.write(filePath, JSON.stringify(event.data));

    interactSuccess(event, commandArg, done);
  });

  it('should interact and send the event @event.json', function (done) {
    var event = { name: 'helloname', data: { test: 'hellodata' } },
      filePath = util.tempPath + '/event.json',
      commandArg = '@' + filePath;

    util.write(filePath, JSON.stringify(event));

    interactSuccess(event, commandArg, done);
  });

  it('should interact and fail to send the event with missing @eventData.json', function (done) {
    var commandArg = 'helloname @eventData.json';

    interactFail('eventData.json', commandArg, done);
  });

  it('should interact and fail to send the event with missing @event.json', function (done) {
    var commandArg = '@event.json';

    interactFail('event.json', commandArg, done);
  });
});