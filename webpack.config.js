const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      'tauri-bridge': './src/tauri-bridge.ts',
      renderer: './src/renderer.ts',
      settings: './src/configui/screensaver-settings.ts',
    },
    devtool: isProduction ? false : 'source-map',
    target: 'web',
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
          { from: 'src/configui/*.css', to: 'configui/[name][ext]' },
          { from: 'src/index.html', to: 'index.html' }
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
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            format: {
              comments: false,
            },
            compress: {
              drop_console: isProduction,
              drop_debugger: isProduction
            }
          },
          extractComments: false,
        }),
      ],
      splitChunks: false
    },
    performance: {
      hints: isProduction ? 'warning' : false
    }
  };
};
