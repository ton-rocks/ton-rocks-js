const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');


module.exports = {
  entry: {
    app: './src/index.js',
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: './node_modules/ton-client-web-js/tonclient.wasm' },
    ]),
    new webpack.LoaderOptionsPlugin({
      minimize: false,
      debug: true,
    }),
  ],
  output: {
    filename: 'tonrocks.bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  //resolve: {
  //  modules: [path.resolve(__dirname, "src/tvm/browser"), "node_modules"]
  //}
};