const express = require('express');
const { initDb } = require('./db');
const { handleMessage, handleOwnerMessage } = require('./flow');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Message deduplication - track recently processed message IDs
const processedMessages = new Set();
const DEDUP_WINDOW_MS = 30000; // 30 seconds

function isDuplicate(messageId) {
  if (!messageId) return false;
  if (processedMessages.has(messageId)) {
    return true;
  }
  processedMessages.add(messageId);
  // Clean up after window expires
  setTimeout(() => processedMessages.delete(messageId), DEDUP_WINDOW_MS);
  return false;
}

// Rate limiting - track message count per user (simpler, less memory)
const userMessageCounts = new Map();
const RATE_LIMIT_MAX = 15; // max messages per minute

function checkRateLimit(chatId) {
  const count = userMessageCounts.get(chatId) || 0;

  if (count >= RATE_LIMIT_MAX) {
    console.log(`[RateLimit] Blocked ${chatId} - ${count} messages in last minute`);
    return false;
  }

  userMessageCounts.set(chatId, count + 1);
  return true;
}

// Reset all rate limits every minute (simple, memory-efficient)
setInterval(() => {
  userMessageCounts.clear();
}, 60000);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// WAHA webhook endpoint
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    const { event, payload } = req.body;

    console.log(`[Webhook] Event: ${event}`);

    // Handle outgoing messages (owner takeover detection)
    if ((event === 'message' || event === 'message.any') && payload.fromMe) {
      await handleOwnerMessage(payload);
      return res.json({ success: true });
    }

    // Handle incoming messages
    if ((event === 'message' || event === 'message.any') && !payload.fromMe) {
      // Skip duplicate messages (WAHA sometimes sends twice)
      if (isDuplicate(payload.id)) {
        console.log(`[Webhook] Skipping duplicate message ${payload.id}`);
        return res.json({ success: true, duplicate: true });
      }

      // Skip status updates and broadcasts
      if (payload.isStatusV3 || payload.isBroadcast) {
        console.log(`[Webhook] Ignoring status/broadcast message`);
        return res.json({ success: true });
      }

      // Apply rate limiting
      if (!checkRateLimit(payload.from)) {
        return res.json({ success: true, rateLimited: true });
      }

      await handleMessage(payload);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    // Don't leak internal error details
    res.status(500).json({ error: 'Internal error' });
  }
});

// Start server
async function start() {
  try {
    await initDb();
    console.log('[DB] Connected to PostgreSQL');

    app.listen(PORT, () => {
      console.log(`[Bot] Running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Bot] Failed to start:', error);
    process.exit(1);
  }
}

start();
