import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  testMatch: ['<rootDir>/src/**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/tests/**',
    '!src/declarations.d.ts'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  clearMocks: true,
  // Support absolute imports and path mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  // Setup automatic mocking
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']
};

export default config;
