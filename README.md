# Holder — Personal Assistant & Info Vault

**Holder** is an intelligent personal information assistant and knowledge vault built with **Next.js 14**, **Express.js**, **MongoDB**, and a **Chrome Browser Extension**.

Store, categorize, search, and converse with all your important information—including YouTube videos, images, web links, code snippets, and private credentials.

![Holder Dashboard](https://img.shields.io/badge/Stack-Next.js%20%7C%20Express%20%7C%20MongoDB%20%7C%20Extension-6366f1)

---

## ✨ Features

- 📁 **Multi-Folder Collections**: Organize items into custom folders (e.g. 💼 *Brand Assets*, 🔒 *Private Vault*, 🎥 *YouTube Tutorials*, 🌐 *Bookmarks*) with emoji icons, color badges, and description notes.
- 🎥 **YouTube Auto Metadata & Lightbox Player**: Paste any YouTube link to automatically extract channel metadata, title, and high-res thumbnails, with responsive video playback inside the app.
- 🖼️ **Image Vault & Uploads**: Upload local images or paste image URLs, complete with lightboxes.
- 🌐 **Web Bookmarks**: Scrapes OpenGraph site info, page titles, and meta descriptions.
- 📝 **Code Snippets & Notes**: Monospace formatted text/code blocks with 1-click clipboard copy.
- 🤖 **AI Personal Assistant**: Slide-over AI chat drawer allowing natural language query lookup across your folders and items (e.g. *"What is inside my Brand Assets folder?"*, *"Show private notes"*).
- 🧩 **Chrome Extension Popup (`/extension`)**: 1-click browser extension to save active tabs, YouTube links, and notes directly into your vault folders.

---

## 🛠️ Project Architecture

```
Holder/
├── client/              # Next.js 14 Glassmorphism Web App
│   ├── app/             # App router pages & global CSS design system
│   ├── components/      # Sidebar, Navbar, ItemCard, AIAssistantDrawer, Modals
│   └── package.json
├── server/              # Express + MongoDB REST API Backend
│   ├── controllers/     # Item, Folder, Metadata & AI Assistant Controllers
│   ├── models/          # Folder & Item Mongoose Schemas
│   ├── routes/          # API Endpoint Router
│   ├── index.js         # Express server with MongoMemoryServer fallback
│   └── package.json
└── extension/           # Chrome Extension Manifest V3 Quick Saver
    ├── manifest.json
    ├── popup.html
    └── popup.js
```

---

## 🚀 Getting Started

### 1. Backend Server (`/server`)
```bash
cd server
npm install
npm start
```
*Backend API will run on http://localhost:5000.*

### 2. Frontend Web App (`/client`)
```bash
cd client
npm install
npm run dev
```
*Frontend dashboard will run on http://localhost:3000.*

### 3. Chrome Extension (`/extension`)
1. Open Chrome and visit `chrome://extensions`.
2. Turn on **Developer mode** in the top right.
3. Click **Load unpacked** and select the `extension/` folder.
