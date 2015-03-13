#!/usr/bin/env node

var program = require('commander'),
  fs = require('fs'),
  swaggerClient = require("swagger-client");

var swagger = new swaggerClient.SwaggerClient({
  url: 'http://localhost:8002/smaas.json',
  success: onSwaggerSuccess
});

function onSwaggerSuccess () {
  console.log('REST api swaggerized');

  program.parse(process.argv);
}

// scxml create <foo.scxml> -n <StateChartName>
// node client.js create ./test1.scxml
// node client.js create -n test2 ./test1.scxml
program
  .command('create <path>')
  .description('Create or update a state machine definition.')
  .option("-n, --statechartname [name]", "Specify a name for the state machine definition")
  .action(function(path, options) {
    fs.readFile(path, { encoding: 'utf-8' }, function (err, definition) {
      if (err) {
        logError('Error reading file', err);
      }

      function onChartSuccess (data) {
        console.log('\u001b[32mStatechart created\u001b[0m');
        console.log('StateChartName:', data.headers.normalized.Location);
      }

      function onChartError (data) {
        logError('Error on statechart creation', data.data.toString());
      }

      if(options.statechartname) {
        swagger.apis.default.createOrUpdateStatechartDefinition({ scxmlDefinition: definition, StateChartName: options.statechartname }, { requestContentType: "application/xml" }, onChartSuccess, onChartError);
      } else {
        swagger.apis.default.createStatechartDefinition({ scxmlDefinition: definition }, { requestContentType: "application/xml" }, onChartSuccess, onChartError);
      }
    });
  });

// scxml cat <StatechartName>
// node client.js cat test2
program
  .command('cat <name>')
  .description('Get details of a statechart')
  .action(function(statechartname, options) {
    swagger.apis.default.getStatechartDefinition({ StateChartName: statechartname }, {}, function (data) {
      console.log('\u001b[32mStatechart details\u001b[0m:');
      console.log(data.data.toString());
    }, function (data) {
      logError('Error getting statechart detail', data.data.toString());
    });
  });

// scxml ls
// node client.js ls
program
  .command('ls')
  .description('Get list of all statechart definitions')
  .action(function(options) {
    swagger.apis.default.getStatechartDefinitions({}, {}, function (data) {
      console.log('\u001b[32mStatechart list\u001b[0m:');
      console.log(data.data.toString());
    }, function (data) {
      logError('Error getting statechart list', data.data.toString());
    });
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
      console.log('\u001b[32mInstance created\u001b[0m');
      console.log('InstanceId:', data.headers.normalized.Location);
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
      console.log('\u001b[32mEvent sent\u001b[0m:');
      console.log('Current state:', data.headers.normalized['X-Configuration']);
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
  .command('rm <InstanceId>')
  .description('Remove a statechart or an instance.')
  .action(function(statechartnameOrInstanceId, options) {
    var statechartname = statechartnameOrInstanceId.split('/')[0],
      instanceId = statechartnameOrInstanceId.split('/')[1];

    if(instanceId) {
      swagger.apis.default.deleteInstance({ StateChartName: statechartname, InstanceId: instanceId }, {}, function (data) {
        console.log('\u001b[32mDeleted instance \u001b[0m');
      }, function (data) {
        logError('Error deleting instance', data.data.toString());
      });
    } else {
      swagger.apis.default.deleteStatechartDefinition({ StateChartName: statechartname }, {}, function (data) {
        console.log('\u001b[32mDeleted statechart and it\'s children \u001b[0m');
      }, function (data) {
        logError('Error deleting statechart', data.data.toString());
      });
    }
  });

function logError (message, obj) {
  //Beep sound
  console.log('\u0007');

  if(message) console.log('\u001b[31mERROR\u001b[0m: ' + message + '\u001b[0m');
  if(obj) console.log(obj);
}