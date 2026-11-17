import { Redirect } from "expo-router";

/**
 * Legacy entry point. The verification queue now lives inside the admin
 * console at `/(admin)/verification` so it keeps the console shell and
 * navigation. Old links and bookmarks are forwarded there instead of
 * rendering a second, shell-less copy of the screen.
 */
export default function VerifyRequestsRedirect() {
  return <Redirect href="/(admin)/verification" />;
}
