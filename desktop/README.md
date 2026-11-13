# CineHub Desktop

Tauri 2 + React app for Windows and Linux. Same Supabase project and provider modules as the mobile app.

## Build the installers

GitHub → **Actions → Build CineHub Desktop → Run workflow**. When it finishes, download `cinehub-windows`
(`.exe`, `.msi`) and `cinehub-linux` (`.deb`, `.AppImage`) from the run's Artifacts.

## Build locally

```
cd desktop
npm install
npm run tauri build      # needs Rust: https://rustup.rs
```

`npm run dev` runs the UI in a browser (provider sites may be blocked by CORS there; the real app is not).
