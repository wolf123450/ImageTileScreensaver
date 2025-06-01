const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { DefinePlugin } = require('webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      renderer: './src/renderer.ts',
      config: './src/configui/config.ts',
      main: './src/main.ts',
      preload: './src/preload.ts'
    },
    devtool: isProduction ? false : 'source-map',
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
      new DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
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
      splitChunks: isProduction ? {
        chunks: 'all',
        name: 'vendors',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      } : false
    },
    performance: {
      hints: isProduction ? 'warning' : false
    }
  };
};
