module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/webpack/tests"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/shared/$1"
  },
  collectCoverageFrom: [
    "webpack/src/**/*.ts",
    "!**/*.test.ts",
    "!**/node_modules/**"
  ]
};

