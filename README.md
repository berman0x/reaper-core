# 🧠 Reaper – Security Orchestration Dashboard

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0.0-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0.0-38B2AC?logo=tailwind-css)
![Vite](https://img.shields.io/badge/Vite-4.0.0-646CFF?logo=vite)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

---

## 📌 Overview

**Reaper** is a modern, open‑source security orchestration dashboard designed for incident response training, threat simulation, and playbook automation. Built for security professionals, analysts, and red/blue teams, Reaper provides a clean, intuitive interface to monitor assets, simulate threat scenarios, and track response metrics—all without requiring authentication or external dependencies.

> 🛡️ **Not a C2 tool.** Reaper is a defensive security training platform. All simulations are local and non‑destructive.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Live Dashboard** | Real‑time stats, threat distribution pie chart, incident trend line chart |
| 🖥️ **Asset Management** | Monitor assets with risk scoring, OS detection, and status tracking |
| 🧩 **Playbook Simulation** | Run simulated threat scenarios (ransomware, data exfil, privilege escalation) |
| 📝 **Incident Logging** | Live activity feed with timestamps and event types |
| 📁 **Report Export** | Export simulation logs as JSON for documentation or analysis |
| 🌙 **Dark / Light Mode** | Toggle themes for comfortable viewing |
| 📱 **Fully Responsive** | Works on desktop, tablet, and mobile |

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript |
| **Styling** | Tailwind CSS |
| **State Management** | Zustand |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Build Tool** | Vite |
| **Routing** | React Router |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/berman0x/Reaper.git

# Navigate to project directory
cd Reaper

# Install dependencies
npm install

# Start development server
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

---

## 📂 Project Structure

```
src/
├── components/
│   ├── Sidebar.tsx
│   ├── StatCard.tsx
│   ├── AssetTable.tsx
│   ├── PlaybookGrid.tsx
│   ├── ActivityFeed.tsx
│   └── TrendChart.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── Assets.tsx
│   ├── Playbooks.tsx
│   ├── Reports.tsx
│   └── Settings.tsx
├── store/
│   └── useStore.ts       # Zustand state management
└── styles/
    └── globals.css       # Tailwind + custom theme
```

---

## 🧪 Usage

### Simulating a Threat

1. Navigate to the **Playbooks** page.
2. Click **Simulate** on any playbook card.
3. A new incident will appear in the live activity feed.
4. Dashboard stats will update automatically.

### Managing Assets

- View all assets in the **Assets** table.
- Filter by OS or risk score using the search/filter bar.
- Monitor asset status (online, offline, compromised, remediated).

### Exporting Logs

1. Go to **Settings**.
2. Click **Export Logs**.
3. A JSON file containing all incident logs will be downloaded.

---

## 🛠️ Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Deploy to Netlify

```bash
npm run build
# Drag and drop the `dist` folder to Netlify
```

---

## 🤝 Contributing

Contributions are welcome. Please open an issue or submit a pull request.

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 🙏 Acknowledgments

- Built with ❤️ by the Black Lotus Syndicate
- Inspired by modern SOAR platforms and incident response frameworks
- Open source and free for the security community

---

## 📬 Contact

- **GitHub:** [berman0x](https://github.com/berman0x)
- **Project Repo:** [Reaper](https://github.com/berman0x/Reaper)

---

> ⚠️ **Disclaimer:** This tool is intended for educational and training purposes only. The authors assume no responsibility for misuse.
```

---
