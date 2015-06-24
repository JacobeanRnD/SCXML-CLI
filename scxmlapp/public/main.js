// jshint browser: true, jquery:true
/* global alert, EventSource, require, _ */

$(function() {
  'use strict';

  var options;

  require('ipc').on('scxml-cli-server-ready', function(opt) {
    options = opt;
    
    getScxml();
  });

  var vizArea = $('#viz-area'),
    layout,
    eventChangeSource,
    scxmlChangeSource,
    isFirst = true;

  var updateLayout = _.debounce(function() {
    layout.invalidateSize();
  }, 500);

  window.addEventListener('resize', updateLayout, false);

  function getScxml() {
    $.ajax({
      type: 'GET',
      url: options.apiUrl,
      dataType: 'text'
    })
    .done(function(data, status) {
      if (status !== 'success') {
        alert('Error retrieving scxml content:', status);
        return;
      }

      drawSimulation(data, function () {
        if(isFirst) {
          layout.fit();
          isFirst = false;  
        }

        if(!options.instanceId) {
          return;
        }

        if (!eventChangeSource) {
          eventChangeSource = new EventSource(options.apiUrl + '/' + options.instanceId + '/_changes');

          eventChangeSource.addEventListener('onEntry', function(e) {
            highlight('onEntry', e.data);
          }, false);

          eventChangeSource.addEventListener('onExit', function(e) {
            highlight('onExit', e.data);
          }, false);
        }

        $.ajax({
            type: 'GET',
            url: options.apiUrl + '/' + options.instanceId,
            dataType: 'json'
          })
          .done(function(configuration, status) {
            if (status !== 'success') {
              alert('Error retrieving instance configuration:', status);
              return;
            }

            configuration.data.instance.snapshot.forEach(highlight.bind(this, 'onEntry'));
          });
      }, function (err) {
        alert(err.message);
      });
    });
  }

  function highlight(eventName, state) {
    if (Array.isArray(state)) {
      for (var eventIndex in state) {
        layout.highlightState(state[eventIndex], eventName === 'onEntry');
      }
    } else {
      layout.highlightState(state, eventName === 'onEntry');
    }
  }

  function drawSimulation(content, onDone, onError) {
    var doc = (new DOMParser()).parseFromString(content, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      return onError({ message: $(doc).find('parsererror div').html() });
    }

    if (layout) {
      layout.unhighlightAllStates();
      layout.update(doc).then(onDone, onError);
    } else {
      vizArea.empty();

      layout = new forceLayout.Layout({ // jshint ignore:line
        kielerAlgorithm: '__klayjs',
        parent: vizArea[0],
        doc: doc,
        textOnPath: false,
        routing: 'ORTHOGONAL',
        debug: false
      });

      layout.initialized.then(onDone, onError);
    }
  }
});
