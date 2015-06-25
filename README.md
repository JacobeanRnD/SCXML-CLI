[![Build status](https://travis-ci.org/JacobeanRnD/smaas-cli.svg?branch=master)](https://travis-ci.org/JacobeanRnD/smaas-cli)


This is the command-line client to expresscion, the SCXML orchestration server.


### Installation

```
npm install -g expresscion smaas-cli
```

### Usage

First, start expresscion:

`expresscion [index.scxml]`

Then you can use the CLI:

```
  Usage: smaas-cli [options] [command]


  Commands:

    create <path>                              Create an scxml file on given path
    cat <InstanceId>                           Get details of a statechart or an instance
    ls                                         Get list of all statechart definitions or instances
    run [-n InstanceId]                        Create an instance with the statechart definition.
    send <InstanceId> <eventName> [eventData]  Send an event to a statechart instance.
    interact <InstanceId>                      Start REPL interface to send events to a statechart instance.
    rm <InstanceId>                            Remove a statechart or an instance.
    subscribe <InstanceId>                     Listen to changes on a statechart or an instance.
    viz [-b] <InstanceId>                      Open visualization of the statechart or realtime visualization of the instance.
    log <InstanceId>                           Get all events of the instance.
    help                                       Print out help
    *                                          Print out help

  Options:

    -h, --help  output usage information
```

### Remote client

SMaaS-CLI can interact with SMaaS servers deployed to the cloud, e.g.

`smaas-cli -H http://my-app.herokuapp.com ls`
