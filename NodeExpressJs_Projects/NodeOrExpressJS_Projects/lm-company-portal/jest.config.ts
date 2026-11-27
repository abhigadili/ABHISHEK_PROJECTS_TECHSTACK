import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server/index.ts'],
  coverageDirectory: 'coverage',
  setupFilesAfterFramework: [],
  moduleNameMapper: { '@/(.*)': '<rootDir>/src/$1' },
};

export default config;
