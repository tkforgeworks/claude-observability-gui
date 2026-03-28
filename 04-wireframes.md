# Claude Usage Monitor — Wireframes

**Project:** Claude Usage Monitor
**Author:** Tim Klimpel / tkforgeworks
**Date:** March 2026
**Version:** 0.1 Draft

---

## Application Shell

The app uses a fixed left sidebar for navigation with a content area to the right. The sidebar collapses to icons at narrow widths. A system tray icon provides quick access when the window is minimised.

```
┌──┬───────────────────────────────────────────────────────────────┐
│  │  Claude Usage Monitor                              _ □ X      │
│  ├───────────────────────────────────────────────────────────────┤
│  │                                                               │
│N │                                                               │
│A │                                                               │
│V │                     CONTENT AREA                              │
│  │                                                               │
│  │              (renders active view below)                      │
│  │                                                               │
│  │                                                               │
│  │                                                               │
│  │                                                               │
├──┤                                                               │
│⚙ │                                                               │
└──┴───────────────────────────────────────────────────────────────┘
```

### Navigation Items (top to bottom)

```
┌──────────┐
│ ◉ Today  │  ← default landing view
│ ⟳ Cowork │
│ < > Code │
│ 💬 Chat  │
│ ⤴ Trends │
│ ▦ Heatmap│
├──────────┤
│ ⚙ Settings│  ← pinned to bottom
└──────────┘
```

---

## 1. Today View (FR-6.1)

The default landing screen. Four headline metric cards across the top, a session timeline in the middle, and a live activity sparkline at the bottom.

```
┌─────────────────────────────────────────────────────────────────┐
│  TODAY — Wednesday, March 19 2026                               │
├────────────────┬───────────────┬───────────────┬────────────────┤
│                │               │               │                │
│   SESSIONS     │  COWORK       │  CODE COST    │  ACTIVE TIME   │
│                │  TURNS        │               │                │
│      5         │     14        │    $6.42      │   ~3h 20m      │
│                │               │               │                │
│  3 cowork      │  avg 4.2 min  │  ▲ +12% vs    │  from focus    │
│  2 code        │  per turn     │  yesterday    │  events        │
│                │               │               │                │
├────────────────┴───────────────┴───────────────┴────────────────┤
│                                                                 │
│  SESSION TIMELINE                                               │
│  8am      10am      12pm       2pm       4pm       6pm    now   │
│  ├─────────┼─────────┼──────────┼─────────┼─────────┼──────┤    │
│  │         ████████CW██████     │         │         │      │    │
│  │            ██CD███           │         │         │      │    │
│  │         │         │  ████CW████████    │         │      │    │
│  │         │         │          │ ██CD██████████    │      │    │
│  │         │         │          │         │  ███CW███████  │    │
│  │         │         │          │         │         │      │    │
│  │  CW = Cowork (blue)    CD = Code (green)         │      │    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LAST 60 MINUTES                                                │
│                                                                 │
│  Turns  ·   ·   ·  ··  · ··· ·   ·  ··  ·                       │
│         ▁▁▂▁▃▁▁▂▅▃▁▂▇▅▃▂▁▁▃▂▅▃▁▂▃▁▁                             │
│                                                                 │
│  Cost   $0.18  $0.42  $0.31  $0.55  $0.22                       │
│         ▂▁▁▁▃▅▁▁▁▂▂▃▁▁▁▅▇▁▁▁▂▃▃▁▁▁                              │
│                                                                 │
│         -60m        -40m        -20m         now                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Metric Cards — Detail

Each card is a self-contained widget showing a single headline number, a label, and a secondary contextual stat.

```
┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │
│         5           │     │        14           │
│  ───────────────    │     │  ───────────────    │
│  Sessions Today     │     │  Cowork Turns       │
│                     │     │                     │
│  3 cowork · 2 code  │     │  avg 4.2 min/turn   │
│                     │     │                     │
└─────────────────────┘     └─────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │
│       $6.42         │     │      ~3h 20m        │
│  ───────────────    │     │  ───────────────    │
│  Code Cost Today    │     │  Active Time        │
│                     │     │                     │
│  ▲ +12% vs ystrdy   │     │  last focus: 3m ago │
│                     │     │                     │
└─────────────────────┘     └─────────────────────┘
```

### Session Timeline — Detail

Horizontal swim lanes, one per session. Color-coded by source. Hover shows session title and duration.

```
  8am       10am       12pm       2pm        4pm       now
  ├──────────┼──────────┼──────────┼──────────┼──────────┤

  ██████████████████████                                     refactor auth
       ┊  ┊  ┊  ┊  ┊  ┊                                     6 turns · 1h 42m
       T1 T2 T3 T4 T5 T6                                    (turns marked)

              █████████████████                              claude-obs-gui
                                                             opus · $3.18

                          ██████████████████████████████████  debug pipeline
                          ┊  ┊  ┊  ┊  ┊  ┊  ┊  ┊            8 turns · 2h 10m
                          T1 T2 T3 T4 T5 T6 T7 T8           (active)

  ── Cowork sessions (blue)
  ── Code sessions (green)
  ── Vertical tick marks within Cowork bars = individual turns
```

---

## 2. Weekly Activity Chart (FR-6.2)

Stacked vertical bar chart. One bar per day, subdivided by source.

```
┌─────────────────────────────────────────────────────────────────┐
│  WEEKLY ACTIVITY                                   [sessions ▾] │
│                                                                 │
│  12 ┤                                                           │
│     │                                                           │
│  10 ┤              ░░░                                          │
│     │              ░░░                                          │
│   8 ┤     ▓▓▓      ▓▓▓                   ▓▓▓                    │
│     │     ▓▓▓      ▓▓▓            ░░░    ▓▓▓                    │
│   6 ┤     ▓▓▓      ▓▓▓      ░░░   ▓▓▓    ▓▓▓    ░░░             │
│     │     ███      ▓▓▓      ▓▓▓   ▓▓▓    ███    ▓▓▓             │
│   4 ┤     ███      ███      ▓▓▓   ███    ███    ▓▓▓             │
│     │     ███      ███      ███   ███    ███    ███             │
│   2 ┤     ███      ███      ███   ███    ███    ███    ███      │
│     │     ███      ███      ███   ███    ███    ███    ███      │
│   0 ┼─────────────────────────────────────────────────────────  │
│       Thu       Fri       Sat      Sun     Mon     Tue    Wed   │
│       Mar 13   Mar 14   Mar 15   Mar 16  Mar 17  Mar 18 Mar 19  │
│                                                                 │
│     ███ Cowork    ▓▓▓ Code    ░░░ Chat (import)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Bar Hover Tooltip

```
          ┌───────────────────┐
          │  Tuesday, Mar 18  │
          │                   │
          │  Cowork:  3 sess  │
          │  Code:    4 sess  │
          │  Chat:    2 conv  │
          │  ──────────────── │
          │  Total:   9       │
          │  Cost:    $8.14   │
          └───────────────────┘
```

---

## 3. Cowork Sessions List (FR-6.3)

Sortable table with expandable rows. Clicking a row reveals the turn-level breakdown and a turn duration histogram for that session.

```
┌─────────────────────────────────────────────────────────────────┐
│  COWORK SESSIONS                          [search...] [sort ▾]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Title               │ Date     │ Turns │ Duration │ Avg Turn   │
│ ─────────────────────┼──────────┼───────┼──────────┼──────────  │
│ refactor auth module │ Mar 19   │   8   │  1h 42m  │   12.8m    │
│ debug pipeline       │ Mar 19   │   4   │    22m   │    5.5m    │
│ ▾ update API schema  │ Mar 18   │   6   │  1h 05m  │   10.8m    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  TURN BREAKDOWN                                          │   │
│  │                                                          │   │
│  │  #  │ Started  │ Ended    │ Duration │ Status            │   │
│  │  ───┼──────────┼──────────┼──────────┼─────────          │   │
│  │  1  │ 10:14 AM │ 10:18 AM │   3.8m   │ succeeded         │   │
│  │  2  │ 10:22 AM │ 10:30 AM │   8.1m   │ succeeded         │   │
│  │  3  │ 10:35 AM │ 10:52 AM │  17.2m   │ succeeded         │   │
│  │  4  │ 10:55 AM │ 11:04 AM │   9.0m   │ succeeded         │   │
│  │  5  │ 11:10 AM │ 11:22 AM │  12.4m   │ succeeded         │   │
│  │  6  │ 11:30 AM │ 11:44 AM │  14.3m   │ succeeded         │   │
│  │                                                          │   │
│  │  TURN DURATION HISTOGRAM                                 │   │
│  │                                                          │   │
│  │    5 ┤                                                   │   │
│  │    4 ┤                                                   │   │
│  │    3 ┤          ███                                      │   │
│  │    2 ┤          ███   ███                                │   │
│  │    1 ┤   ███    ███   ███                                │   │
│  │    0 ┼───────────────────────────                        │   │
│  │       <1m   1-3m  3-5m  5-10m  10m+                      │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│  write unit tests     │ Mar 18   │  12   │  2h 15m  │   11.3m   │
│  design review prep   │ Mar 17   │   3   │    18m   │    6.0m   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Showing 5 of 23 sessions                    [< 1 2 3 4 5 >]    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Claude Code Sessions List (FR-6.4)

Sortable table with two summary charts above: cost by project and model distribution.

```
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                              [7d ▾] [search...]    │
├────────────────────────────────┬────────────────────────────────┤
│                                │                                │
│  COST BY PROJECT               │  MODEL DISTRIBUTION            │
│                                │                                │
│  claude-obs-gui                │        ┌──────────┐            │
│  ████████████████████  $18.40  │       ╱ opus-4-6  ╲            │
│                                │      │   62%       │           │
│  api-gateway                   │      │             │           │
│  ████████████         $12.10   │       ╲  sonnet   ╱            │
│                                │        │  35%    │             │
│  dotfiles                      │         ╲ haiku ╱              │
│  █████                  $4.20  │          │ 3%  │               │
│                                │           ╲___╱                │
│  infra-scripts                 │                                │
│  ███                    $2.80  │  opus:   21 sessions           │
│                                │  sonnet: 12 sessions           │
│  homelab-ansible               │  haiku:   1 session            │
│  ██                     $1.90  │                                │
│                                │                                │
├────────────────────────────────┴────────────────────────────────┤
│                                                                 │
│  SESSIONS                                          [sort: ▾]    │
│                                                                 │
│  Project          │ Model  │ In Tok  │ Out Tok │ Cache  │ Cost  │ Date     │
│  ─────────────────┼────────┼─────────┼─────────┼────────┼───────┼────────  │
│  claude-obs-gui   │ opus   │  42.1K  │  28.3K  │ 112.4K │ $1.82 │ Mar 19  │
│  claude-obs-gui   │ opus   │  38.7K  │  22.1K  │  98.2K │ $1.54 │ Mar 19  │
│  api-gateway      │ sonnet │  15.2K  │  11.8K  │  45.6K │ $0.42 │ Mar 19  │
│  claude-obs-gui   │ opus   │  55.3K  │  34.2K  │ 145.8K │ $2.18 │ Mar 18  │
│  dotfiles         │ sonnet │   8.4K  │   5.1K  │  22.3K │ $0.18 │ Mar 18  │
│  api-gateway      │ opus   │  62.1K  │  41.7K  │ 178.3K │ $2.85 │ Mar 18  │
│  infra-scripts    │ haiku  │   3.2K  │   1.8K  │   8.4K │ $0.04 │ Mar 17  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  34 sessions · $39.40 total              [< 1 2 3 4 5 6 7 >]   │
│                                                                 │
│  CACHE EFFICIENCY (selected period)                             │
│  claude-obs-gui   ██████████████████████████░░░░  72%           │
│  api-gateway      ████████████████████░░░░░░░░░░  58%           │
│  dotfiles         ██████████████░░░░░░░░░░░░░░░░  42%           │
│  infra-scripts    █████████░░░░░░░░░░░░░░░░░░░░░  28%           │
│  (cache_read / (cache_read + input) — higher = better reuse)    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Chat History View (FR-6.5)

Conversation count over time with import status banner.

```
┌─────────────────────────────────────────────────────────────────┐
│  CHAT HISTORY                                     [week ▾]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ⓘ  Last import: March 12, 2026 (7 days ago)              │  │
│  │    Data may be stale. Export from claude.ai > Settings     │  │
│  │    > Privacy > Export data, then drop the ZIP here.        │  │
│  │                                           [Import...]     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  CONVERSATIONS PER WEEK                                         │
│                                                                 │
│  30 ┤                                                           │
│     │                         ┌──┐                              │
│  25 ┤                    ┌──┐ │  │                              │
│     │              ┌──┐  │  │ │  │                              │
│  20 ┤         ┌──┐ │  │  │  │ │  │ ┌──┐                        │
│     │    ┌──┐ │  │ │  │  │  │ │  │ │  │                        │
│  15 ┤    │  │ │  │ │  │  │  │ │  │ │  │ ┌──┐                   │
│     │    │  │ │  │ │  │  │  │ │  │ │  │ │  │                   │
│  10 ┤ ┌──│  │ │  │ │  │  │  │ │  │ │  │ │  │ ┌──┐             │
│     │ │  │  │ │  │ │  │  │  │ │  │ │  │ │  │ │  │             │
│   5 ┤ │  │  │ │  │ │  │  │  │ │  │ │  │ │  │ │  │             │
│     │ │  │  │ │  │ │  │  │  │ │  │ │  │ │  │ │  │             │
│   0 ┼────────────────────────────────────────────────────────   │
│      Jan   Jan   Feb   Feb   Feb   Mar   Mar   Mar              │
│       6     20     3    17     3    3     17    ...              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  IMPORT SUMMARY                                                 │
│                                                                 │
│  Total conversations imported:  142                             │
│  Date range:  Jan 2, 2026 — Mar 12, 2026                       │
│  Last import added:  8 new · 134 unchanged                     │
│                                                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  ╎                                                          ╎  │
│  ╎         Drop claude.ai export ZIP here                   ╎  │
│  ╎                  or click to browse                      ╎  │
│  ╎                                                          ╎  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Stale Import Warning (>14 days old)

```
┌───────────────────────────────────────────────────────────────┐
│ ⚠  Last import: February 28, 2026 (19 days ago)              │
│    Your chat data is stale. Request a fresh export from       │
│    claude.ai > Settings > Privacy > Export data.              │
│                                        [Dismiss] [Import...] │
└───────────────────────────────────────────────────────────────┘
```

---

## 6. Usage Heatmap (FR-6.6)

GitHub-style calendar heatmap. Intensity = distinct session count per day across all sources.

```
┌─────────────────────────────────────────────────────────────────┐
│  USAGE HEATMAP                                    [12 months]   │
│  Activity = distinct sessions per day (all sources combined)    │
│                                                                 │
│       Apr    May    Jun    Jul    Aug    Sep    Oct    Nov       │
│  Mon  ░▒░░   ░░▓░   ░░░░   ▒▓▒░   ░░▒░   ░▓░░   ▒▒▓░   ░░▒░ │
│  Tue  ░▓▒░   ▒▒░░   ░▒░░   ░▒▓▒   ▒░░▒   ▒▒▒░   ▓▓▒░   ▒▓▒░ │
│  Wed  ▒▒▓▒   ░▓▒░   ▒▒░░   ▓▓▒░   ░▒▓░   ░▒▒░   ▒▒░▒   ░▒▓░ │
│  Thu  ░░▒░   ▒▒▓░   ░▓▒░   ▒▒░▒   ▒▓░░   ▒░▒▓   ░▓▒░   ▒▒▒░ │
│  Fri  ▒░░░   ░▒░░   ▒▒▓░   ░░▒░   ░▒░░   ░░▒░   ░▒░░   ░░▒░ │
│  Sat  ░░      ░░     ░░░    ░░░░   ░░     ░░     ░░░    ░░   │
│  Sun           ░             ░             ░              ░    │
│                                                                 │
│       Dec    Jan    Feb    Mar                                   │
│  Mon  ▒▓▒░   ░▓▒░   ▒▓▓░   ▓▓█░                               │
│  Tue  ▓▒▒░   ▒▒▓░   ▓▒▒▓   ▒█▓                                │
│  Wed  ▒▓░▒   ▒▓▒░   ▒▓▒▒   █▓█                                │
│  Thu  ░▒▓░   ░▒▓▒   ▓▒▓░   ▓█                                 │
│  Fri  ░▒░░   ▒░▒░   ░▒▓░   ▒                                  │
│  Sat  ░░░    ░░     ░░░                                        │
│  Sun   ░      ░      ░                                         │
│                                                                 │
│  ░ 0-1  ▒ 2-4  ▓ 5-8  █ 9+   sessions per day                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  HEATMAP CELL HOVER                                             │
│  ┌──────────────────────┐                                       │
│  │  Wednesday, Mar 19   │                                       │
│  │  5 sessions          │                                       │
│  │  ───────────────     │                                       │
│  │  Cowork:  3          │                                       │
│  │  Code:    2          │                                       │
│  │  Chat:    0          │                                       │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Trends View (FR-6.7)

The Trends view is a scrollable page with a time range selector at the top and individual widget cards below. Each widget is independently configurable via `dashboard.json`.

### 7.0 Trends Header

```
┌─────────────────────────────────────────────────────────────────┐
│  TRENDS                          [7d] [30d] [90d] [1y] [custom] │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7.1 Cache Efficiency Ratio

Per-project horizontal bar showing `cache_read / (cache_read + input)` as a percentage. Helps identify which projects are reusing context effectively.

```
┌─────────────────────────────────────────────────────────────────┐
│  CACHE EFFICIENCY                                       [30d]   │
│  cache_read / (cache_read + input_tokens) — higher is better    │
│                                                                 │
│  claude-obs-gui                                                 │
│  ██████████████████████████████████████████████████████░░  78%  │
│  cache: 892K read · 251K input                                  │
│                                                                 │
│  api-gateway                                                    │
│  ████████████████████████████████████████░░░░░░░░░░░░░░   61%   │
│  cache: 445K read · 284K input                                  │
│                                                                 │
│  dotfiles                                                       │
│  ████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░   42%   │
│  cache: 94K read · 130K input                                   │
│                                                                 │
│  infra-scripts                                                  │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   28%   │
│  cache: 22K read · 57K input                                    │
│                                                                 │
│  homelab-ansible                                                │
│  █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   15%   │
│  cache: 8K read · 45K input                                     │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  WHAT THIS MEANS                                                │
│  High % = prompts reuse cached context well (saves tokens).     │
│  Low %  = sessions may be sending redundant context each turn.  │
│  Tip: long-running sessions in one project improve cache ratio. │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7.2 Turn Duration Trend

Line chart showing average Cowork turn duration over time. A sustained upward trend may indicate sessions hitting context window limits.

```
┌─────────────────────────────────────────────────────────────────┐
│  TURN DURATION TREND                          [daily ▾] [30d]   │
│  Average Cowork turn duration per day                           │
│                                                                 │
│  20m ┤                                                          │
│      │                                                          │
│  16m ┤                                                   ╱──    │
│      │                                         ╱──╲    ╱        │
│  12m ┤                               ╱──╲    ╱    ╲──╱          │
│      │                    ╱──╲     ╱╱    ╲──╱                   │
│   8m ┤          ╱──╲    ╱╱    ╲──╱╱                             │
│      │    ╱──╲╱╱    ╲──╱                                        │
│   4m ┤──╱╱                                                      │
│      │                                                          │
│   0m ┼───────────────────────────────────────────────────────── │
│       Feb 18    Feb 25     Mar 4     Mar 11     Mar 18          │
│                                                                 │
│   ── average turn duration    ·· 7-day moving average           │
│                                                                 │
│  Current avg: 14.2m   7d avg: 12.8m   30d avg: 9.4m             │
│  Trend: ▲ increasing (+36% over 30d)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7.3 Cost Velocity

Single headline metric with a 7-day rolling comparison. The sparkline shows daily cost over the selected range.

```
┌─────────────────────────────────────────────────────────────────┐
│  COST VELOCITY                                                  │
│  Rolling 7-day average daily cost (Claude Code)                 │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │              $6.82 / day                                  │  │
│  │              ▲ +18% vs prior 7d ($5.78)                   │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  DAILY COST                                                     │
│                                                                 │
│  $14 ┤                                                          │
│  $12 ┤               █                                          │
│  $10 ┤         █     █                        █                 │
│   $8 ┤    █    █     █    █              █    █    █            │
│   $6 ┤    █    █     █    █    █    █    █    █    █    █       │
│   $4 ┤    █    █     █    █    █    █    █    █    █    █       │
│   $2 ┤    █    █     █    █    █    █    █    █    █    █       │
│   $0 ┼──────────────────────────────────────────────────────── │
│       Mar  Mar  Mar  Mar  Mar  Mar  Mar  Mar  Mar  Mar  Mar     │
│        9   10   11   12   13   14   15   16   17   18   19      │
│                                                                 │
│  Period total: $47.74    Highest day: $12.40 (Mar 11)           │
│  Lowest day:    $2.10 (Mar 15, Sat)                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7.4 Session Density

Sessions per hour of active time. Shows whether usage patterns lean toward rapid iteration or long deep work.

```
┌─────────────────────────────────────────────────────────────────┐
│  SESSION DENSITY                                        [30d]   │
│  Sessions per hour of active time (from focus events)           │
│                                                                 │
│  4.0 ┤                                                          │
│      │     ·                    ·                               │
│  3.0 ┤  ╱╲ · ╱╲         ╱╲   · ╱╲              ╱╲              │
│      │╱╱  ╲╱╱  ╲       ╱  ╲╱╱╱  ╲       ╱╲   ╱╱  ╲            │
│  2.0 ┤         ╲╲    ╱╱         ╲╲    ╱╱  ╲╱╱╱    ╲╲           │
│      │          ╲╲╱╱╱            ╲╲╱╱╱              ╲╲──        │
│  1.0 ┤                                                          │
│      │                                                          │
│  0.0 ┼────────────────────────────────────────────────────────  │
│       Feb 18    Feb 25     Mar 4     Mar 11     Mar 18          │
│                                                                 │
│  Avg: 2.4 sess/hr   High: 3.8 (Feb 22)   Low: 1.1 (Mar 9)     │
│                                                                 │
│  INTERPRETATION                                                 │
│  > 3.0  rapid iteration — short sessions, quick questions       │
│  1-3    balanced mix of iteration and deep work                 │
│  < 1.0  deep focus sessions — long, sustained Claude usage      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7.5 Model Migration Tracking

Stacked area chart showing the proportion of Claude Code sessions by model over time.

```
┌─────────────────────────────────────────────────────────────────┐
│  MODEL USAGE OVER TIME                                  [90d]   │
│  Proportion of Claude Code sessions by model                    │
│                                                                 │
│ 100% ┤░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│      │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  80% ┤░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│      │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  60% ┤▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░ │
│      │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░ │
│  40% ┤███████████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░ │
│      │███████████████████████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░ │
│  20% ┤███████████████████████████████████████████████▓▓▓▓▓▓▓▓▓ │
│      │████████████████████████████████████████████████████████▓ │
│   0% ┼────────────────────────────────────────────────────────  │
│       Dec 19    Jan 18     Feb 17     Mar 19                    │
│                                                                 │
│     ███ opus-4-6    ▓▓▓ sonnet-4-6    ░░░ haiku-4-5            │
│                                                                 │
│  Current week:  opus 62% · sonnet 35% · haiku 3%               │
│  90d trend:     opus ▲ +15%  sonnet ▼ -12%  haiku ▼ -3%        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7.6 Project Activity Timeline

Gantt-style horizontal chart showing which projects had Claude Code activity on which days. Reveals context-switching and focus patterns.

```
┌─────────────────────────────────────────────────────────────────┐
│  PROJECT ACTIVITY TIMELINE                              [30d]   │
│  Each block = at least one Claude Code session that day         │
│                                                                 │
│                  Feb 18          Mar 1           Mar 15          │
│                  ├───────────────┼───────────────┼──────┤       │
│                  │               │               │      │       │
│  claude-obs-gui  │  ██ ██ ████ ██│██ ████ ██████ │██████│       │
│                  │               │               │      │       │
│  api-gateway     │  ██████ ██    │   ██ ██ ████  │  ████│       │
│                  │               │               │      │       │
│  dotfiles        │     ██       │         ██    │  ██  │       │
│                  │               │               │      │       │
│  infra-scripts   │  ██          │      ██       │      │       │
│                  │               │               │      │       │
│  homelab-ansible │         ██ ██│               │  ██  │       │
│                  │               │               │      │       │
│                  ├───────────────┼───────────────┼──────┤       │
│                                                                 │
│  SUMMARY                                                        │
│  Most active project: claude-obs-gui (18 of 30 days)            │
│  Context switches/day avg: 1.8 projects                         │
│  Max parallel projects in one day: 3 (Mar 18)                   │
│  Longest single-project streak: 5 days (claude-obs-gui, Mar 15) │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7.7 Usage Patterns Summary

Computed aggregate statistics displayed as a card grid. No charts — just headline numbers.

```
┌─────────────────────────────────────────────────────────────────┐
│  USAGE PATTERNS                                         [30d]   │
├────────────────┬───────────────┬───────────────┬────────────────┤
│                │               │               │                │
│  PEAK HOUR     │  PEAK DAY     │  AVG SESSIONS │  AVG DAILY     │
│                │               │  PER DAY      │  COST          │
│   2-3 PM       │  Tuesday      │    4.2        │   $6.80        │
│                │               │               │                │
│  62% of turns  │  28% of       │  range:       │  range:        │
│  fall 10a-4p   │  weekly total │  1 — 9        │  $0 — $14.20   │
│                │               │               │                │
├────────────────┼───────────────┼───────────────┼────────────────┤
│                │               │               │                │
│  CURRENT       │  LONGEST      │  TOTAL        │  WEEKDAY vs    │
│  STREAK        │  STREAK       │  SESSIONS     │  WEEKEND       │
│                │               │               │                │
│   3 days       │  14 days      │    126        │  88% weekday   │
│                │               │               │                │
│  Mar 17-19     │  Feb 3-16     │  (30d period) │  12% weekend   │
│                │               │               │                │
├────────────────┴───────────────┴───────────────┴────────────────┤
│                                                                 │
│  HOURLY DISTRIBUTION                                            │
│                                                                 │
│  12a                6a                 12p                6p     │
│  ├──────────────────┼──────────────────┼──────────────────┤     │
│  ░░░░░░░░░░░░░░░░░░░▒▒▒▒▓▓▓▓████████████████▓▓▓▒▒▒░░░░░░     │
│                     ↑ 8am          peak 2pm ↑        ↑ 7pm      │
│                     start of                         taper      │
│                     activity                         off        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Settings Panel (FR-6.8, FR-7)

Tabbed layout covering all configuration surfaces.

```
┌─────────────────────────────────────────────────────────────────┐
│  SETTINGS                                                       │
│  [General]  [Remote Sync]  [Dashboard]  [Data]                  │
├─────────────────────────────────────────────────────────────────┤
```

### 8.1 General Tab

```
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LOG FILE PATH                                                  │
│  ┌───────────────────────────────────────────────────┐          │
│  │ C:\Users\tim\AppData\Local\Packages\Claude_pz...  │ [Browse] │
│  └───────────────────────────────────────────────────┘          │
│  Auto-discovered from Claude_* package.   Status: ● Connected  │
│                                                                 │
│  CLAUDE CODE DATA PATH                                          │
│  ┌───────────────────────────────────────────────────┐          │
│  │ C:\Users\tim\.claude\projects\                     │ [Browse] │
│  └───────────────────────────────────────────────────┘          │
│  Last scan: 2 minutes ago · 34 sessions imported                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ⚠ cleanupPeriodDays is set to 30 (default).             │   │
│  │   JSONL files older than 30 days will be deleted by      │   │
│  │   Claude Code. Set a higher value in                     │   │
│  │   ~/.claude/settings.json to preserve history.           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  BEHAVIOR                                                       │
│  [✓] Minimise to system tray on close                           │
│  [ ] Launch on Windows startup                                  │
│  [✓] Show tray notifications for rate limit events              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Remote Sync Tab

```
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  REMOTE SYNC                                    [● Enabled  ▾]  │
│                                                                 │
│  CONNECTION PROFILES                                            │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  ● homelab          grafana.tkforgeworks.com    [✎] │        │
│  │  ○ work             influx.company.internal     [✎] │        │
│  │                                          [+ Add]    │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                 │
│  ACTIVE PROFILE: homelab                                        │
│                                                                 │
│  URL    ┌──────────────────────────────────────────────┐        │
│         │ https://grafana.tkforgeworks.com:8086         │        │
│         └──────────────────────────────────────────────┘        │
│  Bucket ┌──────────────────────────────────────────────┐        │
│         │ claude-usage                                  │        │
│         └──────────────────────────────────────────────┘        │
│  Org    ┌──────────────────────────────────────────────┐        │
│         │ tkforgeworks                                  │        │
│         └──────────────────────────────────────────────┘        │
│  Token  ┌──────────────────────────────────────────────┐        │
│         │ ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●            │ [Show] │
│         └──────────────────────────────────────────────┘        │
│         Encrypted via safeStorage (DPAPI)                       │
│                                                                 │
│                              [Test Connection]   [Save]         │
│                                                                 │
│  SYNC STATUS                                                    │
│  Last successful sync:  2 minutes ago                           │
│  Pending rows:          app_sessions: 0                         │
│                         cowork_sessions: 0                      │
│                         cowork_turns: 2                         │
│                         code_sessions: 0                        │
│                         chat_conversations: 0                   │
│                                              [Sync Now]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Dashboard Tab

```
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DASHBOARD LAYOUT                                               │
│  Drag to reorder. Toggle visibility per widget.                 │
│  Config file: %APPDATA%\ClaudeUsageMonitor\dashboard.json       │
│                                                                 │
│  VIEWS                                                          │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  ☰  [✓] Today View              [default landing ▾] │        │
│  │  ☰  [✓] Cowork Sessions         [sort: date desc ▾] │        │
│  │  ☰  [✓] Claude Code Sessions    [range: 7d ▾]       │        │
│  │  ☰  [✓] Chat History            [group: week ▾]     │        │
│  │  ☰  [✓] Usage Heatmap           [range: 12mo]       │        │
│  │  ☰  [✓] Trends                  [range: 30d ▾]      │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                 │
│  TRENDS WIDGETS                                                 │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  ☰  [✓] Cache Efficiency Ratio                      │        │
│  │  ☰  [✓] Turn Duration Trend      [granularity: daily]│       │
│  │  ☰  [✓] Cost Velocity                               │        │
│  │  ☰  [✓] Session Density                             │        │
│  │  ☰  [✓] Model Migration                             │        │
│  │  ☰  [✓] Project Activity Timeline                   │        │
│  │  ☰  [✓] Usage Patterns Summary                      │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                 │
│                    [Reset to Defaults]   [Open JSON File]        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 Data Tab

```
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DATABASE                                                       │
│  Path: C:\Users\tim\AppData\Roaming\ClaudeUsageMonitor\usage.db │
│  Size: 4.2 MB                                                  │
│  Mode: WAL                                                      │
│                                                                 │
│  ┌──────────────────────────────────────────────┐               │
│  │  Table              │ Rows   │ Oldest        │               │
│  │  ───────────────────┼────────┼────────────── │               │
│  │  app_sessions       │    42  │ Feb 15, 2026  │               │
│  │  cowork_sessions    │    89  │ Feb 18, 2026  │               │
│  │  cowork_turns       │   312  │ Feb 18, 2026  │               │
│  │  code_sessions      │   126  │ Jan 22, 2026  │               │
│  │  chat_conversations │   142  │ Jan 2, 2026   │               │
│  │  app_focus_events   │ 1,847  │ Feb 15, 2026  │               │
│  └──────────────────────────────────────────────┘               │
│                                                                 │
│                          [Backup Database...]   [Open Folder]   │
│                                                                 │
│  CHAT IMPORT                                                    │
│  Last import: March 12, 2026                                    │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  ╎       Drop claude.ai export ZIP here                     ╎  │
│  ╎                or click to browse                        ╎  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                                 │
│  LOG WATCHER STATUS                                             │
│  Watching: main.log                     Status: ● Active        │
│  Last parsed event: 3 minutes ago                               │
│  Events parsed today: 47                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. System Tray

```
                                              ┌─ Tray icon (always visible)
                                              │
   Taskbar: [...other icons...] [◉] [🔊] [📅]
                                 │
                                 └─ Right-click menu:
                                    ┌────────────────────┐
                                    │  Open Dashboard    │
                                    │  ──────────────    │
                                    │  Today: 5 sessions │
                                    │  Cost:  $6.42      │
                                    │  ──────────────    │
                                    │  Sync: ● OK        │
                                    │  ──────────────    │
                                    │  Quit              │
                                    └────────────────────┘
```

---

## 10. Warning / Status Banners

Persistent banners that appear at the top of the content area when conditions are met.

### Log path not found (FR-1.7)

```
┌───────────────────────────────────────────────────────────────┐
│ ✕  Claude Desktop log file not found. Cowork tracking is      │
│    disabled. Check that Claude Desktop is installed, or set    │
│    a custom path in Settings > General.        [Go to Settings]│
└───────────────────────────────────────────────────────────────┘
```

### Suspected log format change (FR-1.9)

```
┌───────────────────────────────────────────────────────────────┐
│ ⚠  Log file is growing but no events parsed in 72 minutes.    │
│    Claude Desktop may have changed its log format. Check for   │
│    a Claude Usage Monitor update.         [Dismiss] [Details] │
└───────────────────────────────────────────────────────────────┘
```

### Sync offline

```
┌───────────────────────────────────────────────────────────────┐
│ ⓘ  Remote sync offline. 14 rows pending.                      │
│    Last successful sync: 2 hours ago.            [Retry Now]  │
└───────────────────────────────────────────────────────────────┘
```

---

## 11. Empty & First-Run States

### 11.1 First Run — No Data (Today View)

Shown on first launch before any JSONL scan completes or log watcher connects.

```
┌─────────────────────────────────────────────────────────────────┐
│  TODAY — Thursday, March 27 2026                                │
├────────────────┬───────────────┬───────────────┬────────────────┤
│                │               │               │                │
│   SESSIONS     │  COWORK       │  CODE COST    │  ACTIVE TIME   │
│                │  TURNS        │               │                │
│      —         │      —        │      —        │      —         │
│                │               │               │                │
│  no data yet   │  no data yet  │  no data yet  │  no data yet   │
│                │               │               │                │
├────────────────┴───────────────┴───────────────┴────────────────┤
│                                                                 │
│                                                                 │
│               ┌──────────────────────────────┐                  │
│               │                              │                  │
│               │   No sessions recorded yet   │                  │
│               │                              │                  │
│               │   The app is scanning for    │                  │
│               │   Claude Code data and       │                  │
│               │   connecting to the log      │                  │
│               │   watcher. Data will appear  │                  │
│               │   here automatically.        │                  │
│               │                              │                  │
│               └──────────────────────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Partial Data — Code Only (Today View)

When JSONL data has been imported but the log watcher has no Cowork data yet (e.g. user only uses Claude Code).

```
┌─────────────────────────────────────────────────────────────────┐
│  TODAY — Thursday, March 27 2026                                │
├────────────────┬───────────────┬───────────────┬────────────────┤
│                │               │               │                │
│   SESSIONS     │  COWORK       │  CODE COST    │  ACTIVE TIME   │
│                │  TURNS        │               │                │
│      2         │      —        │    $3.18      │      —         │
│                │               │               │                │
│  0 cowork      │  no cowork    │  ▲ vs         │  log watcher   │
│  2 code        │  data yet     │  yesterday    │  not connected │
│                │               │               │                │
├────────────────┴───────────────┴───────────────┴────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ⓘ  Cowork tracking unavailable. Log file not found or    │   │
│  │    Claude Desktop not running. Active time and turn data  │   │
│  │    require a connected log watcher.     [Go to Settings]  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  SESSION TIMELINE                                               │
│  8am      10am      12pm       2pm       4pm       6pm    now  │
│  ├─────────┼─────────┼──────────┼─────────┼─────────┼──────┤   │
│  │         │  ██CD████████      │         │         │      │   │
│  │         │         │     ██CD██████     │         │      │   │
│  │         │         │          │         │         │      │   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.3 Empty List States

Generic pattern for Cowork sessions, Code sessions, and Chat history when no data exists for that source.

```
┌─────────────────────────────────────────────────────────────────┐
│  COWORK SESSIONS                          [search...] [sort ▾]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│               ┌──────────────────────────────┐                  │
│               │                              │                  │
│               │   No Cowork sessions found   │                  │
│               │                              │                  │
│               │   Cowork sessions will       │                  │
│               │   appear here when the log   │                  │
│               │   watcher detects activity   │                  │
│               │   in Claude Desktop.         │                  │
│               │                              │                  │
│               └──────────────────────────────┘                  │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                              [7d ▾] [search...]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│               ┌──────────────────────────────┐                  │
│               │                              │                  │
│               │   No Code sessions found     │                  │
│               │                              │                  │
│               │   Scanning ~/.claude/        │                  │
│               │   projects/ for JSONL data.  │                  │
│               │   Sessions will appear       │                  │
│               │   after the first scan       │                  │
│               │   completes.                 │                  │
│               │                              │                  │
│               └──────────────────────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│  CHAT HISTORY                                     [week ▾]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│               ┌──────────────────────────────┐                  │
│               │                              │                  │
│               │   No chat data imported      │                  │
│               │                              │                  │
│               │   To see chat history,       │                  │
│               │   export your data from      │                  │
│               │   claude.ai > Settings >     │                  │
│               │   Privacy > Export data,     │                  │
│               │   then drop the ZIP below.   │                  │
│               │                              │                  │
│               └──────────────────────────────┘                  │
│                                                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  ╎       Drop claude.ai export ZIP here                     ╎  │
│  ╎                or click to browse                        ╎  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

All wireframes created in `04-wireframes.md`. The document covers every FR-6 and FR-7 widget with ASCII layouts, hover states, expanded row states, contextual banners, and empty/first-run states. Each widget includes the specific metric it displays and how to interpret the data.