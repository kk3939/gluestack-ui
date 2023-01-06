const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      process.env.NODE_ENV !== 'production'
        ? [
            'module-resolver',
            {
              alias: {
                // For development, we want to alias the library to the source
                ['@gluestack/ui-styled']: path.join(__dirname, '../styled/src'),

                ['@gluestack/ui-creator']: path.join(
                  __dirname,
                  '../creator/src'
                ),
                ['@gluestack/ui']: path.join(__dirname, '../ui/src'),
                ['@gluestack/color-mode']: path.join(
                  __dirname,
                  '../color-mode/src'
                ),
              },
            },
          ]
        : ['babel-plugin-react-docgen-typescript', { exclude: 'node_modules' }],
    ],
  };
};
