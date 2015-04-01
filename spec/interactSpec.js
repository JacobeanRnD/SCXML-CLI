'use strict';
// jshint node: true
/* global describe, beforeEach, afterEach, it, expect */

var nixt = require('nixt'),
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
    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + instanceId);
      expect(req.method).toBe('POST');
      expect(JSON.parse(req.body)).toEqual(event);

      res.setHeader('X-Configuration', JSON.stringify(resultConf));
      
      res.sendStatus(200);
    };

    nixt({ colors: false, newlines: false })
      .run(util.client + 'interact ' + instanceId)
      .expect(util.checkStderr)
      .on('scxml >')
      .respond(commandArg)
      .stdout('scxml >\'' + JSON.stringify(resultConf) + '\'scxml >')
      .end(done);
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
    var fileName = 'eventData.json';

     nixt({ colors: false, newlines: false })
      .run(util.client + 'interact ' + instanceId)
      .expect(util.checkStderr)
      .on('scxml >')
      .respond('helloname @' + fileName)
      .stdout('scxml >ENOENT, open \'' + fileName + '\'scxml >scxml >')
      .end(done);
  });

  it('should interact and fail to send the event with missing @event.json', function (done) {
    var fileName = 'event.json';

     nixt({ colors: false, newlines: false })
      .run(util.client + 'interact ' + instanceId)
      .expect(util.checkStderr)
      .on('scxml >')
      .respond('@' + fileName)
      .stdout('scxml >ENOENT, open \'' + fileName + '\'scxml >scxml >')
      .end(done);
  });
});