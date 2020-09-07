const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');

/*
const serverConfig = {
  target: 'node',
  mode: 'development',
  entry: {
    app: './src/index.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    //libraryExport: 'default',
    libraryTarget: 'commonjs2',
    filename: 'lib.node.js'
  },
  resolve: {
    modules: [path.resolve(__dirname, "src/tvm/nodejs"), "node_modules"]
  }
};

module.exports = [serverConfig, merge(common, {
  mode: 'production'
})];
*/

module.exports = merge(common, {
  mode: 'production'
});