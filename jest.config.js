module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/kryptyk_labs_arg.git/'],
  // mobile-shell.spec.ts is a real Playwright browser spec (run via `npx playwright
  // test`), not a Jest test — Jest's default testMatch would otherwise pick up any
  // *.spec.ts under tests/e2e, but Playwright's `test`/`expect` aren't valid outside
  // Playwright's own runner.
  testPathIgnorePatterns: ['<rootDir>/kryptyk_labs_arg.git/', '<rootDir>/tests/e2e/mobile-shell.spec.ts'],
  watchPathIgnorePatterns: ['<rootDir>/kryptyk_labs_arg.git/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
