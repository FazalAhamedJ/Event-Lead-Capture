# Event Lead Capture v0.1

Offline-first iPad PWA for capturing event leads, referrals, enquiries, priorities, follow-up actions, and visitor pass / business card photos.

## GitHub Pages deployment
1. Upload every file in this folder to the root of your GitHub repository.
2. In GitHub open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select **main** and **/(root)**, then click **Save**.
5. Wait for GitHub to show the published URL.
6. Open that URL in Safari on the iPad.
7. Use **Share → Add to Home Screen**.
8. Open the installed app once while online, then test it in Airplane Mode.

## Data
Lead data and photos are stored only in the browser's IndexedDB on the iPad.
Use **Full Backup** regularly. CSV export does not include image binaries; Full JSON Backup does.

## Important
Do not put actual customer data into the GitHub repository. GitHub stores only the app code.
