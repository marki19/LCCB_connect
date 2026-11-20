import React from "react";
import { Redirect } from "expo-router";

/**
 * Legacy upload-thesis route: permanently redirects to the unified composer
 * with kind=repository and repository_type=thesis preselected.
 */
export default function UploadThesisScreen() {
  return <Redirect href="/create?kind=repository&repository_type=thesis" />;
}
