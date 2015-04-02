'use strict';
// jshint node: true
/* global describe, beforeEach, afterEach, it, expect */

var nixt = require('nixt'),
  util = require('./util')();

var instanceId = 'helloworld.scxml/helloinstance',
  resultConf = ['b'];

describe('SCXML-CLI - send', function () {
  beforeEach(function(done) {
    util.beforeEach(done);
  });

  afterEach(function (done) {
    util.afterEach(done);
  });

  function sendSuccess (event, commandArg, done) {
    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + instanceId);
      expect(req.method).toBe('POST');
      expect(JSON.parse(req.body)).toEqual(event);

      res.setHeader('X-Configuration', JSON.stringify(resultConf));
      
      res.sendStatus(200);
    };

    nixt({ colors: false, newlines: false })
      .run(util.client + 'send ' + instanceId + ' ' + commandArg)
      .expect(util.checkStderr)
      .stdout('Current:' + JSON.stringify(resultConf))
      .end(done);
  }

  function sendFail (commandArg, done) {
    nixt({ colors: false, newlines: false })
      .run(util.client + 'send ' + instanceId + ' ' + commandArg)
      .expect(function (result) {
        expect(result.stderr.length).toBeGreaterThan(0);
      })
      .end(done);
  }

  it('should send the event { name: helloname }', function (done) {
    var event = { name: 'helloname' },
      commandArg = event.name;

    sendSuccess(event, commandArg, done);
  });

  // TODO: test for data: string
  it('should send the event { name: helloname, data: { test: "hellodata" } }', function (done) {
    var event = { name: 'helloname', data: { test: 'hellodata' } },
      commandArg = event.name + ' \'' + JSON.stringify(event.data) + '\'';

    sendSuccess(event, commandArg, done);
  });

  it('should send the event name: helloname, data: @eventData.json', function (done) {
    var event = { name: 'helloname', data: { test: 'hellodata' } },
      filePath = util.tempPath + '/eventData.json',
      commandArg = event.name + ' @' + filePath;

    util.write(filePath, JSON.stringify(event.data));

    sendSuccess(event, commandArg, done);
  });

  it('should send the event @event.json', function (done) {
    var event = { name: 'helloname', data: { test: 'hellodata' } },
      filePath = util.tempPath + '/event.json',
      commandArg = '@' + filePath;

    util.write(filePath, JSON.stringify(event));

    sendSuccess(event, commandArg, done);
  });

  it('should fail to send the event with missing @eventData.json', function (done) {
    sendFail('helloname @eventData.json', done);
  });

  it('should fail to send the event with missing @event.json', function (done) {
    sendFail('@event.json', done);
  });
});