-- 039_prune_message_notifications.sql
-- Messages are their own surface.
--
-- `new_message` / `message_request` rows used to be written on every send so the
-- bell could show them. They are now filtered out of both the list and the unread
-- count (models/notificationModel.js), and the OS push that reaches the status
-- bar and lock screen is driven by pushService.notifyNewMessage — it never reads
-- these rows. Deleting them therefore loses nothing, and stops them inflating
-- the badge for anyone with an old unread row.
DELETE FROM public.notifications
 WHERE type IN ('new_message', 'message_request');
