#!/usr/bin/env node

var program = require('commander'),
  fs = require('fs'),
  open = require('open'),
  repl = require('repl'),
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

function getHostFromArgv(){
  var hostArgIndex =  process.argv.indexOf('-H');
  if(hostArgIndex === -1){
    hostArgIndex = process.argv.indexOf('--host')
  }
  if(hostArgIndex > -1){
    var hostOption = process.argv[hostArgIndex + 1];
    process.argv.splice(hostArgIndex, 2);
    return hostOption;
  }else{
    return 'http://localhost:8002';
  }
}

var swagger = new swaggerClient.SwaggerClient({
  url: getHostFromArgv() + '/smaas.json',
  success: onSwaggerSuccess
});

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
  .action(function(path, options) {
    var fileName = pathNode.basename(path);
    fileName = fileName || 'helloworld.scxml';
    fileName = fileName.indexOf('.scxml') === -1 ? (fileName + '.scxml') : fileName;

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
  .option("-n, --statechartname [name.scxml]", "Specify a name for the state machine definition")
  .option("-w, --watch", "Watch the scxml file for changes and save automatically.")
  .option("-h, --handler <path>", "Send along http handler javascript file")
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
        name = name.indexOf('.scxml') === -1 ? (name + '.scxml') : name;//Add .scxml suffix to all statecharts

        if(options.handler) {
          fs.readFile(options.handler, { encoding: 'utf-8' }, function (err, handler) {
            if (err) {
              logError('Error reading file', err);
              process.exit(1);
            }

            //Remove newlines, this helps writing javascript in json files.
            handler = handler.replace(/\n/g, '');
            var requestOptions = { parameterContentType: "application/json", scxmlWithHandlers: { scxml: definition, handlers: handler }, StateChartName: name };
            swagger.apis.default.createOrUpdateStatechartDefinition(requestOptions, onStatechartSuccess, onStatechartError);
          });
        } else {
          var requestOptions = { parameterContentType: "application/xml", scxmlDefinition: definition, StateChartName: name };

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
  .action(function(statechartnameOrInstanceId, options) {

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
  .action(function(statechartname, options) {

    if(statechartname) {
      swagger.apis.default.getInstances({ StateChartName: statechartname }, function (data) {
        logSuccess('Instance list:', data.data.toString());
      }, function (data) {
        logError('Error getting instance list', data.data.toString());
      });
    } else {
      swagger.apis.default.getStatechartDefinitions({}, function (data) {
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
  .action(function(instanceId, eventName, eventData, options) {

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
    swagger.apis.default.sendEvent({  StateChartName: instanceId.split('/')[0],
                                      InstanceId: instanceId.split('/')[1],
                                      Event: event
                                    }, function (data) {
      logSuccess('Current:', data.headers.normalized['X-Configuration']);
      
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
  .action(function(instanceId, options) {
      
    if(instanceId.indexOf('/') === -1) {
      logError('Specify an instance id');
      return;
    }

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
  .action(function(statechartnameOrInstanceId, options) {

    var statechartname = statechartnameOrInstanceId.split('/')[0],
      instanceId = statechartnameOrInstanceId.split('/')[1];

    if(instanceId) {
      swagger.apis.default.deleteInstance({ StateChartName: statechartname, InstanceId: instanceId }, function (data) {
        logSuccess('Deleted instance');
      }, function (data) {
        logError('Error deleting instance', data.data.toString());
      });
    } else {
      swagger.apis.default.deleteStatechartDefinition({ StateChartName: statechartname }, function (data) {
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
  .action(function(statechartnameOrInstanceId, options) {

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
  .option("-b, --browser", "Open the default browser instead of the app")
  .action(function(statechartnameOrInstanceId, options) {

    var statechartname = statechartnameOrInstanceId.split('/')[0],
      instanceId = statechartnameOrInstanceId.split('/')[1],
      apiUrl = swagger.scheme + '://' + swagger.host + swagger.basePath;

    if(options.browser) {
      open(apiUrl + '/' + statechartnameOrInstanceId + '/_viz');
    } else {
      var atom = require('atom-shell'),
        childProcess = require('child_process'),
        options = [__dirname + '/scxmlapp', apiUrl, statechartname];

      if(instanceId) options.push(instanceId);
    
      var child = childProcess.spawn( atom,
                                      options,
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
  .action(function(instanceId, options) {

    var statechartname = instanceId.split('/')[0],
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
