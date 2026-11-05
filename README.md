# Holder — Personal Information Vault

Holder is a web app for saving and organizing links, notes, screenshots, images, and PDFs. It uses Next.js 16, an Express API, MongoDB, and an optional Chrome extension.

Holder’s assistant combines MongoDB text search and relevance ranking with Cloudflare Workers AI. It retrieves a small set of matching vault records, asks the model to answer from those sources, and labels the sources in the response.

## Features

- Organize items in folders; filter by type, tags, favorites, or text.
- Save YouTube links and web bookmarks with metadata extracted from public pages.
- Upload images and PDFs, or save external links to them.
- Search saved text and OCR text extracted from screenshots.
- Use the Chrome extension to save pages and selections.

## File privacy and security

- Uploaded files are served through authenticated API routes that verify the signed-in user owns the item. New Cloudinary uploads use authenticated delivery; Cloudinary URLs and storage identifiers are not returned as public item fields.
- If Cloudinary is not configured, uploads fall back to files on the server’s local disk. That storage is not suitable for ephemeral or multi-instance hosting unless a persistent private volume is configured.
- **Older Cloudinary uploads may still be publicly accessible until migrated.** The migration procedure below changes their delivery type and requests CDN invalidation. Invalidation is not instantaneous, and copies already downloaded by others cannot be recalled.
- Pasted external image/PDF links remain hosted by their original provider; Holder cannot make those source files private.
- “Sensitive” / `isPrivate` is an organizational label, not encryption or an access-control boundary. The AI assistant excludes private items and private-folder items from Cloudflare context. Password, credential, and link lookups use local search; recognized credential patterns in other excerpts are redacted before AI requests. This is a best-effort filter, not a guarantee—do not store information in non-private items if you do not want matching excerpts sent to Cloudflare Workers AI.
- Holder does not provide end-to-end encryption. The API and database must process readable item content. Protect production secrets and database access accordingly.
- Browser access tokens are stored in `localStorage` for compatibility with the web app and extension. This means a successful same-origin script injection could steal a token; the access-token lifetime is 12 hours, but this is not a substitute for an HttpOnly-cookie design.

## Stack

```
Holder/
├── client/       # Next.js app
├── server/       # Express API, MongoDB models, media proxy, OCR/search
└── extension/    # Chrome Manifest V3 quick saver
```

## Local setup

1. Configure the API:

   ```powershell
   cd server
   Copy-Item .env.example .env
   ```

   Set `MONGO_URI` to a MongoDB database and `JWT_SECRET` to at least 32 random bytes. One way to generate a suitable secret is:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Configure `CLOUDINARY_URL` for private cloud media storage. To enable generated assistant answers, set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; the default model can be changed with `CLOUDFLARE_AI_MODEL`. The token needs Account > Workers AI > Read permission. Google sign-in is optional; if enabled, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the matching callback URL. Do not commit `.env`.

2. Install and run the API:

   ```powershell
   npm install
   npm start
   ```

   The API listens on port 5000 by default. The in-memory MongoDB fallback is for local development only; its data is temporary.

3. In another terminal, configure and run the web app:

   ```powershell
   cd client
   Copy-Item .env.example .env.local
   npm install
   npm run dev
   ```

   The web app listens on port 3000 by default. Set `NEXT_PUBLIC_API_URL` if the API is hosted elsewhere.

4. To load the optional extension, open `chrome://extensions`, enable Developer mode, and select **Load unpacked** for the `extension/` directory. Configure the deployed API origin in the extension when hosting outside the listed defaults.

## Migrating older Cloudinary uploads

Back up MongoDB first and ensure the server’s Cloudinary credentials have permission to administer the affected assets. From `server/`, run the migration without flags to inspect the number of eligible records; this is read-only:

```powershell
node scripts/migrate-cloudinary-private.js
```

Only after reviewing that dry-run and confirming the target database and Cloudinary account, apply it explicitly:

```powershell
node scripts/migrate-cloudinary-private.js --apply --confirm-private-migration
```

The script changes legacy `upload`/`private` assets to Cloudinary’s `authenticated` delivery type, requests invalidation, and updates the matching item metadata. It is designed to be rerunnable if the Cloudinary change succeeds but a database update fails. **Do not run it against production without a backup and a reviewed dry-run.**

Run the server tests with `npm test` from `server/`; run the client checks with `npm run lint` and `npm run build` from `client/`.
