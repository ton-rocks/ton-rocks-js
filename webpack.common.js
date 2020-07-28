const path = require('path');

module.exports = {
  entry: {
    app: './src/index.js',
  },
  output: {
    filename: 'tonrocks.bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};