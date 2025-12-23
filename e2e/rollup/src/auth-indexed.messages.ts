// Authentication related messages (using indexed arguments for argMode = "indexed")
export const AuthMessages = {
  // Simple messages without parameters
  title: (): string => "Authentication",
  subtitle: (): string => "Please sign in to continue",
  loginButton: (): string => "Sign In",
  signUpButton: (): string => "Create Account",
  forgotPassword: (): string => "Forgot Password?",

  // Messages with single parameter (using {{0}} instead of {{name}})
  welcome: (name: string): string => "Welcome back, {{0}}!",
  invalidEmail: (email: string): string => "Invalid email address: {{0}}",

  // Messages with multiple parameters (using {{0}}, {{1}} instead of {{email}}, {{minutes}})
  resetEmailSent: (email: string, minutes: number): string =>
    "Password reset link sent to {{0}}. Expires in {{1}} minutes.",

  attemptsRemaining: (count: number, maxAttempts: number): string => "{{0}} of {{1}} login attempts remaining",

  // Complex message with conditional content
  accountLocked: (unlockTime: string): string => "Account temporarily locked. Please try again after {{0}}.",

  /** @noTranslate */
  debugInfo: (): string => "Debug: Auth component mounted",
};

