const fs = require('fs');


fs.readFile("index.js", function(err, buf) {
  let c = buf.toString();

  c = c.replace("import { TONClient } from 'ton-client-js';", "import { TvmClient } from '../tvm.js'");
  c = c.replace("initTONClient(TONClient);", "initTONClient(TvmClient);");
  c = c.replace(" TONClient", " TvmClient");

  fs.writeFile("TvmClient.js", c, () => console.log('patch done'));
});


