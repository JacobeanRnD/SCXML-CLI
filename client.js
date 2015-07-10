#!/usr/bin/env node

'use strict';
// jshint node: true

var program = require('commander'),
  fs = require('fs'),
  openInBrowser = require('open'),
  repl = require('repl'),
  swaggerClient = require('swagger-client'),
  EventSource = require('eventsource'),
  url = require('url'),
  http = require('http'),
  pathNode = require('path');

var suffix = '.scxml';

var parseNodeTenREPL = function (cmd) {
  var e = cmd.split(/\((.*)\n\)/)[1].split(/ +/);
  return { name: e[0], data: e[1] };
};
var parseNodeElevenREPL = function (cmd) {
  var e = cmd.split(/[\n\r]/g)[0].split(/ +/);
  return { name: e[0], data: e[1] };
};

var parseREPL;
switch(process.version.substring(0, 5)) {
  case 'v0.12':
  case 'v0.11':
    parseREPL = parseNodeElevenREPL;
    break;
  case 'v0.10':
    parseREPL = parseNodeTenREPL;
    break;
  default:
    logError('Node version is not supported', process.version);
    process.exit(1);
}

function getHostFromArgv(){
  var hostArgIndex =  process.argv.indexOf('-H');
  
  if(hostArgIndex === -1){
    hostArgIndex = process.argv.indexOf('--host');
  }

  if(hostArgIndex > -1){
    var hostOption = process.argv[hostArgIndex + 1];
    
    process.argv.splice(hostArgIndex, 2);

    var hostUrl = url.parse(hostOption);

    if(hostUrl.auth) {
      // Example: scxml -H http://username:password@localhost:3000/username save helpers/test1.scxml
      var userAuth = hostUrl.auth.split(':');
      swaggerClient.authorizations.add('auth', new swaggerClient.PasswordAuthorization('password', userAuth[0], userAuth[1]));
    }

    return hostOption;
  } else{
    return 'http://localhost:3000';
  }
}

var swagger;

// Start the CLI
checkSwaggerHost(getHostFromArgv() + '/api/v3/smaas.json');

function checkSwaggerHost(smaasUrl) {
  var parsedUrl = url.parse(smaasUrl);

  // We are checking Smaas.json file beforehand with HEAD request
  // Because swagger is throwing an async error that we can't catch
  // And it looks confusing
  var req = http.request({  method: 'HEAD',
                            host: parsedUrl.hostname,
                            port: parsedUrl.port,
                            path: parsedUrl.path,
                            auth: parsedUrl.auth
                          }, function(res) {
    res.on('data', function () {});
    
    if(res.statusCode !== 200) {
      logError('There was an error loading smaas.json at: ' + 
                  smaasUrl +
                  ' HTTP response: ' +
                  res.statusCode, res.headers);
    } else {
      swagger = new swaggerClient.SwaggerClient({
        url: smaasUrl,
        success: onSwaggerSuccess
      }); 
    }
  });

  req.on('error', function(e) {
    logError('There was an error loading smaas.json at: ' + smaasUrl, e);
  });

  req.end();  
}

function onSwaggerSuccess () {
  program.parse(process.argv);

  if (process.argv.length <= 2) {
    logError('Unrecognized command');
    program.outputHelp();
  }
}


// scxml create <foo.scxml>
// node client.js create test1.scxml
program
  .command('create <path>')
  .description('Create an scxml file on given path')
  .action(function(path) {
    var fileName = pathNode.basename(path);
    fileName = fileName || 'helloworld.scxml';
    fileName = fileName.indexOf(suffix) === -1 ? (fileName + suffix) : fileName;

    var finalPath = pathNode.dirname(path) + '/' + fileName;

    var fileContent = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                      '<scxml xmlns="http://www.w3.org/2005/07/scxml" name="helloworld" datamodel="ecmascript" version="1.0">\n' +
                      '  <state id="a">\n' +
                      '    <transition target="b" event="t"/>\n' +
                      '  </state>\n' +
                      '  <state id="b">\n' +
                      '    <transition target="c" event="t"/>\n' +
                      '  </state>\n' +
                      '  <state id="c">\n' +
                      '    <transition target="a" event="t"/>\n' +
                      '  </state>\n' +
                      '</scxml>';

    fs.writeFile(finalPath, fileContent, 'utf-8', function (err) {
      if (err) {
        logError('Error reading file', err);
        process.exit(1);
      }

      logSuccess('Statechart file created locally, StateChartName:', fileName);
    });
  });

// scxml cat <InstanceId>
// node client.js cat test2
// node client.js cat test2/testinstance
program
  .command('cat <InstanceId>')
  .description('Get details of a statechart or an instance')
  .action(function(instanceId) {

    swagger.apis.scxml.getInstance({ InstanceId: instanceId }, function (data) {
      logSuccess('Instance details:', JSON.stringify(JSON.parse(data.data.toString()).data.instance.snapshot));
    }, function (data) {
      logError('Error getting instance detail', data.data.toString());
    });
  });


// scxml ls 
// node client.js ls
program
  .command('ls')
  .description('Get list of all statechart definitions or instances')
  .action(function() {
    swagger.apis.scxml.getInstances({}, function (data) {
      var instanceList = JSON.parse(data.data.toString()).data.instances;

      logSuccess('Instance list:', instanceList.join('\n'));
    }, function (data) {
      logError('Error getting instance list', data.data.toString());
    });
  });

// scxml run -n <InstanceId>
// node client.js run 
// node client.js run -n testinstance
program
  .command('run')
  .description('Create an instance with the statechart definition.')
  .option('-n, --instanceId [instanceId]', 'Specify an id for the instance')
  .action(function(options) {

    function onInstanceSuccess (data) {
      logSuccess('Instance created, InstanceId:', data.headers.normalized.Location);
    }

    function onInstanceError (data) {
      logError('Error on instance creation', data.data.toString());
    }

    if(options.instanceId) {
      swagger.apis.scxml.createNamedInstance({ InstanceId: options.instanceId }, onInstanceSuccess, onInstanceError);
    } else {
      swagger.apis.scxml.createInstance({}, onInstanceSuccess, onInstanceError);
    }
  });

// scxml send <InstanceId> <eventName> <data>
// node client.js send test2/testinstance t
// node client.js send test2/testinstance t '{"test":"test"}'
// node client.js send test2/testinstance t @eventData.json
// node client.js send test2/testinstance @event.json
program
  .command('send <InstanceId> <eventName> [eventData]')
  .description('Send an event to a statechart instance.')
  .action(function(instanceId, eventName, eventData) {
    parseAndSendEvent(instanceId, eventName, eventData, function (err, data) {
      if(err) logError(err.message || err);
      else logSuccess('Current:', data.headers.normalized['X-Configuration']);
    });
  });

function parseAndSendEvent(instanceId, eventName, eventData, done) {
  if(eventName[0] === '@') {
    //event: @data_file.json
    readJSONFile(eventName.substring(1, eventName.length), function (err, event) {
      if (err) return done(err);

      sendEvent(instanceId, event, done);
    });   
  } else if(eventData) {
    if(eventData[0] === '@') {
      //event: name @data_file.json
      readJSONFile(eventData.substring(1, eventData.length), function (err, eventData) {
        if (err) return done(err);

        sendEvent(instanceId, { name: eventName, data: eventData }, done);
      });
    } else {
      //event: name arbitrary_data
      try {
        eventData = JSON.parse(eventData);
        sendEvent(instanceId, { name: eventName, data: eventData }, done);
      } catch(err) {
        return done(err);
      }
    }
  } else {
    //event: name
    sendEvent(instanceId, { name: eventName }, done);
  }

  function readJSONFile (path, done) {
    fs.readFile(path, { encoding: 'utf-8' }, function (err, data) {
      if (err) return done(err);

      try {
        data = JSON.parse(data);
      } catch(err) {
        return done(err);
      }

      done(null, data);
    });
  }

  function sendEvent(instanceId, event, done) {
    swagger.apis.scxml.sendEvent({  InstanceId: instanceId,
                                      Event: event
                                    }, function (data) {
      done(null, data);
    }, function (data) {
      done(data.data.toString());
    });
  }
}

// scxml interact <InstanceId>
// node client.js interact test2/testinstance
//scxml > t
//scxml > t { "test": "test"}
//scxml > t @eventData.json
//scxml > @event.json
program
  .command('interact <InstanceId>')
  .description('Start REPL interface to send events to a statechart instance.')
  .action(function(instanceId) {
      
    repl.start({
      prompt: 'scxml >',
      input: process.stdin,
      output: process.stdout,
      eval: runCommand
    });

    function runCommand (cmd, context, filename, callback) {
      var event = parseREPL(cmd);
      parseAndSendEvent(instanceId, event.name, event.data, function (err, data) {
        if(err) callback(err.message || err);
        else callback(null, data.headers.normalized['X-Configuration']);
      });
    }
  });

// scxml rm <InstanceId>
//or
// scxml rm <StateChartName>
// node client.js rm test2
// node client.js rm test2/testinstance
program
  .command('rm <InstanceId>')
  .description('Remove a statechart or an instance.')
  .action(function(instanceId) {
    swagger.apis.scxml.deleteInstance({ InstanceId: instanceId }, function () {
      logSuccess('Deleted instance');
    }, function (data) {
      logError('Error deleting instance', data.data.toString());
    });
  });

// scxml subscribe <InstanceId>
//or
// scxml subscribe <StateChartName>
// node client.js subscribe test2
// node client.js subscribe test2/testinstance
program
  .command('subscribe <InstanceId>')
  .description('Listen to changes on a statechart or an instance.')
  .action(function(instanceId) {

    var apiUrl = swagger.scheme + '://' + swagger.host + swagger.basePath,
      api, es;

    api = swagger.apisArray[0].operationsArray.filter(function (api) {
      return api.nickname === 'getInstanceChanges';
    })[0];

    var instanceChangesUrl = apiUrl + api.path.replace('{InstanceId}', instanceId);
    es = new EventSource(instanceChangesUrl);

    es.addEventListener('subscribed', function () {
      logSuccess('Started listening to instance changes');
    }, false);

    es.addEventListener('onEntry', function (e) {
      console.log(e.type, '-', e.data);
    }, false);
    es.addEventListener('onExit', function (e) {
      console.log(e.type, '-', e.data);
    }, false);

    es.onerror = function (error) {
      logError('Error listening to the instance ', JSON.stringify(error));
      process.exit(1);
    };
  });

// scxml viz <InstanceId>
// node client.js viz test2/testinstance
program
  .command('viz <InstanceId>')
  .description('Open visualization of the statechart or realtime visualization of the instance.')
  .action(function(instanceId, options) {

    var apiUrl = swagger.scheme + '://' + swagger.host;

    openInBrowser(apiUrl + '/' + instanceId + '/_viz');
  });

// scxml log <InstanceId>
// node client.js log test2/testinstance
program
  .command('log <InstanceId>')
  .description('Get all events of the instance.')
  .action(function(instanceId) {

    swagger.apis.scxml.getEventLog({ InstanceId: instanceId }, function (data) {
      var eventLog = JSON.parse(data.data.toString()).data.events;

      logSuccess('Event log:');
      eventLog.forEach(function (event) {
        console.log(JSON.stringify(event, null, 0));
      });
    }, function (data) {
      logError('Error deleting statechart', data.data.toString());
    });
  });

program
  .command('help')
  .description('Print out help')
  .action(function(){
    program.outputHelp();
  });

program
  .command('*')
  .description('Print out help')
  .action(function(){
    logError('Unrecognized command');
    program.outputHelp();
  });

function logSuccess (message, obj) {
  if(message) console.log('\u001b[32m' + message + '\u001b[0m');
  if(obj) console.log(obj);
}

function logError (message, obj) {
  //Beep sound
  process.stderr.write('\u0007\n');

  if(message) process.stderr.write('\u001b[31mERROR\u001b[0m: ' + message + '\n');
  if(obj) process.stderr.write(obj + '\n');
}
