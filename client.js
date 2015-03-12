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

// scxml create <foo.scxml>
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

function logError (message, obj) {
  //Beep sound
  console.log('\u0007');

  if(message) console.log('\u001b[31mERROR\u001b[0m: ' + message + '\u001b[0m');
  if(obj) console.log(obj);
}

// function onSwaggerSuccess() {
//     var definition = '<scxml  ' +
//       '    name="basic" ' +
//       '    datamodel="ecmascript" ' +
//       '    xmlns="http://www.w3.org/2005/07/scxml" ' +
//       '    version="1.0"> ' +
//       '    <state id="a"> ' +
//       '        <transition target="b" event="t"/> ' +
//       '    </state> ' +
//       '    <state id="b"> ' +
//       '        <transition target="a" event="t"/> ' +
//       '    </state> ' +
//       '</scxml>';

//     swagger.apis.default.createStatechartDefinition({ scxmlDefinition: definition }, { requestContentType: "application/xml" }, function(data) {
//       console.log(JSON.stringify(data.headers.normalized.Location));

//       swagger.apis.default.createInstance({ StateChartName: 'basic' }, function(data) {
//         var instanceUrl = data.headers.normalized.Location;

//         console.log(JSON.stringify(instanceUrl));

//         swagger.apis.default.sendEvent({ StateChartName: 'basic', InstanceId: instanceUrl.split('/')[1], Event: {name: 't'} }, function(data) {
//           console.log(JSON.stringify(data.data.toString()));
//         });
//       });
//     });
//   }