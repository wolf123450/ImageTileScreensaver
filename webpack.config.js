const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    renderer: './src/renderer.ts',
    config: './src/configui/config.ts'
  },
  devtool: 'source-map',
  target: 'electron-renderer',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      }
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/configui/*.html', to: 'configui/[name][ext]' },
        { from: 'src/configui/*.css', to: 'configui/[name][ext]' }
      ],
    }),
  ],
  resolve: {
    extensions: ['.ts', '.js', '.css'],
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
