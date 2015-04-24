'use strict';
// jshint node: true
/* global describe, beforeEach, afterEach, it, expect */

var nixt = require('nixt'),
  util = require('./util')();

describe('SCXML-CLI - instances', function () {
  beforeEach(function(done) {
    util.beforeEach(done);
  });

  afterEach(function (done) {
    util.afterEach(done);
  });

  it('should get the list of instances for helloworld.scxml', function (done) {
    var instances = ['7b5dba0b-3b58-4ffb-ab2f-a5cb6b1bdd58', '95c43c84-7bd6-4784-8852-1806eaa5972c'];
    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + 'helloworld.scxml/_all_instances');
      expect(req.method).toBe('GET');

      res.send({
        data: {
          instances: instances.map(function (instance) {
            return { id: instance }; 
          })
        }
      });
    };

    nixt({ colors: false, newlines: false })
      .run(util.client + 'ls helloworld.scxml')
      .expect(util.checkStderr)
      .stdout('Instance list:' + instances.join(''))
      .end(done);
  });

  it('should run an instance', function (done) {
    var instanceName = 'helloinstance';

    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + 'helloworld.scxml');
      expect(req.method).toBe('POST');

      res.setHeader('Location', 'helloworld.scxml/' + instanceName);

      res.sendStatus(201);
    };

    nixt({ colors: false, newlines: false })
      .run(util.client + 'run helloworld.scxml')
      .expect(util.checkStderr)
      .stdout('Instance created, InstanceId:helloworld.scxml/' + instanceName)
      .end(done);
  });

  it('should run an instance with name', function (done) {
    var instanceName = 'helloinstance';

    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + 'helloworld.scxml/' + instanceName);
      expect(req.method).toBe('PUT');

      res.setHeader('Location', 'helloworld.scxml/' + instanceName);

      res.sendStatus(201);
    };

    nixt({ colors: false, newlines: false })
      .run(util.client + 'run helloworld.scxml -n ' + instanceName)
      .expect(util.checkStderr)
      .stdout('Instance created, InstanceId:helloworld.scxml/' + instanceName)
      .end(done);
  });

  it('should get the instance configuration', function (done) {
    var conf = [['a'], {}, false, {}];

    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + 'helloworld.scxml/helloinstance');
      expect(req.method).toBe('GET');

      res.send({ data: {
        instance: {
          snapshot: conf
        }
      } });
    };

    nixt({ colors: false, newlines: false })
      .run(util.client + 'cat helloworld.scxml/helloinstance')
      .expect(util.checkStderr)
      .stdout('Instance details:' + JSON.stringify(conf))
      .end(done);
  });

  it('should remove an instance', function (done) {
    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + 'helloworld.scxml/helloinstance');
      expect(req.method).toBe('DELETE');

      res.sendStatus(200);
    };

    nixt()
      .run(util.client + 'rm helloworld.scxml/helloinstance')
      .expect(util.checkStderr)
      .end(done);
  });

  it('should log events of an instance', function (done) {
    var eventList = ['event1', 'event2', 'event3'];

    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + 'helloworld.scxml/helloinstance/_eventLog');
      expect(req.method).toBe('GET');

      res.send({ data: {
        events: eventList
      }});
    };

    nixt({ colors: false, newlines: false })
      .run(util.client + 'log helloworld.scxml/helloinstance')
      .expect(util.checkStderr)
      .stdout('Event log:"' + eventList.join('""') + '"')
      .end(done);
  });
});