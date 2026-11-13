# Cinebox Desktop

Tauri 2 + React app for Windows and Linux. Same Supabase project and provider modules as the mobile app.

## Build the installers

GitHub → **Actions → Build Cinebox Desktop → Run workflow**. When it finishes, download `cinebox-windows`
(`.exe`, `.msi`) and `cinebox-linux` (`.deb`, `.AppImage`) from the run's Artifacts.

## Build locally

```
cd desktop
npm install
npm run tauri build      # needs Rust: https://rustup.rs
```

`npm run dev` runs the UI in a browser (provider sites may be blocked by CORS there; the real app is not).
