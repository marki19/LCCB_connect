# Facebook-Style Create Post Modal — Implementation Plan

## Goal
Transform the multi-step full-screen post creation flow into a centered floating Facebook-style composer modal matching the reference design.

## Features
1. **Centered Floating Modal on Desktop (`maxWidth: 520px`):**
   - Semi-transparent backdrop (`rgba(0, 0, 0, 0.65)`).
   - Dismissible via backdrop tap and Escape key.
   - Header with centered "Create post" title and circular close button on top right.
2. **User Identity & Privacy Pill:**
   - User avatar and full name.
   - Clickable privacy pill dropdown (`🌐 Public ▾`, `👥 Friends ▾`, `🔒 Custom ▾`) with expandable `VisibilityPicker`.
3. **Unified Single-Screen Composer:**
   - Direct text input (`"What's on your mind, [Name]?"`).
   - Replaced multi-step wizard (`Step 1 of 3: Select Format`) with Facebook-style "Add to your post" toolbar.
4. **Rich Attachment Expandables:**
   - 📷 Photo picker with preview and remove button.
   - 📁 Project Showcase fields (Title, Tech stack, GitHub URL).
   - 🎓 Capstone Publication fields (Title, Tech stack).
   - 🌐 Live Web App fields (URL input with auto link preview).
   - 🔄 Repost permissions toggle switch.
5. **Smart Post Action Button:**
   - Post button enabled when content, image, or project details exist.

