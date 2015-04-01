'use strict';
// jshint node: true
/* global describe, beforeEach, afterEach, it, expect */

var nixt = require('nixt'),
  util = require('./util')();

describe('SCXML-CLI - general', function () {
  beforeEach(function(done) {
    util.beforeEach(done);
  });

  afterEach(function (done) {
    util.afterEach(done);
  });

  it('should fail on unknown command', function (done) {
    nixt({ colors: false, newlines: false })
      .run(util.client + 'arbitrarycommand')
      .expect(function (result) {
        expect(result.stderr.length).toBeGreaterThan(0);
        expect(result.stdout.length).toBeGreaterThan(0);
      })
      .end(done);
  });

  it('should write out usage on help', function (done) {
    nixt({ colors: false, newlines: false })
      .run(util.client + 'help')
      .expect(util.checkStderr)
      .end(done);
  });

  it('should write out usage on --help', function (done) {
    nixt({ colors: false, newlines: false })
      .run(util.client + '--help')
      .expect(util.checkStderr)
      .end(done);
  });

  it('should write out usage on -h', function (done) {
    nixt({ colors: false, newlines: false })
      .run(util.client + '-h')
      .expect(util.checkStderr)
      .end(done);
  });
});