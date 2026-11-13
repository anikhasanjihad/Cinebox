# Cinebox Desktop

Tauri 2 + React app for Windows and Linux. Same Supabase project and provider modules as the mobile app.

## Build the installers (GitHub Actions)

The workflow file is in `ci/build-desktop.yml`. GitHub only runs workflows from `.github/workflows/`, and a token
without the `workflow` scope cannot push there, so add it once yourself:

1. GitHub → your repo → **Add file → Create new file** → name it `.github/workflows/build-desktop.yml`
2. Paste the contents of `desktop/ci/build-desktop.yml` and commit.
3. **Actions → Build Cinebox Desktop → Run workflow.** When it finishes, download `cinebox-windows` (`.exe`, `.msi`)
   and `cinebox-linux` (`.deb`, `.AppImage`) from the run's Artifacts.

## Build locally

```
cd desktop
npm install
npm run tauri build      # needs Rust: https://rustup.rs
```

`npm run dev` runs the UI in a browser (provider sites may be blocked by CORS there; the real app is not).
