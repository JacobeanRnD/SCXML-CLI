#!/usr/bin/env node

var program = require('commander'),
  fs = require('fs'),
  swaggerClient = require("swagger-client"),
  EventSource = require('eventsource');

var swagger = new swaggerClient.SwaggerClient({
  url: 'http://localhost:8002/smaas.json',
  success: onSwaggerSuccess
});

var apiUrl;

function onSwaggerSuccess () {
  apiUrl = swagger.scheme + '://' + swagger.host + swagger.basePath;

  program.parse(process.argv);
}

// scxml save <foo.scxml> -n <StateChartName>
// node client.js save ./test1.scxml
// node client.js save -n test2 ./test1.scxml
program
  .command('save <path>')
  .description('Save or update a state machine definition.')
  .option("-n, --statechartname [name]", "Specify a name for the state machine definition")
  .action(function(path, options) {
    fs.readFile(path, { encoding: 'utf-8' }, function (err, definition) {
      if (err) {
        logError('Error reading file', err);
      }

      function onChartSuccess (data) {
        logSuccess('Statechart saved, StateChartName:', data.headers.normalized.Location);
      }

      function onChartError (data) {
        logError('Error saving statechart', data.data.toString());
      }

      if(options.statechartname) {
        swagger.apis.default.createOrUpdateStatechartDefinition({ parameterContentType: "application/xml", scxmlDefinition: definition, StateChartName: options.statechartname }, { requestContentType: "application/xml" }, onChartSuccess, onChartError);
      } else {
        swagger.apis.default.createStatechartDefinition({ parameterContentType: "application/xml", scxmlDefinition: definition }, { requestContentType: "application/xml" }, onChartSuccess, onChartError);
      }
    });
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
  .action(function(statechartname, options) {
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
  .action(function(statechartname, options) {
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

// scxml send <InstanceId> <eventName> -d <data>
// node client.js send t
// node client.js send t -d somedata
program
  .command('send <InstanceId> <eventName>')
  .description('Send an event to a statechart instance.')
  .option("-d, --eventData [eventData]", "Specify an id for the instance")
  .action(function(instanceId, eventName, options) {
    swagger.apis.default.sendEvent({ StateChartName: instanceId.split('/')[0], InstanceId: instanceId.split('/')[1], Event: {name: eventName, data: options.eventData} }, {}, function (data) {
      logSuccess('Event sent, Current state:', data.headers.normalized['X-Configuration']);
    }, function (data) {
      logError('Error sending event', data.data.toString());
    });
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
  .action(function(statechartnameOrInstanceId, options) {
    var statechartname = statechartnameOrInstanceId.split('/')[0],
      instanceId = statechartnameOrInstanceId.split('/')[1];

    if(instanceId) {
      var api = swagger.apisArray[0].operationsArray.filter(function (api) {
        return api.nickname === 'getInstanceChanges';
      })[0];

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
  .command('viz <InstanceId>')
  .description('Open realtime visualization of the instance.')
  .option("-w, --watch", "Watch the scxml file for changes auto reload visualization")
  .option("-i, --interactive", "Starts interactive repl shell on the CLI")
  .action(function(instanceId, options) {
    

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
  console.log('\u0007');

  if(message) console.log('\u001b[31mERROR\u001b[0m: ' + message);
  if(obj) console.log(obj);
}