const fs = require('fs');


fs.readFile("index.js", function(err, buf) {
  let c = buf.toString();

  c = c.replace("const {TONClient} = require('ton-client-js');", "const {TvmClient} = require('../tvm.js');");
  c = c.replace("TONClient.setLibrary({", "TvmClient.setLibrary({");
  c = c.replace(" TONClient", " TvmClient");
  c = c.replace("const fetch = require('node-fetch');", "");
  c = c.replace("const WebSocket = require('websocket');", "");
  c = c.replace("fetch,", "");
  c = c.replace("WebSocket: WebSocket.w3cwebsocket,", "");
  

  fs.writeFile("TvmClient.js", c, () => console.log('patch done'));
});


