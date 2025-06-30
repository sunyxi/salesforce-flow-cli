module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'off', // Allow console.log in CLI tool
    'space-before-function-paren': ['error', 'never'],
    'indent': ['error', 4],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'quotes': ['error', 'single'],
    'no-multiple-empty-lines': ['error', { max: 2 }],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'no-trailing-spaces': 'error',
    'eol-last': 'error'
  }
};