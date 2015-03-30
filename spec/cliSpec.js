'use strict';

var nixt = require('nixt');

var tempPath = 'spec/.tmp/';

describe('SCXML-CLI', function () {
  beforeEach(function(done){
    nixt()
      // .exec('scxmld')
      .run('rm -rf ' + tempPath)
      .run('mkdir ' + tempPath)
      .exist(tempPath)
      .end(done);
  });

  afterEach(function (done) {
    nixt()
      .run('rm -rf ' + tempPath)
      .end(done);
  });

  it('should create helloworld file', function (done) {
    nixt()
      .cwd(tempPath)
      .run('scxml create helloworld.scxml')
      .exist(tempPath + 'helloworld.scxml')
      .end(done);
  });
});