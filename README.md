<p align="center">
  <img src="./assets/readme/hero.svg" width="100%"
       alt="TabCraft — AI-Powered Tab Manager for Chrome: Smart Grouping, Auto Hibernate, 100% On-Device">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.9-4285F4.svg?style=flat-square" alt="Version 0.1.9">
  <img src="https://img.shields.io/badge/Chrome-120+-34A853.svg?style=flat-square" alt="Chrome 120+">
  <img src="https://img.shields.io/badge/AI-Gemini Nano-4285F4.svg?style=flat-square" alt="Gemini Nano">
  <img src="https://img.shields.io/badge/license-MIT-yellow.svg?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/privacy-100%25 local-34A853.svg?style=flat-square" alt="100% Private">
</p>

<p align="center">
  <strong>Smart tabs, zero clutter.</strong><br>
  AI understands what each tab is about — not just the URL.
</p>

<p align="center">
  English | <a href="README.zh-CN.md">简体中文</a>
</p>

---

## What is TabCraft?

TabCraft is a **fully open-source** Chrome extension that automatically organizes, manages, and cleans up your browser tabs using on-device AI. No account, no server, no tracking — everything runs locally in your browser.

### Why another tab manager?

Most tab managers just group by domain. TabCraft understands what each tab is **actually about** by reading the page title and content. A localhost page called "Investment Dashboard" goes into an **Investment** group, not a **Dev** group.

---

<p align="center">
  <img src="./assets/readme/features-header.svg" width="100%"
       alt="Features section header">
</p>

| Feature                     | What it does                                                                   |
| --------------------------- | ------------------------------------------------------------------------------ |
| **🤖 AI Smart Grouping**    | Groups tabs by topic using on-device AI (Gemini Nano) with rule-based fallback |
| **📦 Batch Classification** | Classifies many tabs in a single AI call, with per-tab fallback                |
| **↩️ Undo Grouping**        | One-click restore of the layout before the last Smart Group                    |
| **🧠 Self-Learning**        | Learns domain→group mappings from your manual grouping (opt-in)                |
| **📋 Domain Rules**         | 390+ built-in rules, fully editable, import/export                             |
| **🔍 Duplicate Detection**  | Smart URL matching that ignores tracking parameters                            |
| **💤 Tab Hibernation**      | Auto-suspend inactive tabs to save up to 95% memory                            |
| **🗂️ Workspaces**           | Save and restore named snapshots of your tabs                                  |
| **🎨 Side Panel UI**        | Modern glassmorphism interface with dark/light mode                            |
| **🛰️ Proxy Indicator**      | Shows which proxy node each page's traffic egressed through (opt-in)           |
| **🔒 100% Private**         | All processing runs locally. Zero data leaves your browser                     |

> 📖 **New here? Read the [full usage guide → USAGE.md](USAGE.md)** — install, every button, settings, keyboard shortcuts, and how to enable on-device AI.

> 🛰️ **The proxy indicator needs one setup step.** Your Clash / mihomo core must
> expose its controller over TCP — a unix-socket-only listener can't be reached
> from an extension. Exact fields, the default `127.0.0.1:9097`, and why the
> secret matters: [USAGE.md](USAGE.md).

### Coming Soon

- Tab Snooze (close now, reopen later)
- Multi-AI backend (Gemini Nano + Ollama + OpenAI)
- Firefox support

---

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│                       Chrome Tab                             │
│  ┌──────────────┐       ┌─────────────────────────────┐     │
│  │  Side Panel   │◄─────►│      Service Worker         │     │
│  │  (React UI)   │       │       (Background)          │     │
│  └──────────────┘       └────────────┬────────────────┘     │
│                                      │                        │
│                         ┌────────────┼────────────┐          │
│                         ▼            ▼            ▼          │
│                   ┌──────────┐ ┌──────────┐ ┌─────────┐     │
│                   │ Gemini   │ │  Rule    │ │  Tab    │     │
│                   │ Nano AI  │ │  Engine  │ │   API   │     │
│                   └──────────┘ └──────────┘ └─────────┘     │
│                         │            │            │          │
│                         ▼            ▼            ▼          │
│                   ┌──────────────────────────────────────┐  │
│                   │       chrome.storage.local            │  │
│                   │    (Rules, Settings, State)           │  │
│                   └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Classification pipeline

Each tab is classified through a cascade, from most to least confident —
later steps only run if earlier ones don't have an answer:

1. **Learned mapping** — a domain you've manually grouped before
2. **Domain rule** — 390+ built-in rules (e.g. `github.com` → Development)
3. **Multi-purpose domain override** — a small list of platforms (X,
   Reddit, YouTube, Bilibili, TikTok, etc.) where content varies far more
   than the domain implies. These skip straight to the tab's own title
   keywords instead of trusting the domain rule outright, so a technical
   thread on X classifies as AI & ML instead of always "Social"
4. **URL path / title keywords** — weighted keyword scoring as a fallback
   when no domain rule matches at all
5. **On-device AI (Gemini Nano)** — only consulted when the rule engine
   itself was unsure (steps 3-4 landed on a weak guess), so confident
   domain matches never pay for an AI call. A low-confidence AI verdict
   that agrees with the rule engine's weak guess is treated as
   corroborating evidence rather than discarded

---

## Getting Started

> **Note:** TabCraft is not yet published on the Chrome Web Store. Install it locally via **Load unpacked** — takes about a minute.

### Prerequisites

- Node.js 20+ (CI builds on 20 and 22; `.nvmrc` pins the recommended version)
- Chrome 120+ (AI features require Chrome 138+, where the Prompt API is available to extensions)

### Quick Start

```bash
git clone https://github.com/alloevil/TabCraft.git
cd TabCraft
bash setup.sh
```

The script installs dependencies, builds the extension, and starts the dev server with hot reload.

Then load it in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `build/chrome-mv3-dev/` folder

> Just want to use it (no dev server)? Run `npm install && npm run build` and load the `build/chrome-mv3-prod/` folder instead.

### Manual Setup

```bash
npm install
npm run dev    # Dev mode (hot reload)
npm run build  # Production build
```

---

## Tech Stack

| Layer         | Technology                                                  |
| ------------- | ----------------------------------------------------------- |
| **Framework** | [Plasmo](https://plasmo.com/) — Browser extension framework |
| **Language**  | TypeScript                                                  |
| **UI**        | React + plain CSS with design tokens                        |
| **AI**        | Chrome Built-in AI (Gemini Nano) + local rule engine        |
| **Storage**   | chrome.storage.local + IndexedDB                            |

---

## Project Structure

```
src/
├── background/          # Service Worker (MV3)
│   ├── ai/              # AI grouping engines
│   │   ├── gemini-nano.ts
│   │   └── rule-engine.ts
│   ├── index.ts         # MV3 entry — all chrome.* listeners
│   ├── tab-manager.ts   # Tab lifecycle management
│   ├── hibernation.ts   # Tab hibernation strategy
│   └── storage.ts       # Data persistence
├── sidepanel/           # UI panel
│   ├── components/      # React components
│   ├── styles.css       # Hand-formatted (see .prettierignore)
│   ├── App.tsx
│   └── index.tsx
├── shared/              # Pure, chrome-free helpers + shared types
│   ├── types.ts
│   ├── constants.ts
│   ├── domain.ts        # Domain extraction
│   ├── duplicate.ts     # Duplicate grouping, keep-tab selection
│   └── format.ts        # Byte / duration formatting
└── rules/               # Seed domain rules
    └── seed-rules.json
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ by the open-source community.
</p>
