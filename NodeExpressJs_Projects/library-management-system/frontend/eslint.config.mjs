import next from 'eslint-config-next';

export default [
  ...next,
  {
    rules: {
      '@next/next/no-img-element': 'off', // covers/avatars come from the API or arbitrary URLs
      // Data-fetching hooks start a request from an effect and set state when it resolves; the rule is too strict for that.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];
