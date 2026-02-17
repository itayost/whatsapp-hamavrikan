const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'leads',
  user: process.env.POSTGRES_USER || 'whatsapp',
  password: process.env.POSTGRES_PASSWORD,
});

// Handle pool errors to prevent crashes
pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});

// Initialize database tables
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        phone VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        state VARCHAR(50) DEFAULT 'idle',
        data JSONB DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(50),
        name VARCHAR(255),
        location VARCHAR(255),
        item_type VARCHAR(50),
        item_details JSONB DEFAULT '{}',
        photos TEXT[] DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_updated
        ON conversations(updated_at);

      CREATE INDEX IF NOT EXISTS idx_leads_status
        ON leads(status);
    `);
    console.log('[DB] Tables created');
  } finally {
    client.release();
  }
}

// Get conversation state for a phone number
async function getConversation(phone) {
  const result = await pool.query(
    'SELECT * FROM conversations WHERE phone = $1',
    [phone]
  );
  return result.rows[0] || null;
}

// Create or update conversation state
// chatId is stored in data.chatId to preserve @lid/@c.us format
async function setConversation(phone, name, state, data = {}) {
  await pool.query(`
    INSERT INTO conversations (phone, name, state, data, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (phone) DO UPDATE SET
      name = COALESCE($2, conversations.name),
      state = $3,
      data = COALESCE(conversations.data, '{}'::jsonb) || $4,
      updated_at = NOW()
  `, [phone, name, state, JSON.stringify(data)]);
}

// Update just the data field (merge with existing)
async function updateConversationData(phone, newData) {
  await pool.query(`
    UPDATE conversations
    SET data = data || $2, updated_at = NOW()
    WHERE phone = $1
  `, [phone, JSON.stringify(newData)]);
}

// Reset conversation to completed (with cooldown timestamp)
async function resetConversation(phone) {
  await pool.query(`
    UPDATE conversations
    SET state = 'completed', data = $2, updated_at = NOW()
    WHERE phone = $1
  `, [phone, JSON.stringify({ completed_at: Date.now() })]);
}

// Save a completed lead
async function saveLead(lead) {
  const result = await pool.query(`
    INSERT INTO leads (phone, name, location, item_type, item_details, photos)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    lead.phone,
    lead.name,
    lead.location,
    lead.itemType,
    JSON.stringify(lead.itemDetails),
    lead.photos || []
  ]);
  return result.rows[0];
}

// Update just the data field (merge) WITHOUT touching updated_at
// Used by reminder system so reminders don't reset the inactivity timer
async function updateConversationDataOnly(phone, newData) {
  await pool.query(
    `UPDATE conversations SET data = data || $2 WHERE phone = $1`,
    [phone, JSON.stringify(newData)]
  );
}

// Clean old conversations (60 min timeout - extended from 30 to allow reminder window)
// Preserve completed_at and owner_contacted to prevent re-triggering
async function cleanOldConversations() {
  await pool.query(`
    UPDATE conversations
    SET state = 'idle',
        data = jsonb_build_object(
          'completed_at', data->'completed_at',
          'owner_contacted', data->'owner_contacted'
        ),
        updated_at = NOW()
    WHERE updated_at < NOW() - INTERVAL '60 minutes'
      AND state != 'idle'
      AND state != 'completed'
  `);
}

// Send inactivity reminders to leads who haven't responded in 30 minutes
// Only sends one reminder per conversation (tracked via data.reminded_at)
async function sendInactivityReminders() {
  try {
    const result = await pool.query(`
      SELECT phone, state, data
      FROM conversations
      WHERE updated_at < NOW() - INTERVAL '30 minutes'
        AND state != 'idle'
        AND state != 'completed'
        AND (data->>'reminded_at') IS NULL
        AND (data->>'owner_contacted') IS NULL
        AND (data->>'completed_at') IS NULL
    `);

    if (result.rows.length === 0) return;

    // Lazy require to avoid circular deps (flow.js imports db.js)
    const { sendText } = require('./waha');
    const MESSAGES = require('./messages');

    for (const row of result.rows) {
      try {
        const chatId = row.data?.chatId;
        if (!chatId) {
          console.log(`[Reminder] No chatId for ${row.phone}, skipping`);
          continue;
        }

        const reminderMessage = MESSAGES.reminders[row.state];
        if (!reminderMessage) {
          console.log(`[Reminder] No reminder message for state "${row.state}", skipping ${row.phone}`);
          continue;
        }

        console.log(`[Reminder] Sending reminder to ${row.phone} (state: ${row.state})`);
        await sendText(chatId, reminderMessage);
        await updateConversationDataOnly(row.phone, { reminded_at: Date.now() });
        console.log(`[Reminder] Reminder sent to ${row.phone}`);
      } catch (err) {
        console.error(`[Reminder] Error sending reminder to ${row.phone}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Reminder] Error in sendInactivityReminders:', err.message);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanOldConversations, 5 * 60 * 1000);

// Run reminder check every 5 minutes
setInterval(sendInactivityReminders, 5 * 60 * 1000);

module.exports = {
  pool,
  initDb,
  getConversation,
  setConversation,
  updateConversationData,
  updateConversationDataOnly,
  resetConversation,
  saveLead,
};
