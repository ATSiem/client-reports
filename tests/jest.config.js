module.exports = {
  // Transform TypeScript files using ts-jest only
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.json',
      isolatedModules: true,
      diagnostics: { ignoreCodes: [151001] }
    }],
  },
  
  // Specify test environment
  testEnvironment: 'node',
  
  // Specify file extensions to look for
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Module name mapper for path aliases
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/../src/$1',
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/setup.js'],
  
  // Setup files before tests
  setupFiles: ['<rootDir>/test-env.js'],
  
  // Only ignore regular node_modules, allow processing of ts-jest
  transformIgnorePatterns: [
    '/node_modules/(?!ts-jest)',
  ],
  
  // Coverage settings
  collectCoverageFrom: [
    '../src/**/*.{js,jsx,ts,tsx}',
    '!../src/**/*.d.ts',
  ],
  
  // Test match patterns
  testMatch: [
    '<rootDir>/**/*.test.{js,jsx,ts,tsx}',
  ],
  
  // Additional settings from package.json
  verbose: true,
  testTimeout: 30000,
  
  // Root directory
  rootDir: '.',
}; 