// Main entry point for e2e testing
import { AuthMessages } from './auth.messages';
import { UIMessages } from './ui.messages';

// Export all message modules for testing
export { AuthMessages, UIMessages };

// Example usage functions that will be tested
export function getWelcomeMessage(userName: string): string {
  return AuthMessages.welcome(userName);
}

export function getStatusMessage(count: number): string {
  return UIMessages.itemCount(count);
}

export function getResetEmailMessage(email: string, minutes: number): string {
  return AuthMessages.resetEmailSent(email, minutes);
}

// Test various message types
export function getAllSimpleMessages(): string[] {
  return [
    AuthMessages.title(),
    AuthMessages.loginButton(),
    UIMessages.homeTab(),
    UIMessages.saveButton(),
    UIMessages.loading(),
  ];
}

export function getComplexMessage(): string {
  return AuthMessages.attemptsRemaining(3, 5);
}

// This should remain unchanged due to @noTranslate
export function getDebugMessage(): string {
  return AuthMessages.debugInfo();
}
