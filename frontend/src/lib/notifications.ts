import type { NotificationItem } from "../types";

/**
 * Presentation + navigation rules shared by the bell popover and the full
 * Notifications screen, so the two surfaces never disagree about what a
 * notification means or where it points.
 */

/** Short heading shown above a notification's message. */
export function notificationLabel(type: string): string {
  switch (type) {
    case "new_post":
      return "New post";
    case "announcement":
      return "Announcement";
    case "mention":
      return "Mention";
    case "repost":
      return "Repost";
    case "friend_request":
      return "Friend request";
    case "friend_accepted":
      return "Friend accepted";
    case "verification_submitted":
      return "Verification submitted";
    case "verification_approved":
      return "Verification approved";
    case "flagged_post":
      return "Flagged post";
    case "flagged_comment":
      return "Flagged comment";
    case "post_action":
      return "Moderation update";
    default:
      return "Notification";
  }
}

/**
 * Destination for a tapped notification, or `null` when there is nothing to
 * open (e.g. an account-verification notice).
 */
export function notificationHref(
  notification: Pick<NotificationItem, "type" | "target_id">
): string | null {
  switch (notification.type) {
    case "friend_request":
    case "friend_accepted":
      return "/friends";
    case "flagged_post":
    case "flagged_comment":
    case "post_action":
      return "/(admin)/content";
    default:
      return notification.target_id ? `/post/${notification.target_id}` : null;
  }
}

/** Display name for the actor, falling back to the system sender. */
export function notificationActorName(
  notification: Pick<NotificationItem, "actor">
): string {
  return notification.actor?.full_name ?? notification.actor?.username ?? "LCCB Connect";
}
