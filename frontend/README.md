# LCCB Connect

LCCB Connect is an institutional academic e-portfolio, project broadcasting, and digital thesis repository mobile and web application designed specifically for La Consolacion College Bacolod (LCCB). 

Built with **React Native (Expo)**, **Tailwind CSS (NativeWind)**, and **Supabase**.

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing.

### Prerequisites

Before you begin, ensure you have the following installed on your machine:
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)
- **Expo Go** app installed on your physical mobile device (iOS/Android), or an Android Emulator / iOS Simulator setup on your machine.
- A **Supabase** account for backend and database management.

### 1. Clone the Repository

Clone the project to your local machine:
```bash
git clone https://github.com/your-username/lccb_connect.git
cd lccb_connect
```

### 2. Install Dependencies

Install all the required React Native and Expo packages:
```bash
npm install
```
*(Note: If you run into peer dependency issues during installation in the future, use `npm install --legacy-peer-deps`)*

### 3. Set Up Environment Variables

LCCB Connect relies on Supabase for authentication and database management. You need to connect the app to your Supabase project.

1. Create a file named `.env` in the root folder of the project.
2. Add your Supabase credentials to the file:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set Up the Database (Supabase)

To ensure the authentication and user profiles work correctly, you must set up the database schema.

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor**.
3. Locate the `supabase_schema.sql` file provided with this project (or copy its contents).
4. Paste the SQL script into the editor and click **Run**. This will generate the `profiles` table, row-level security (RLS) policies, and the automatic profile generation trigger.

### 5. Run the Development Server

Start the Expo development server and clear the cache to ensure a clean build:
```bash
npx expo start -c
```

Once the Metro Bundler starts:
- **Android:** Press `a` in the terminal to open in an Android Emulator.
- **iOS:** Press `i` to open in an iOS Simulator.
- **Physical Device:** Scan the QR code displayed in the terminal using the Expo Go app on your phone.
- **Web:** Press `w` to open the app directly in your web browser.

---

## 🛠 Tech Stack
- **Framework:** React Native / Expo Router
- **Styling:** Tailwind CSS (via NativeWind v4)
- **Backend & Auth:** Supabase
- **Icons:** Lucide React Native
- **Animations:** React Native Reanimated
