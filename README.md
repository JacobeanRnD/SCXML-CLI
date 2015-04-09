## SCXML-CLI

This is the command-line client to SCXMLD, the SCXML orchestration server.


### Installation

```
git clone git@github.com:JacobeanRnD/SCXML-CLI.git
cd SCXML-CLI
npm install -g .
```

### Usage

```
  Usage: scxml [options] [command]


  Commands:

    create <path>                               Create an scxml file on given path
    save [options] <path>                       Save or update a state machine definition.
    cat <StatechartNameOrInstanceId>            Get details of a statechart or an instance
    ls [StateChartName]                         Get list of all statechart definitions or instances
    run [options] <StateChartName>              Create an instance with the statechart definition.
    send <InstanceId> <eventName> [eventData]   Send an event to a statechart instance.
    interact <InstanceId>                       Start REPL interface to send events to a statechart instance.
    rm <StatechartNameOrInstanceId>             Remove a statechart or an instance.
    subscribe <StatechartNameOrInstanceId>      Listen to changes on a statechart or an instance.
    viz [options] <StatechartNameOrInstanceId>  Open visualization of the statechart or realtime visualization of the instance.
    log <InstanceId>                            Get all events of the instance.
    help                                        Print out help
    *                                           Print out help

  Options:

    -h, --help  output usage information

```

[![asciicast](https://asciinema.org/a/18572.png)](https://asciinema.org/a/18572)
