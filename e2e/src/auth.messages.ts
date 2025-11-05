// Authentication related messages - showcasing different function expression syntax styles
export const AuthMessages = {
  // Method shorthand syntax
  /**
   * Authentication page title
   */
  title(): string {
    return "Authentication";
  },

  /**
   * Login instruction subtitle
   */
  subtitle(): string {
    return "Please sign in to continue";
  },

  /**
   * Primary login button text
   */
  loginButton(): string {
    return "Sign In";
  },

  // Function expression syntax
  /**
   * Account creation button text
   */
  signUpButton: function(): string {
    return "Create Account";
  },

  // Mixed styles - keeping some arrow functions
  forgotPassword: (): string => "Forgot Password?",

  // Method shorthand with parameters and JSDoc
  /**
   * Welcome message for returning users
   * @param name The user's display name
   */
  welcome(name: string): string {
    return "Welcome back, {{name}}!";
  },

  /**
   * Error message for invalid email format
   * @param email The invalid email address provided
   */
  invalidEmail(email: string): string {
    return "Invalid email address: {{email}}";
  },

  // Function expression with multiple parameters
  /**
   * Password reset confirmation message
   * @param email The email address where reset link was sent
   * @param minutes Number of minutes until the link expires
   */
  resetEmailSent: function(email: string, minutes: number): string {
    return "Password reset link sent to {{email}}. Expires in {{minutes}} minutes.";
  },

  /**
   * Login attempt counter message
   * @param count Current number of failed attempts
   * @param maxAttempts Maximum allowed attempts before lockout
   */
  attemptsRemaining(count: number, maxAttempts: number): string {
    return "{{count}} of {{maxAttempts}} login attempts remaining";
  },

  // Method shorthand with complex message
  /**
   * Account lockout notification
   * @param unlockTime When the account will be unlocked
   */
  accountLocked(unlockTime: string): string {
    return "Account temporarily locked. Please try again after {{unlockTime}}.";
  },

  /** @noTranslate */
  debugInfo: (): string => "Debug: Auth component mounted",
};
