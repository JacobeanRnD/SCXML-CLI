#!/usr/bin/env node

var program = require('commander'),
  fs = require('fs'),
  open = require('open'),
  repl = require('repl'),
  parseString = require('xml2js').parseString,
  globwatcher = require('globwatcher').globwatcher,
  swaggerClient = require("swagger-client"),
  EventSource = require('eventsource'),
  pathNode = require('path');

var suffix = '.scxml';


var parseNodeTenREPL = function (cmd) {
  var e = cmd.split(/\((.*)\n\)/)[1].split(/ +/);
  return { name: e[0], data: e[1] };
}
var parseNodeElevenREPL = function (cmd) {
  var e = cmd.split(/[\n\r]/g)[0].split(/ +/);
  return { name: e[0], data: e[1] };
}

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
    logError('Node version is not supported', nodeVersion);
    process.exit(1);
}

var swagger = new swaggerClient.SwaggerClient({
  url: 'http://localhost:8002/smaas.json',
  success: onSwaggerSuccess
});

function onSwaggerSuccess () {
  program.parse(process.argv);

  if (process.argv.length <= 2) {
    logError('Unrecognized command');
    program.outputHelp();
  }
}

// scxml save <foo.scxml> -n <StateChartName>
// node client.js save ./test1.scxml
// node client.js save -n test2 ./test1.scxml
program
  .command('save <path>')
  .description('Save or update a state machine definition.')
  .option("-n, --statechartname [name.scxml]", "Specify a name for the state machine definition")
  .option("-w, --watch", "Watch the scxml file for changes and save automatically.")
  .option("-H, --host <host>", "Change server host")
  .action(function(path, options) {
    if(options.host) changeSwaggerHost(options.host);

    if(options.watch) {      //Watch scxml file
      globwatcher(path).on('changed', function() {
        saveContents();
      }); 
    }

    saveContents();
    function saveContents () {
      fs.readFile(path, { encoding: 'utf-8' }, function (err, definition) {
        if (err) {
          logError('Error reading file', err);
          process.exit(1);
        }

        parseString(definition, function (err, result) {
          if (err) {
            logError('Error reading file', err);
            process.exit(1);
          }

          var fileName = pathNode.basename(path);

          var name = options.statechartname || result.scxml['$'].name || fileName;
          name = name.indexOf('.scxml') === -1 ? (name + '.scxml') : name;

          swagger.apis.default.createOrUpdateStatechartDefinition({ parameterContentType: "application/xml",
                                                                    scxmlDefinition: definition,
                                                                    StateChartName: name },
                                                                  { }, function (data) {
                                                                    logSuccess('Statechart saved, StateChartName:', data.headers.normalized.Location);
                                                                  }, function (data) {
                                                                    logError('Error saving statechart', data.data.toString());
                                                                  });
        });
      });
    }
  });

// scxml inspect <StatechartName>
//or
// scxml inspect <InstanceId>
// node client.js inspect test2
// node client.js inspect test2/testinstance
program
  .command('inspect <StatechartNameOrInstanceId>')
  .description('Get details of a statechart or an instance')
  .option("-H, --host <host>", "Change server host")
  .action(function(statechartnameOrInstanceId, options) {
    if(options.host) changeSwaggerHost(options.host);

    var statechartname = statechartnameOrInstanceId.split('/')[0],
      instanceId = statechartnameOrInstanceId.split('/')[1];

    if(instanceId) {
      swagger.apis.default.getInstance({ StateChartName: statechartname, InstanceId: instanceId }, {}, function (data) {
        logSuccess('Instance details:', data.data.toString());
      }, function (data) {
        logError('Error getting instance detail', data.data.toString());
      });
    } else {
      swagger.apis.default.getStatechartDefinition({ StateChartName: statechartname }, {}, function (data) {
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
  .option("-H, --host <host>", "Change server host")
  .action(function(statechartname, options) {
    if(options.host) changeSwaggerHost(options.host);

    if(statechartname) {
      swagger.apis.default.getInstances({ StateChartName: statechartname }, {}, function (data) {
        logSuccess('Instance list:', data.data.toString());
      }, function (data) {
        logError('Error getting instance list', data.data.toString());
      });
    } else {
      swagger.apis.default.getStatechartDefinitions({}, {}, function (data) {
        logSuccess('Statechart list:', data.data.toString());
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
  .option("-n, --instanceId [instanceId]", "Specify an id for the instance")
  .option("-H, --host <host>", "Change server host")
  .action(function(statechartname, options) {
    if(options.host) changeSwaggerHost(options.host);

    function onInstanceSuccess (data) {
      logSuccess('Instance created, InstanceId:', data.headers.normalized.Location);
    }

    function onInstanceError (data) {
      logError('Error on instance creation', data.data.toString());
    }

    if(options.instanceId) {
      swagger.apis.default.createNamedInstance({ StateChartName: statechartname, InstanceId: options.instanceId }, { }, onInstanceSuccess, onInstanceError);
    } else {
      swagger.apis.default.createInstance({ StateChartName: statechartname }, { }, onInstanceSuccess, onInstanceError);
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
  .option("-H, --host <host>", "Change server host")
  .action(function(instanceId, eventName, eventData, options) {
    if(options.host) changeSwaggerHost(options.host);

    parseAndSendEvent(instanceId, eventName, eventData);
  });

function parseAndSendEvent(instanceId, eventName, eventData, done) {
  if(eventName[0] === '@') {
    //event: @data_file.json
    readJSONFile(eventName.substring(1, eventName.length), function (event) {
      sendEvent(instanceId, event, done);
    });   
  } else if(eventData) {
    if(eventData[0] === '@') {
      //event: name @data_file.json
      readJSONFile(eventData.substring(1, eventData.length), function (eventData) {
        sendEvent(instanceId, { name: eventName, data: eventData }, done);
      });
    } else {
      //event: name arbitrary_data
      try {
        eventData = JSON.parse(eventData);
        sendEvent(instanceId, { name: eventName, data: eventData }, done);
      } catch(err) {
        logError('Error parsing JSON data', err);
      }
    }
  } else {
    //event: name
    sendEvent(instanceId, { name: eventName }, done);
  }

  function readJSONFile (path, done) {
    fs.readFile(path, { encoding: 'utf-8' }, function (err, data) {
      if (err) {
        logError('Error reading file', err);
      }

      try {
        data = JSON.parse(data);
      } catch(err) {
        logError('Error parsing JSON file', err);
      }

      done(data);
    });
  }

  function sendEvent(instanceId, event, done) {
    console.log('Sending event', event);
    swagger.apis.default.sendEvent({  StateChartName: instanceId.split('/')[0],
                                      InstanceId: instanceId.split('/')[1],
                                      Event: event }, {}, function (data) {
      logSuccess('Sent event:', event);
      if(done) done(null, data.headers.normalized['X-Configuration']);
    }, function (data) {
      logError('Error sending event', data.data.toString());
      if(done) done(data.data.toString());
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
  .option("-H, --host <host>", "Change server host")
  .action(function(instanceId, options) {
    if(options.host) changeSwaggerHost(options.host);
    
    repl.start({
      prompt: "scxml >",
      input: process.stdin,
      output: process.stdout,
      eval: runCommand
    });

    function runCommand (cmd, context, filename, callback) {
      var event = parseREPL(cmd);
      parseAndSendEvent(instanceId, event.name, event.data, callback);
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
  .option("-H, --host <host>", "Change server host")
  .action(function(statechartnameOrInstanceId, options) {
    if(options.host) changeSwaggerHost(options.host);

    var statechartname = statechartnameOrInstanceId.split('/')[0],
      instanceId = statechartnameOrInstanceId.split('/')[1];

    if(instanceId) {
      swagger.apis.default.deleteInstance({ StateChartName: statechartname, InstanceId: instanceId }, {}, function (data) {
        logSuccess('Deleted instance');
      }, function (data) {
        logError('Error deleting instance', data.data.toString());
      });
    } else {
      swagger.apis.default.deleteStatechartDefinition({ StateChartName: statechartname }, {}, function (data) {
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
  .option("-H, --host <host>", "Change server host")
  .action(function(statechartnameOrInstanceId, options) {
    if(options.host) changeSwaggerHost(options.host);

    var statechartname = statechartnameOrInstanceId.split('/')[0],
      instanceId = statechartnameOrInstanceId.split('/')[1];

    if(instanceId) {
      var api = swagger.apisArray[0].operationsArray.filter(function (api) {
        return api.nickname === 'getInstanceChanges';
      })[0];

      var apiUrl = swagger.scheme + '://' + swagger.host + swagger.basePath;
      var instanceChangesUrl = apiUrl + api.path.replace('{StateChartName}', statechartname).replace('{InstanceId}', instanceId);
      var es = new EventSource(instanceChangesUrl);

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
        logError('Error listening to the instance', error);
        process.exit(1);
      };
    } else {
      var api = swagger.apisArray[0].operationsArray.filter(function (api) {
        return api.nickname === 'getStatechartDefinitionChanges';
      })[0];

      var statechartChangesUrl = apiUrl + api.path.replace('{StateChartName}', statechartname);
      var es = new EventSource(statechartChangesUrl);

      es.addEventListener('subscribed', function () {
        logSuccess('Started listening to statechart changes');
      }, false);

      es.addEventListener('onChange', function () {
        console.log('\u001b[32mStatechart changed\u001b[0m');
      }, false);

      es.onerror = function (error) {
        logError('Error listening to the statechart', error);
        process.exit(1);
      };
    }
  });

// scxml viz <InstanceId>
// node client.js viz test2/testinstance
program
  .command('viz <StatechartNameOrInstanceId>')
  .description('Open visualization of the statechart or realtime visualization of the instance.')
  .option("-H, --host <host>", "Change server host")
  .action(function(statechartnameOrInstanceId, options) {
    if(options.host) changeSwaggerHost(options.host);

    var apiUrl = swagger.scheme + '://' + swagger.host + swagger.basePath;
    open(apiUrl + '/' + statechartnameOrInstanceId + '/_viz');
  });

// scxml log <InstanceId>
// node client.js log test2/testinstance
program
  .command('log <InstanceId>')
  .description('Get all events of the instance.')
  .option("-H, --host <host>", "Change server host")
  .action(function(instanceId, options) {
    if(options.host) changeSwaggerHost(options.host);

    var statechartname = instanceId.split('/')[0],
      instanceId = instanceId.split('/')[1];

    swagger.apis.default.getEventLog({ StateChartName: statechartname, InstanceId: instanceId }, {}, function (data) {
      
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
  .action(function(env){
    program.outputHelp();
  });

program
  .command('*')
  .description('Print out help')
  .action(function(env){
    logError('Unrecognized command');
    program.outputHelp();
  });

function changeSwaggerHost (host, apiName) {
  swagger.host = host;
  swagger.apisArray[0].operationsArray.forEach(function (api, i) {
    swagger.apisArray[0].operationsArray[i].host = host;
  });
}

function logSuccess (message, obj) {
  if(message) console.log('\u001b[32m' + message + '\u001b[0m');
  if(obj) console.log(obj);
}

function logError (message, obj) {
  //Beep sound
  console.log('\u0007');

  if(message) console.log('\u001b[31mERROR\u001b[0m: ' + message);
  if(obj) console.log(obj);
}