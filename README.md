# River

River is the Transmission torrent client, packaged with a simple file manager.
It comes with a commandline tool to manage files from your local terminal.

## Installation

[![Install](https://cloudron.io/img/button32.png)](https://cloudron.io/button.html?app=io.cloudron.river)

or using the [Cloudron command line tooling](https://cloudron.io/references/cli.html)

```
cloudron install --appstore-id io.cloudron.river
```

## Building

### Cloudron
The app package can be built using the [Cloudron command line tooling](https://cloudron.io/references/cli.html).

```
git clone https://github.com/arantes555/surfer.git
cd surfer
cloudron build
cloudron install
```

## Usage

The file management interface is available under the `/` location or you can download/upload files using the commandline tool.

## Testing

The e2e tests are located in the `test/` folder and require [nodejs](http://nodejs.org/). They are creating a fresh build, install the app on your Cloudron, perform tests, backup, restore and test if the files are still ok.

```
cd surfer

npm install
USERNAME=<cloudron username> PASSWORD=<cloudron password> mocha --bail test/test.js
```

