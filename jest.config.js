module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/kryptyk_labs_arg.git/'],
  // Browser specs run through Playwright, not Jest. Jest's default testMatch would
  // otherwise collect *.spec.ts files under tests/e2e.
  testPathIgnorePatterns: ['<rootDir>/kryptyk_labs_arg.git/', '<rootDir>/tests/e2e/'],
  watchPathIgnorePatterns: ['<rootDir>/kryptyk_labs_arg.git/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
