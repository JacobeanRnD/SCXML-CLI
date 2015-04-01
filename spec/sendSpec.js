'use strict';
// jshint node: true
/* global describe, beforeEach, afterEach, it, expect */

var nixt = require('nixt'),
  fs = require('fs'),
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

  it('should send the event { name: helloname }', function (done) {
    var event = { name: 'helloname' };

    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + instanceId);
      expect(req.method).toBe('POST');
      expect(JSON.parse(req.body)).toEqual(event);

      res.setHeader('X-Configuration', JSON.stringify(resultConf));
      
      res.sendStatus(200);
    };

    nixt({ colors: false, newlines: false })
      .run(util.client + 'send ' + instanceId + ' ' + event.name)
      .expect(util.checkStderr)
      .stdout('Current:' + JSON.stringify(resultConf))
      .end(done);
  });

  // TODO: test for data: string
  it('should send the event { name: helloname, data: { test: "hellodata" } }', function (done) {
    var event = { name: 'helloname', data: { test: 'hellodata' } };

    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + instanceId);
      expect(req.method).toBe('POST');
      expect(JSON.parse(req.body)).toEqual(event);

      res.setHeader('X-Configuration', JSON.stringify(resultConf));
      
      res.sendStatus(200);
    };

    nixt({ colors: false, newlines: false })
      .run(util.client + 'send ' + instanceId + ' ' + event.name + ' \'' + JSON.stringify(event.data) + '\'')
      .expect(util.checkStderr)
      .stdout('Current:' + JSON.stringify(resultConf))
      .end(done);
  });

  it('should send the event name: helloname, data: @eventData.json', function (done) {
    var event = { name: 'helloname', data: { test: 'hellodata' } },
      filePath = util.tempPath + '/eventData.json';

    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + instanceId);
      expect(req.method).toBe('POST');
      expect(JSON.parse(req.body)).toEqual(event);

      res.setHeader('X-Configuration', JSON.stringify(resultConf));
      
      res.sendStatus(200);
    };

    fs.writeFileSync(filePath, JSON.stringify(event.data), 'utf-8');

    nixt({ colors: false, newlines: false })
      .run(util.client + 'send ' + instanceId + ' ' + event.name + ' @' + filePath)
      .expect(util.checkStderr)
      .stdout('Current:' + JSON.stringify(resultConf))
      .end(done);
  });

  it('should send the event @event.json', function (done) {
    var event = { name: 'helloname', data: { test: 'hellodata' } },
      filePath = util.tempPath + '/event.json';

    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + instanceId);
      expect(req.method).toBe('POST');
      expect(JSON.parse(req.body)).toEqual(event);

      res.setHeader('X-Configuration', JSON.stringify(resultConf));
      
      res.sendStatus(200);
    };

    fs.writeFileSync(filePath, JSON.stringify(event), 'utf-8');

    nixt({ colors: false, newlines: false })
      .run(util.client + 'send ' + instanceId + ' @' + filePath)
      .expect(util.checkStderr)
      .stdout('Current:' + JSON.stringify(resultConf))
      .end(done);
  });
});