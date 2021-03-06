module.exports = {
  extends: [
    "eslint:recommended",
    "eslint-config-google",
  ],
  parserOptions: {
    ecmaVersion: 8,
    sourceType: "module",
    ecmaFeatures: {
      experimentalObjectRestSpread: true
    }
  },
  env: {
    es6: true,
    node: true
  },
  rules: {
    'comma-dangle': 'off',
    'arrow-parens': ['error', 'as-needed'],
    'indent': 'off',
    'no-console': 'off',
    'object-curly-spacing': ['error', 'always'],
    'space-infix-ops': ['error', { int32Hint: true }]
  }
};
