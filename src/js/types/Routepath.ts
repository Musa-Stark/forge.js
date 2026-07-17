export type RoutePath =
  // Root
  | "/"

  // Resource
  | "/:id"

  // CRUD
  | "/create"
  | "/create/bulk"
  | "/new"
  | "/edit/:id"
  | "/update/:id"
  | "/delete/:id"
  | "/restore/:id"
  | "/archive/:id"

  // Auth
  | "/signup"
  | "/login"
  | "/logout"
  | "/refresh-token"
  | "/forgot-password"
  | "/reset-password"
  | "/change-password"
  | "/verify-email"
  | "/verify-otp"
  | "/resend-otp"

  // Current User
  | "/me"
  | "/profile"

  // Search & Filters
  | "/search"
  | "/filter"
  | "/sort"

  // Pagination
  | "/page/:page"
  | "/limit/:limit"

  // Status
  | "/active"
  | "/inactive"
  | "/published"
  | "/draft"
  | "/featured"

  // Relationships
  | "/:id/posts"
  | "/:id/comments"
  | "/:id/likes"
  | "/:id/followers"
  | "/:id/following"

  // Uploads
  | "/upload"
  | "/upload/:id"
  | "/download/:id"

  // Files
  | "/:id/updateFile"
  | "/:id/deleteFile"

  // Admin
  | "/dashboard"
  | "/stats"
  | "/analytics"
  | "/reports"

  // Settings
  | "/settings"
  | "/preferences"

  // Notifications
  | "/notifications"
  | "/notifications/read"

  // Misc
  | "/health"
  | "/ping"
  | "/version";
