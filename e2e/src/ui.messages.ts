// UI component messages
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
  
  // Error messages with parameters
  networkError: (code: number): string => "Network error occurred ({{code}})",
  validationError: (field: string): string => "Please check the {{field}} field",
  
  // Pluralization scenarios
  itemCount: (count: number): string => "{{count}} items in your cart",
  fileSize: (size: number, unit: string): string => "File size: {{size}} {{unit}}",
  
  // Long messages
  privacyNotice: (): string => 
    "We respect your privacy and will never share your personal information with third parties without your explicit consent.",
    
  termsAgreement: (): string =>
    "By continuing, you agree to our Terms of Service and Privacy Policy. Please read them carefully.",
};
