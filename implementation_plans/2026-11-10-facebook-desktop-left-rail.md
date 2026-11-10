# Facebook-Style Desktop Left Navigation Rail — Implementation Plan

## Goal
Transform the desktop left sidebar from duplicate generic tabs into a Facebook-style shortcuts rail with personal profile shortcut, friends with request badge, campus resources, communities, and settings.

## Features
1. **User Profile Header Item:**
   - Avatar + user's full name ("Mark Antipo").
   - Click navigates directly to `/(tabs)/profile`.
2. **Main Shortcuts List:**
   - 👥 **Friends:** navigates to `/friends`, displays live incoming requests count badge.
   - 💬 **Messenger / Chats:** navigates to `/messages` or opens floating mini-chat with unread badge.
   - 📚 **Repository:** navigates to `/(tabs)/search` (all student projects & theses).
   - 🎓 **Capstones:** navigates to `/(tabs)/search?filter=capstone` (final year research).
   - 🔔 **Notifications:** navigates to `/(tabs)/notifications`.
   - 🛡️ **Admin / Moderation Console:** (conditional for admin/moderator roles).
3. **Your Shortcuts / Campus Communities:**
   - Department Community shortcut (e.g. "College of Computer Studies").
   - Course / Batch shortcut.
   - 🔖 **Saved Posts:** bookmark list shortcut.
4. **Footer:**
   - Theme toggle (Light / Dark).
   - Settings link (`/settings`).
   - Meta footer (`Privacy · Terms · LCCB Connect © 2026`).

