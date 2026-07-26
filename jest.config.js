// Pin the timezone for the whole test run (CGUI-52 regression tests need a
// non-UTC zone; CI runners are UTC, where local-day bucketing bugs are
// invisible). This must happen here, not inside a test file: jest gives each
// test file a *copy* of process.env, so an in-test `process.env.TZ = ...`
// never reaches Node's real TZ setter and V8 keeps the cached zone. Setting
// it while jest.config.js loads means worker processes inherit TZ at spawn.
process.env.TZ = 'America/New_York';

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};
