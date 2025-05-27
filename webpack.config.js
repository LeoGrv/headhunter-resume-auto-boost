const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: {
      serviceWorker: './src/background/serviceWorker.ts',
      contentScript: './src/content/resumeBooster.ts',
      popup: './src/popup/popup.ts'
    },
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: (pathData) => {
        switch (pathData.chunk.name) {
          case 'serviceWorker':
            return 'background/serviceWorker.js';
          case 'contentScript':
            return 'content/resumeBooster.js';
          case 'popup':
            return 'popup/popup.js';
          default:
            return '[name].js';
        }
      },
      clean: true
    },
    
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@background': path.resolve(__dirname, 'src/background'),
        '@content': path.resolve(__dirname, 'src/content'),
        '@popup': path.resolve(__dirname, 'src/popup')
      }
    },
    
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'public',
            to: '.'
          },
          {
            from: 'src/popup/popup.html',
            to: 'popup/popup.html'
          },
          {
            from: 'src/popup/popup.css',
            to: 'popup/popup.css'
          }
        ]
      })
    ],
    
    devtool: isProduction ? false : 'source-map',
    
    optimization: {
      minimize: isProduction
    },
    
    // Chrome extension specific settings
    target: 'web',
    
    // Disable code splitting for Chrome extensions
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false
        }
      }
    }
  };
}; 