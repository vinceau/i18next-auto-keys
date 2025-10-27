import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.{ts,js}', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  verbose: true,
  clearMocks: true
};

export default config;
