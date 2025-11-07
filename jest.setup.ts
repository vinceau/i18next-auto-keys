// Jest setup file for automatic mocking
// This file is executed before each test file

// Automatically mock loadConfig to avoid cosmiconfig issues in test environment
jest.mock('./src/common/config/loadConfig');

// Automatically mock loadGettextParser to provide consistent gettext-parser behavior
// Individual tests can override this mock if they need specific behavior
jest.mock('./src/cli/loadGettextParser');
