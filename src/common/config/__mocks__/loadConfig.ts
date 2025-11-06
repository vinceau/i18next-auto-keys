// Mock implementation of loadConfig for Jest tests
// This provides a simple mock that avoids cosmiconfig issues in test environments

export type I18nConfig = {
  potTemplatePath: string;
  hashLength: number;
  argMode: "indexed" | "named";
  topLevelKey?: string;
  projectId?: string;
  jsonIndentSpaces: number;
};

export type Configuration = { 
  config: I18nConfig; 
  file?: string;
};

export const loadConfig = jest.fn((): Configuration => ({
  config: {
    potTemplatePath: "i18n/messages.pot",
    hashLength: 10,
    argMode: "named",
    projectId: "app 1.0",
    jsonIndentSpaces: 2,
  },
  // No file specified in mock
  file: undefined,
}));
