module.exports = {
  root: true,
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'functions/node_modules/',
    '.codex/',
    '.playwright-cli/',
  ],
  env: {
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      files: ['src/**/*.{js,jsx}'],
      env: {
        browser: true,
      },
      globals: {
        Buffer: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      plugins: ['react', 'react-hooks', 'react-refresh'],
      extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
      ],
      rules: {
        'no-unused-vars': ['error', { ignoreRestSiblings: true }],
        'react/no-unescaped-entities': 'off',
        'react/prop-types': 'off',
        'react-hooks/exhaustive-deps': 'off',
        'react-refresh/only-export-components': 'off',
      },
    },
    {
      files: ['extensions/**/*.js'],
      env: {
        browser: true,
      },
      parserOptions: {
        sourceType: 'module',
      },
      extends: ['eslint:recommended'],
      rules: {
        'no-unused-vars': ['error', { ignoreRestSiblings: true }],
      },
      globals: {
        chrome: 'readonly',
        Buffer: 'readonly',
      },
    },
    {
      files: ['functions/**/*.js', '*.config.js', '*.config.cjs', 'tailwind.config.js', 'vite.config.js'],
      env: {
        node: true,
      },
      extends: ['eslint:recommended'],
      rules: {
        'no-unused-vars': ['error', { ignoreRestSiblings: true }],
      },
    },
  ],
};
