const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { DefinePlugin } = require('webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isTauri = !!(env && env.tauri);

  // Tauri builds only need renderer-side entries (no main/preload)
  const entry = isTauri
    ? {
        'tauri-bridge': './src/tauri-bridge.ts',
        renderer: './src/renderer.ts',
        settings: './src/configui/screensaver-settings.ts',
      }
    : {
        renderer: './src/renderer.ts',
        settings: './src/configui/screensaver-settings.ts',
        main: './src/main.ts',
        preload: './src/preload.ts',
      };

  return {
    mode: isProduction ? 'production' : 'development',
    entry,
    devtool: isProduction ? false : 'source-map',
    target: isTauri ? 'web' : 'electron-renderer',
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
      new DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        '__TAURI__': JSON.stringify(isTauri)
      })
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
