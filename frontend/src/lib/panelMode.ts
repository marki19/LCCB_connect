// Remembers, for the lifetime of the page, that a desktop admin deliberately
// chose "Back to App". Without this, RouteGuard would immediately send every
// desktop admin back to the panel as soon as they entered the normal app.
// A reload clears the flag, so desktop admins still start in the panel.
let adminAppPreview = false;

export function isAdminAppPreview() {
  return adminAppPreview;
}

export function setAdminAppPreview(value: boolean) {
  adminAppPreview = value;
}
