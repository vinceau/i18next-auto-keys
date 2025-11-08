// Mock implementation of loadConfig for Jest tests
// This provides a simple mock that avoids cosmiconfig issues in test environments

import type { I18nConfig } from "../loadConfig";

export type Configuration = {
  config: I18nConfig;
  file?: string;
};

export const loadConfig = jest.fn(
  (): Configuration => ({
    config: {
      poTemplateName: "messages.pot",
      poOutputDirectory: "i18n",
      hashLength: 10,
      argMode: "named",
      projectId: "app 1.0",
      jsonIndentSpaces: 2,
    },
    // No file specified in mock
    file: undefined,
  })
);
