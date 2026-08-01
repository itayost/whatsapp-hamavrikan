# Graph Report - .  (2026-08-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 84 nodes · 145 edges · 11 communities (9 shown, 2 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ac64ba99`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10

## God Nodes (most connected - your core abstractions)
1. `handleMessage()` - 13 edges
2. `processState()` - 11 edges
3. `sendText()` - 10 edges
4. `setConversation()` - 8 edges
5. `handleItemComplete()` - 7 edges
6. `completeLead()` - 7 edges
7. `handleOwnerMessage()` - 7 edges
8. `sendContextError()` - 6 edges
9. `handleItemSelection()` - 6 edges
10. `handleMultipleSelect()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `handleMessage()` --calls--> `getConversation()`  [EXTRACTED]
  bot/src/flow.js → bot/src/db.js
- `handleOwnerMessage()` --calls--> `getConversation()`  [EXTRACTED]
  bot/src/flow.js → bot/src/db.js
- `handleItemComplete()` --calls--> `setConversation()`  [EXTRACTED]
  bot/src/flow.js → bot/src/db.js
- `handleMessage()` --calls--> `setConversation()`  [EXTRACTED]
  bot/src/flow.js → bot/src/db.js
- `handleOwnerMessage()` --calls--> `setConversation()`  [EXTRACTED]
  bot/src/flow.js → bot/src/db.js

## Import Cycles
- None detected.

## Communities (11 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (14): axios, dependencies, axios, express, pg, description, main, name (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (9): initDb(), app, express, { handleMessage, handleOwnerMessage }, { initDb }, processedMessages, start(), userMessageCounts (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.22
Nodes (10): updateConversationData(), handleOwnerMessage(), api, axios, lidCache, markBotSent(), recentBotRecipients, resolveLidToPhone() (+2 more)

### Community 3 - "Community 3"
Cohesion: 0.20
Nodes (10): containsTrigger(), getContextHint(), {
  getConversation,
  setConversation,
  updateConversationData,
  resetConversation,
  saveLead,
}, ITEM_VARIANTS, MESSAGES, parseNumberedOption(), recentCompletions, { sendText, sendImage, formatChatId, wasBotMessage, resolveLidToPhone } (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.24
Nodes (8): getConversation(), { Pool }, resetConversation(), saveLead(), sendInactivityReminders(), updateConversationDataOnly(), completeLead(), formatChatId()

### Community 5 - "Community 5"
Cohesion: 0.80
Nodes (6): setConversation(), handleItemSelection(), handleMultipleSelect(), processState(), sendContextError(), sendText()

### Community 6 - "Community 6"
Cohesion: 0.40
Nodes (3): api, axios, { Pool }

### Community 7 - "Community 7"
Cohesion: 0.50
Nodes (4): handleMessage(), sanitizeInput(), sanitizeName(), sleep()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (3): handleItemComplete(), isRecentlyCompleted(), markCompleted()

## Knowledge Gaps
- **31 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `handleMessage()` connect `Community 7` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `sendText()` connect `Community 5` to `Community 2`, `Community 3`, `Community 4`, `Community 7`, `Community 9`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._