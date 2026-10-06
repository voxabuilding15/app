/** Component tests run in jest-expo; pure domain/data tests use `npm test` (Node runner). */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/tests/ui'],
  testMatch: ['**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/tests/ui/setup.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Audio files are bundled by Metro; tests only need something to hand to the (mocked) player.
    '\\.ogg$': '<rootDir>/tests/ui/audio-stub.ts',
  },
};
