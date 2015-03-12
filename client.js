#!/usr/bin/env node

var swaggerClient = require("swagger-client");

var swagger = new swaggerClient.SwaggerClient({
  url: 'http://localhost:8002/smaas.json',
  success: function() {

    var definition = '<scxml  ' +
      '    name="basic" ' +
      '    datamodel="ecmascript" ' +
      '    xmlns="http://www.w3.org/2005/07/scxml" ' +
      '    version="1.0"> ' +
      '    <state id="a"> ' +
      '        <transition target="b" event="t"/> ' +
      '    </state> ' +
      '    <state id="b"> ' +
      '        <transition target="a" event="t"/> ' +
      '    </state> ' +
      '</scxml>';

    swagger.apis.default.createStatechartDefinition({ scxmlDefinition: definition }, { requestContentType: "application/xml" }, function(data) {
      console.log(JSON.stringify(data.headers.normalized.Location));

      swagger.apis.default.createInstance({ StateChartName: 'basic' }, function(data) {
        var instanceUrl = data.headers.normalized.Location;

        console.log(JSON.stringify(instanceUrl));

        swagger.apis.default.sendEvent({ StateChartName: 'basic', InstanceId: instanceUrl.split('/')[1], Event: {name: 't'} }, function(data) {
          console.log(JSON.stringify(data.data.toString()));
        });
      });
    });
  }
});