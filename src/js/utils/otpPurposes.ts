const otpPurposes: string[] = [
  // Very common
  "login",
  "signup",
  "password_reset",
  "email_verification",
  "phone_verification",
  "two_factor_auth",

  // Common
  "change_password",
  "change_email",
  "change_phone",
  "new_device_login",
  "verify_device",
  "verify_session",
  "confirm_action",
  "sensitive_action",
  "identity_verification",
  "account_recovery",
  "account_unlock",

  // Moderately common
  "update_profile",
  "authorize_device",
  "verify_contact",
  "magic_link_login",
  "enable_two_factor_auth",
  "disable_two_factor_auth",

  // Financial
  "payment_verification",
  "transaction_verification",
  "bank_account_verification",
  "withdrawal_verification",

  // Organizations & Invites
  "organization_invite",
  "invite_acceptance",
  "transfer_ownership",

  // OAuth & API
  "oauth_link",
  "oauth_unlink",
  "api_key_verification",

  // Rare
  "delete_account",
];

export default otpPurposes;
