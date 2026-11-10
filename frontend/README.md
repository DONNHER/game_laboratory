# Maze Runner 3D — Frontend, Godot 4.7 & Android APK (`frontend/`)

Contains the React 19 HUD, the editable **Godot Engine 4.7 (MIT License)** 3D project, compiled WebAssembly chunks, Capacitor Android APK builder, and documentation.

---

## 📱 Building & Sharing the Android `.apk` (`pnpm`)

**Solo Campaign** and **AI Rival** run **100% offline** inside the APK. **Online Match** connects over the internet to your hosted `backend/` server.

### Prerequisites on Your Laptop
- **Node.js 22+** & **`pnpm`**
- **Java JDK 17 or 21** + **Android Studio (Android SDK)** *(required by Android's Gradle compiler to sign & package `.apk` binaries)*

### Step-by-Step APK Build
1. Create a `.env` file in the project root pointing to your hosted backend URL:
   ```env
   VITE_WS_URL="https://your-hosted-backend.onrender.com"
   ```
   *(Automatically normalized to `wss://your-hosted-backend.onrender.com/ws`.)*

2. Build the `.apk` with one `pnpm` command:
   ```bash
   pnpm run apk:build
   ```
   - Compiles the React UI + Godot 4.7 3D WebAssembly chunks into `frontend/dist/`.
   - Generates & syncs the native Capacitor Android project in `frontend/android/`.
   - Runs Gradle (`assembleDebug`) and outputs the shareable file at:
     **`frontend/maze-runner-debug.apk`**

3. **Alternative (Build via Android Studio GUI)**:
   ```bash
   pnpm run apk:sync
   pnpm run apk:open
   ```
   Then in Android Studio click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
