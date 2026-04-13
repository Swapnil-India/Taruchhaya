# 🌳 Taruchhaya | Next-Gen Inventory Management System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/Status-Production%20Ready-success)](https://github.com/)
[![Web App](https://img.shields.io/badge/Tech-Vanilla%20JS-blue)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

**Taruchhaya** is a sophisticated, enterprise-grade inventory management and business analytics platform built for high-performance retail and warehouse operations. Featuring a glassmorphic design, Google Drive cloud synchronization, and real-time analytics.

---

## ✨ Key Features

-   **🚀 High-Performance POS**: Optimized for speed with barcode scanner support and instant calculation.
-   **📊 Real-Time Analytics**: Visual dashboard using `Chart.js` for inventory distribution and revenue insights.
-   **☁️ Cloud Sync**: Seamless Google Drive integration for persistent daily reports and backups.
-   **💾 Local-First Architecture**: Uses `IndexedDB` and `localStorage` for offline reliability and sub-millisecond data access.
-   **🌓 Modern Aesthetics**: Premium Glassmorphism UI with native Dark/Light theme support.
-   **🧾 Intelligent Reporting**: Automated business performance reports generated and uploaded to the cloud.

---

## 🛠️ Technology Stack

-   **Frontend**: Vanilla JavaScript (ESM Ready), HTML5, CSS3.
-   **Storage**: IndexedDB (Primary), LocalStorage (Fallback).
-   **APIs**: Google Drive V3, GAPI, GIS.
-   **Visuals**: Chart.js, Phosphor Icons.
-   **Design**: Custom CSS Grid/Flexbox with Glassmorphism.

---

## 🚀 Getting Started

### 1. Prerequisites
- Any modern web browser (Chrome, Firefox, Safari, Edge).
- (Optional) A Google Cloud Console project for Drive integration.

### 2. Installation
Clone the repository:
```bash
git clone https://github.com/Swapnil-India/Taruchhaya.git
cd Taruchhaya
```

### 3. Local Execution
Simply open `login.html` in your browser, or if you prefer a server:
```bash
npx serve .
```
Or run the provided `.bat` file on Windows:
```cmd
run_locally.bat
```

---

## ⚙️ Google Drive Configuration

To enable cloud reports:
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a Project and enable the **Google Drive API**.
3. Create an **OAuth 2.0 Client ID** (Web Application).
4. Add your local URL as an Authorized JavaScript Origin (e.g., `http://localhost:3000`).
5. Paste your Client ID into the **Settings** panel within Taruchhaya.

---

## 🔐 Security & Privacy

Taruchhaya is a **local-first** application. Your business data never leaves your device unless you explicitly connect your Google Drive for cloud backups. Access to administrative functions (like data clearing) is protected by a PIN-based confirmation system.

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Developed with ❤️ by **Taruchhaya Enterprise**.
