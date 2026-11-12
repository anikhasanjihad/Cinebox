module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community|-tvos)?|react-native-.*|@react-navigation|expo|expo-.*|@expo|@dr\\.pogodin|@notifee|@shopify)/)',
  ],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/__mocks__/empty.js',
    '^@expo/ui/jetpack-compose$':
      '<rootDir>/__mocks__/expo-ui-jetpack-compose.js',
    '^@expo/ui/jetpack-compose/modifiers$':
      '<rootDir>/__mocks__/expo-ui-jetpack-compose-modifiers.js',
  },
};
