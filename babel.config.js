module.exports = function (api) {
  const enableLocator = api.caller(
    (caller) => caller?.platform === 'web' && caller?.isDev === true,
  );

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(enableLocator
        ? [['./babel-plugins/locator-web', { env: 'development' }]]
        : []),
      'react-native-reanimated/plugin',
    ],
  };
};
