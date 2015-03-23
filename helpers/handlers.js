{
    "twilio" : "function() { var instance = scxml.createInstance(); scxml.send(instance, {name: 't'}); res.send('twilio ' + instance.getConfiguration()); }",
    "twitter": "function() { res.send('twitter' + req.path + scxml); }"
}