#!/usr/bin/env node

'use strict';
// jshint node: true

var program = require('commander'),
  fs = require('fs'),
  openInBrowser = require('open'),
  repl = require('repl'),
  globwatcher = require('globwatcher').globwatcher,
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
    return 'http://localhost:8002';
  }
}

var swagger;

// Start the CLI
checkSwaggerHost(getHostFromArgv() + '/smaas.json');

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

// scxml save <foo.scxml> -n <StateChartName>
// node client.js save ./test1.scxml
// node client.js save -n test2 ./test1.scxml
program
  .command('save <path>')
  .description('Save or update a state machine definition.')
  .option('-n, --statechartname [name.scxml]', 'Specify a name for the state machine definition')
  .option('-w, --watch', 'Watch the scxml file for changes and save automatically.')
  .option('-h, --handler <path>', 'Send along http handler javascript file')
  .action(function(path, options) {

    if(options.watch) {      //Watch scxml file
      globwatcher(path).on('changed', function() {
        saveContents();
      });

      if(options.handler) {      //Watch handler file
        globwatcher(options.handler).on('changed', function() {
          saveContents();
        });
      }
    }

    saveContents();

    function saveContents () {
      fs.readFile(path, { encoding: 'utf-8' }, function (err, definition) {
        if (err) {
          logError('Error reading file', err);
          process.exit(1);
        }

        var fileName = pathNode.basename(path);
        var name = options.statechartname || fileName;
        name = name.indexOf(suffix) === -1 ? (name + suffix) : name;//Add .scxml suffix to all statecharts

        if(options.handler) {
          fs.readFile(options.handler, { encoding: 'utf-8' }, function (err, handler) {
            if (err) {
              logError('Error reading file', err);
              process.exit(1);
            }

            //Remove newlines, this helps writing javascript in json files.
            handler = handler.replace(/\n/g, '');
            var requestOptions = { parameterContentType: 'application/json', scxmlWithHandlers: { scxml: definition, handlers: handler }, StateChartName: name };
            swagger.apis.default.createOrUpdateStatechartDefinition(requestOptions, onStatechartSuccess, onStatechartError);
          });
        } else {
          var requestOptions = { parameterContentType: 'application/xml', scxmlDefinition: definition, StateChartName: name };

          swagger.apis.default.createOrUpdateStatechartDefinition(requestOptions, onStatechartSuccess, onStatechartError);
        }
      });

      function onStatechartSuccess (data) {
        logSuccess('Statechart saved, StateChartName:', data.headers.normalized.Location);
      }

      function onStatechartError (data) {
        logError('Error saving statechart', data.data.toString());
      }
    }
  });

// scxml cat <StatechartName>
//or
// scxml cat <InstanceId>
// node client.js cat test2
// node client.js cat test2/testinstance
program
  .command('cat <StatechartNameOrInstanceId>')
  .description('Get details of a statechart or an instance')
  .action(function(statechartnameOrInstanceId) {

    var statechartname = statechartnameOrInstanceId.split('/')[0],
      instanceId = statechartnameOrInstanceId.split('/')[1];

    if(instanceId) {
      swagger.apis.default.getInstance({ StateChartName: statechartname, InstanceId: instanceId }, function (data) {
        logSuccess('Instance details:', data.data.toString());
      }, function (data) {
        logError('Error getting instance detail', data.data.toString());
      });
    } else {
      swagger.apis.default.getStatechartDefinition({ StateChartName: statechartname }, function (data) {
        logSuccess('Statechart details:', data.data.toString());
      }, function (data) {
        logError('Error getting statechart detail', data.data.toString());
      });
    }
  });

// scxml ls [StateChartName]
// node client.js ls
// node client.js ls test2
program
  .command('ls [StateChartName]')
  .description('Get list of all statechart definitions or instances')
  .action(function(statechartname) {

    if(statechartname) {
      swagger.apis.default.getInstances({ StateChartName: statechartname }, function (data) {
        var instanceList = JSON.parse(data.data.toString()).data.instances;

        logSuccess('Instance list:', instanceList.map(function(instance) { return instance.id; }).join('\n'));
      }, function (data) {
        logError('Error getting instance list', data.data.toString());
      });
    } else {
      swagger.apis.default.getStatechartDefinitions({}, function (data) {
        var chartList = JSON.parse(data.data.toString()).data.charts;

        logSuccess('Statechart list:', chartList.join('\n'));
      }, function (data) {
        logError('Error getting statechart list', data.data.toString());
      });
    }
  });

// scxml run <StateChartName> -n <InstanceId>
// node client.js run test2
// node client.js run test 2 -n testinstance
program
  .command('run <StateChartName>')
  .description('Create an instance with the statechart definition.')
  .option('-n, --instanceId [instanceId]', 'Specify an id for the instance')
  .action(function(statechartname, options) {

    function onInstanceSuccess (data) {
      logSuccess('Instance created, InstanceId:', data.headers.normalized.Location);
    }

    function onInstanceError (data) {
      logError('Error on instance creation', data.data.toString());
    }

    if(options.instanceId) {
      swagger.apis.default.createNamedInstance({ StateChartName: statechartname, InstanceId: options.instanceId }, onInstanceSuccess, onInstanceError);
    } else {
      swagger.apis.default.createInstance({ StateChartName: statechartname }, onInstanceSuccess, onInstanceError);
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
    swagger.apis.default.sendEvent({  StateChartName: instanceId.split('/')[0],
                                      InstanceId: instanceId.split('/')[1],
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
      
    if(instanceId.indexOf('/') === -1) {
      logError('Specify an instance id');
      return;
    }

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
  .command('rm <StatechartNameOrInstanceId>')
  .description('Remove a statechart or an instance.')
  .action(function(statechartnameOrInstanceId) {

    var statechartname = statechartnameOrInstanceId.split('/')[0],
      instanceId = statechartnameOrInstanceId.split('/')[1];

    if(instanceId) {
      swagger.apis.default.deleteInstance({ StateChartName: statechartname, InstanceId: instanceId }, function () {
        logSuccess('Deleted instance');
      }, function (data) {
        logError('Error deleting instance', data.data.toString());
      });
    } else {
      swagger.apis.default.deleteStatechartDefinition({ StateChartName: statechartname }, function () {
        logSuccess('Deleted statechart and it\'s children');
      }, function (data) {
        logError('Error deleting statechart', data.data.toString());
      });
    }
  });

// scxml subscribe <InstanceId>
//or
// scxml subscribe <StateChartName>
// node client.js subscribe test2
// node client.js subscribe test2/testinstance
program
  .command('subscribe <StatechartNameOrInstanceId>')
  .description('Listen to changes on a statechart or an instance.')
  .action(function(statechartnameOrInstanceId) {

    var statechartname = statechartnameOrInstanceId.split('/')[0],
      instanceId = statechartnameOrInstanceId.split('/')[1],
      apiUrl = swagger.scheme + '://' + swagger.host + swagger.basePath,
      api, es;

    if(instanceId) {
      api = swagger.apisArray[0].operationsArray.filter(function (api) {
        return api.nickname === 'getInstanceChanges';
      })[0];

      var instanceChangesUrl = apiUrl + api.path.replace('{StateChartName}', statechartname).replace('{InstanceId}', instanceId);
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
    } else {
      api = swagger.apisArray[0].operationsArray.filter(function (api) {
        return api.nickname === 'getStatechartDefinitionChanges';
      })[0];

      var statechartChangesUrl = apiUrl + api.path.replace('{StateChartName}', statechartname);
      es = new EventSource(statechartChangesUrl);

      es.addEventListener('subscribed', function () {
        logSuccess('Started listening to statechart changes');
      }, false);

      es.addEventListener('onChange', function () {
        console.log('\u001b[32mStatechart changed\u001b[0m');
      }, false);

      es.onerror = function (error) {
        logError('Error listening to the statechart ', JSON.stringify(error));
        process.exit(1);
      };
    }
  });

// scxml viz <InstanceId>
// node client.js viz test2/testinstance
program
  .command('viz <StatechartNameOrInstanceId>')
  .description('Open visualization of the statechart or realtime visualization of the instance.')
  .option('-b, --browser', 'Open the default browser instead of the app')
  .action(function(statechartnameOrInstanceId, options) {

    var statechartname = statechartnameOrInstanceId.split('/')[0],
      instanceId = statechartnameOrInstanceId.split('/')[1],
      apiUrl = swagger.scheme + '://' + swagger.host + swagger.basePath;

    if(options.browser) {
      openInBrowser(apiUrl + '/' + statechartnameOrInstanceId + '/_viz');
    } else {
      var atom = require('atom-shell'),
        childProcess = require('child_process'),
        command = [__dirname + '/scxmlapp', apiUrl, statechartname];

      if(instanceId) command.push(instanceId);
    
      var child = childProcess.spawn( atom,
                                      command,
                                      { detached: true, stdio: ['ignore', 'ignore', 'ignore'] });

      //Detach the app from this process and get the cli back
      child.unref();
    }
  });

// scxml log <InstanceId>
// node client.js log test2/testinstance
program
  .command('log <InstanceId>')
  .description('Get all events of the instance.')
  .action(function(instanceId) {

    var statechartname = instanceId.split('/')[0];
    instanceId = instanceId.split('/')[1];

    swagger.apis.default.getEventLog({ StateChartName: statechartname, InstanceId: instanceId }, function (data) {
      
      var eventLog = JSON.parse(data.data.toString());

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
