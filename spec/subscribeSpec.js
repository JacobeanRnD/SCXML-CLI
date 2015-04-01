'use strict';
// jshint node: true
/* global describe, beforeEach, afterEach, it, expect */

var spawn = require('child_process').spawn,
  util = require('./util')();

var colorRemoval = /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g;

describe('SCXML-CLI - subscribe', function () {
  beforeEach(function(done) {
    util.beforeEach(done);
  });

  afterEach(function (done) {
    util.afterEach(done);
  });

  function subsribeTest (path, actions, result, done) {
    var subscribed = spawn('node', [util.mainProgram, '-H', util.host, 'subscribe', path]);
    var stdout = '', stderr = '';

    util.passToTestRunner = function (req, res) {
      expect(req.path).toBe(util.baseApi + path + '/_changes');
      expect(req.method).toBe('GET');

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      });

      res.write(':' + new Array(2049).join(' ') + '\n'); // 2kB padding for IE
      res.write('retry: 2000\n');

      res.write('event: subscribed\n');
      res.write('data: \n\n');

      var handle = setInterval(function() {
        res.write('\n');
      }, 30 * 1000);

      //clean up
      req.on('close', function() {
        console.log('Request closed');
        clearInterval(handle);
      });

      actions.forEach(function (action, i) {
        //Queue each action every 500ms
        setTimeout(function () { action(res); }, i++ * 500);
      });

      setTimeout(function () {
        expect(stdout.replace(colorRemoval, '')).toEqual(result.join('\n') + '\n');
        expect(stderr.length).toBe(0);
        done();
        // Check after all actions are done
      }, actions.length++ * 500);
    };

    subscribed.stdout.on('data', function (data) { stdout += data; });
    subscribed.stderr.on('data', function (data) { stderr += data; });
  }

  it('should get statechart changes', function (done) {
    var result = ['Started listening to statechart changes', 'Statechart changed'];
    var actions = [ function (res) {
      res.write('event: onChange\n');
      res.write('data:\n\n');
    }];

    subsribeTest('helloworld.scxml', actions, result, done);
  });

  it('should get instance changes', function (done) {
    var result = ['Started listening to instance changes', 'onEntry - processing', 'onExit - initial'];
    var actions = [ function (res) {
      res.write('event: onEntry\n');
      res.write('data: processing\n\n');
    }, function (res) {
      res.write('event: onExit\n');
      res.write('data: initial\n\n');
    }];

    subsribeTest('helloworld.scxml/helloinstance', actions, result, done);
  });
});