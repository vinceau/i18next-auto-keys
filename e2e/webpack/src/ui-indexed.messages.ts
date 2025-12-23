// UI component messages (using indexed arguments for argMode = "indexed")
export const UIMessages = {
  // Navigation
  homeTab: (): string => "Home",
  settingsTab: (): string => "Settings",
  profileTab: (): string => "Profile",

  // Actions
  saveButton: (): string => "Save Changes",
  cancelButton: (): string => "Cancel",
  deleteButton: (): string => "Delete",
  confirmButton: (): string => "Confirm",

  // Status messages
  loading: (): string => "Loading...",
  saving: (): string => "Saving changes...",
  success: (): string => "Operation completed successfully",

  // Error messages with parameters (using {{0}} instead of {{code}}, {{field}})
  networkError: (code: number): string => "Network error occurred ({{0}})",
  validationError: (field: string): string => "Please check the {{0}} field",

  // Pluralization scenarios (using {{0}}, {{1}} instead of {{count}}, {{size}}, {{unit}})
  itemCount: (count: number): string => "{{0}} items in your cart",
  fileSize: (size: number, unit: string): string => "File size: {{0}} {{1}}",

  // Long messages
  privacyNotice: (): string =>
    "We respect your privacy and will never share your personal information with third parties without your explicit consent.",

  termsAgreement: (): string =>
    "By continuing, you agree to our Terms of Service and Privacy Policy. Please read them carefully.",
};
