# TabCraft — AI-Powered Tab Manager for Chrome

> Smart tabs, zero clutter.

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/alloevil/tabcraft/releases)
[![Chrome](https://img.shields.io/badge/Chrome-120%2B-green.svg)](https://chromewebstore.google.com/detail/tabcraft)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## What is TabCraft?

TabCraft is a **fully open-source** Chrome extension that automatically organizes, manages, and cleans up your browser tabs using on-device AI. No account, no server, no tracking — everything runs locally in your browser.

### Why another tab manager?

Most tab managers just group by domain. TabCraft understands what each tab is actually about by reading the page title and content, not just the URL. A localhost page called "Investment Dashboard" goes into an **Investment** group, not a **Dev** group.

---

## Features (MVP)

| Feature | Description |
|---------|-------------|
| **AI Smart Grouping** | Groups tabs by topic using on-device AI (Gemini Nano) with rule-based fallback |
| **Domain Rules** | 200+ built-in rules, fully editable, import/export |
| **Duplicate Detection** | Smart URL matching that ignores tracking parameters |
| **Tab Hibernation** | Auto-suspend inactive tabs to save up to 95% memory |
| **Side Panel UI** | Modern glassmorphism interface with dark/light mode |
| **100% Private** | All processing runs locally. Zero data leaves your browser |

### Coming Soon

- Tab Snooze (close now, reopen later)
- Workspaces (save/restore tab sessions)
- Auto-learning from your grouping habits
- Crash recovery
- Multi-AI backend (Gemini Nano + Ollama + OpenAI)
- Firefox support

---

## Tech Stack

- **Framework**: [Plasmo](https://plasmo.com/) — Browser extension framework
- **Language**: TypeScript
- **UI**: React + Tailwind CSS
- **AI**: Chrome Built-in AI (Gemini Nano) + local rule engine
- **Storage**: chrome.storage.local + IndexedDB

---

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome 120+ (AI features require Chrome 127+)

### Install & Build

```bash
# Clone
git clone https://github.com/alloevil/tabcraft.git
cd tabcraft

# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Production build
npm run build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `build/chrome-mv3-dev` folder (dev) or `build/chrome-mv3-prod` folder (prod)

---

## Project Structure

```
tabcraft/
├── src/
│   ├── background/          # Service Worker (MV3)
│   │   ├── ai/              # AI grouping engines
│   │   │   ├── gemini-nano.ts
│   │   │   └── rule-engine.ts
│   │   ├── tab-manager.ts   # Tab lifecycle management
│   │   ├── hibernation.ts   # Tab hibernation strategy
│   │   ├── duplicate.ts     # Duplicate detection
│   │   └── storage.ts       # Data persistence
│   ├── sidepanel/           # UI panel
│   │   ├── components/      # React components
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── shared/              # Shared types & utils
│   │   ├── types.ts
│   │   └── constants.ts
│   └── rules/               # Seed domain rules
│       └── seed-rules.json
├── public/
│   └── icons/               # Extension icons
├── package.json
├── tsconfig.json
└── README.md
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Chrome Tab                  │
│  ┌─────────────┐       ┌─────────────────┐  │
│  │  Side Panel  │◄─────►│  Service Worker │  │
│  │  (React UI)  │       │  (Background)   │  │
│  └─────────────┘       └────────┬────────┘  │
│                                 │            │
│                    ┌────────────┼────────┐   │
│                    ▼            ▼        ▼   │
│              ┌──────────┐ ┌────────┐ ┌─────┐│
│              │ Gemini   │ │ Rule   │ │ Tab ││
│              │ Nano AI  │ │ Engine │ │ API ││
│              └──────────┘ └────────┘ └─────┘│
│                    │            │        │   │
│                    ▼            ▼        ▼   │
│              ┌─────────────────────────────┐ │
│              │   chrome.storage.local      │ │
│              │   (Rules, Settings, State)  │ │
│              └─────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Author

Built with ❤️ by the open-source community.
