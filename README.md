# Muzikant

Frontend app that generates printable QR card PDFs from Spotify playlists using the muzikant backend.

## Development

```bash
npm install
npm run dev
```

## Deployment

Deployment is fully automated via GitHub Actions. Manual deploy scripts are intentionally removed.

Set the environment variable `VITE_API_BASE` in the `deploy` environment in GitHub to control the backend base URL.
