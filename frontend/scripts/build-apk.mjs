import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(frontendDir, '..');
const androidDir = path.join(frontendDir, 'android');
const action = process.argv[2] || 'build';

const isWin = process.platform === 'win32';
const viteCli = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const capCli = path.join(rootDir, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');

function runNodeCli(scriptPath, args, cwd) {
  execFileSync(process.execPath, [scriptPath, ...args], {
    cwd,
    stdio: 'inherit',
  });
}

// 1. Build latest web + Godot 4.7 bundle into frontend/dist
console.log('\n[1/3] Building frontend + Godot 4.7 WebAssembly bundle...');
runNodeCli(viteCli, ['build'], rootDir);

// 2. Initialize & sync Capacitor Android inside frontend/android
console.log('\n[2/3] Syncing web bundle into Capacitor Android project (frontend/android)...');
const tempFrontendPkg = path.join(frontendDir, 'package.json');
const hadFrontendPkg = fs.existsSync(tempFrontendPkg);
if (!hadFrontendPkg) {
  fs.writeFileSync(
    tempFrontendPkg,
    JSON.stringify({ name: 'maze-runner-frontend', private: true, type: 'module' }, null, 2)
  );
}

try {
  if (!fs.existsSync(androidDir)) {
    runNodeCli(capCli, ['add', 'android'], frontendDir);
  }
  runNodeCli(capCli, ['sync', 'android'], frontendDir);

  if (action === 'sync') {
    console.log('\nDone! Capacitor Android project synced at frontend/android.');
    process.exit(0);
  }

  if (action === 'open') {
    runNodeCli(capCli, ['open', 'android'], frontendDir);
    process.exit(0);
  }
} finally {
  if (!hadFrontendPkg && fs.existsSync(tempFrontendPkg)) {
    fs.unlinkSync(tempFrontendPkg);
  }
}

// 3. Compile shareable debug APK via Gradle if JDK + Android SDK are installed
console.log('\n[3/3] Compiling shareable Android APK via Gradle...');
const gradlew = path.join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');
if (!isWin && fs.existsSync(gradlew)) {
  fs.chmodSync(gradlew, 0o755);
}

const gradleRes = spawnSync(gradlew, ['assembleDebug'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWin,
});

if (gradleRes.status !== 0) {
  console.error(
    '\n[Note] Gradle could not finish compiling the APK directly (ensure Java JDK 17/21 and Android SDK / ANDROID_HOME are installed on your laptop, or run `pnpm run apk:open` to build inside Android Studio: Build -> Build APK(s)).'
  );
  process.exit(gradleRes.status || 1);
}

const builtApk = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  'debug',
  'app-debug.apk'
);
const outApk = path.join(frontendDir, 'maze-runner-debug.apk');

if (fs.existsSync(builtApk)) {
  fs.copyFileSync(builtApk, outApk);
  console.log(`\nSuccess! Shareable APK ready at: frontend/maze-runner-debug.apk`);
}
