// Messages with translation context for e2e testing
export const ContextMessages = {
  // Same text with different contexts
  /**
   * Close button in modals
   * @translationContext dialog
   */
  closeModal: (): string => "Close",

  /**
   * Close action in file menu
   * @translationContext file-menu
   */
  closeFile: (): string => "Close",

  /**
   * Close button on notifications
   * @translationContext notification
   */
  closeNotification: (): string => "Close",

  // Save with different contexts
  /**
   * Save document action
   * @translationContext document-editor
   */
  saveDocument: (): string => "Save",

  /**
   * Save user profile
   * @translationContext user-profile
   */
  saveProfile: (): string => "Save",

  /**
   * Save game progress
   * @translationContext gaming
   */
  saveGame: (): string => "Save",

  // Contextual settings messages
  /**
   * Account settings title
   * @translationContext account.settings
   */
  accountSettings: (): string => "Settings",

  /**
   * Application preferences
   * @translationContext app.preferences
   */
  appSettings: (): string => "Settings",

  /**
   * Privacy configuration page
   * @translationContext privacy.config
   */
  privacySettings: (): string => "Settings",

  // Parameterized messages with context
  /**
   * Welcome message for authenticated users
   * @translationContext authentication.success
   * @param name User's display name
   */
  welcomeUser: (name: string): string => "Welcome back, {{name}}!",

  /**
   * Welcome message for guests
   * @translationContext guest.landing
   * @param name Guest identifier
   */
  welcomeGuest: (name: string): string => "Welcome back, {{name}}!",

  // Complex contexts
  /**
   * Notification for admin panel
   * @translationContext admin-panel/notifications
   * @param count Number of pending items
   */
  adminNotification: (count: number): string => "{{count}} pending items require attention",

  /**
   * User dashboard notification
   * @translationContext user-dashboard.notifications.activity
   * @param count Number of activities
   */
  userNotification: (count: number): string => "{{count}} pending items require attention",

  // Without context for comparison
  /**
   * Generic error message
   */
  genericError: (): string => "An error occurred",

  /**
   * Simple confirmation
   */
  confirmAction: (): string => "Are you sure?",

  // Multi-line context
  /**
   * Help text for complex feature
   * @translationContext feature.advanced.help-system
   */
  complexFeatureHelp: (): string => "This advanced feature requires additional configuration",
};
