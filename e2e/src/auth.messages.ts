// Authentication related messages
export const AuthMessages = {
  // Simple messages without parameters
  title: (): string => "Authentication",
  subtitle: (): string => "Please sign in to continue",
  loginButton: (): string => "Sign In",
  signUpButton: (): string => "Create Account",
  forgotPassword: (): string => "Forgot Password?",

  // Messages with single parameter
  welcome: (name: string): string => "Welcome back, {{name}}!",
  invalidEmail: (email: string): string => "Invalid email address: {{email}}",

  // Messages with multiple parameters
  resetEmailSent: (email: string, minutes: number): string =>
    "Password reset link sent to {{email}}. Expires in {{minutes}} minutes.",

  attemptsRemaining: (count: number, maxAttempts: number): string =>
    "{{count}} of {{maxAttempts}} login attempts remaining",

  // Complex message with conditional content
  accountLocked: (unlockTime: string): string => "Account temporarily locked. Please try again after {{unlockTime}}.",

  /** @noTranslate */
  debugInfo: (): string => "Debug: Auth component mounted",
};
