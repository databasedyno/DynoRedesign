import type { Config } from 'jest';

// Shared DB/model mock mappings (used by all projects)
const dbModelMapper: Record<string, string> = {
  '^../utils/dbInstance$': '<rootDir>/__tests__/__mocks__/dbInstance.ts',
  '^../../utils/dbInstance$': '<rootDir>/__tests__/__mocks__/dbInstance.ts',
  '^../models$': '<rootDir>/__tests__/__mocks__/models.ts',
  '^../../models$': '<rootDir>/__tests__/__mocks__/models.ts',
  '^../models/index$': '<rootDir>/__tests__/__mocks__/models.ts',
  '^../../models/index$': '<rootDir>/__tests__/__mocks__/models.ts',
};

/**
 * Speed/reliability notes (2026-08, after "suite can't finish in agent tool window"):
 * - transform uses tsconfig.jest.json (isolatedModules: true) → ts-jest transpiles
 *   per-file instead of building the whole TS program each run. Types are enforced
 *   separately by `tsc --noEmit` (husky preflight), not by the test run.
 * - cacheDirectory lives INSIDE /app (persistent workspace). The jest/ts-jest default
 *   is under /tmp, which THIS POD WIPES on restart — that forced a full recompile
 *   every session. .jest-cache/ is gitignored.
 * - `verbose` was removed from project configs (it is a GLOBAL option; inside a
 *   project it triggered "Unknown option verbose" warnings on every run).
 * - Agents: NEVER background jest (`yarn test &` hangs the tool wrapper — children
 *   inherit the output pipe and it never reaches EOF). Run FOREGROUND via
 *   scripts/run-tests.sh (batched, each batch well under the tool timeout).
 */
const transform: Record<string, [string, Record<string, unknown>]> = {
  '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
};

const config: Config = {
  projects: [
    // Default project: mocks Redis, DB, models
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      cacheDirectory: '<rootDir>/.jest-cache',
      roots: ['<rootDir>/__tests__'],
      testMatch: ['**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/', 'redisInstance\\.test\\.ts$', '/__tests__/api/'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      transform,
      moduleNameMapper: {
        ...dbModelMapper,
        '^../utils/redisInstance$': '<rootDir>/__tests__/__mocks__/redisInstance.ts',
        '^../../utils/redisInstance$': '<rootDir>/__tests__/__mocks__/redisInstance.ts',
      },
      setupFiles: [],
      testTimeout: 10000,
    },
    // Redis project: tests the REAL redisInstance module with mocked redis client
    {
      displayName: 'redis',
      preset: 'ts-jest',
      testEnvironment: 'node',
      cacheDirectory: '<rootDir>/.jest-cache',
      roots: ['<rootDir>/__tests__'],
      testMatch: ['**/redisInstance.test.ts'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      transform,
      moduleNameMapper: {
        ...dbModelMapper,
        // NOTE: redisInstance is NOT mocked here — tests the real module
      },
      setupFiles: [],
      testTimeout: 10000,
    },
    // Integration project: hits the live running server via supertest (no mocks).
    // ⚠️ In the preview this server is wired to the LIVE prod DB — only run this
    // project explicitly (scripts/run-tests.sh --integration), never by default.
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      cacheDirectory: '<rootDir>/.jest-cache',
      roots: ['<rootDir>/__tests__/api'],
      testMatch: ['**/*.test.ts'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      transform,
      // No moduleNameMapper — integration tests hit the real server
      setupFiles: [],
      testTimeout: 30000,
    },
  ],
};

export default config;
