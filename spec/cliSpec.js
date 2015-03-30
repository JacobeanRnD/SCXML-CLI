'use strict';
// jshint node: true
/* global describe, beforeEach, afterEach, it, expect */

var nixt = require('nixt'),
  util = require('./util')();

describe('SCXML-CLI', function () {
  beforeEach(function(done) {
    util.beforeEach(done);
  });

  afterEach(function (done) {
    util.afterEach(done);
  });

  it('should create helloworld file locally', function (done) {
    util.createHelloWorld(done);
  });

  it('should save helloworld.scxml with various options', function (done) {
    util.passToTestRunner = function (req, res) {
      // Intercepted API call should be: PUT /api/v1/helloworld.scxml with application/xml
      expect(req.path).toBe(util.baseApi + 'helloworld.scxml');
      expect(req.method).toBe('PUT');
      expect(req.headers['content-type']).toBe('application/xml');
      res.sendStatus(201);
    };

    util.createHelloWorld(function () {
      //Save created file
      nixt()
        .run(util.client + 'save ' + util.tempPath + '/helloworld.scxml')
        .expect(util.checkStderr)
        .end(done);
    });
  });
});