module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/kryptyk_labs_arg.git/'],
  testPathIgnorePatterns: ['<rootDir>/kryptyk_labs_arg.git/'],
  watchPathIgnorePatterns: ['<rootDir>/kryptyk_labs_arg.git/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
