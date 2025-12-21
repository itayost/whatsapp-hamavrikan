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
async function setConversation(phone, name, state, data = {}) {
  await pool.query(`
    INSERT INTO conversations (phone, name, state, data, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (phone) DO UPDATE SET
      name = COALESCE($2, conversations.name),
      state = $3,
      data = conversations.data || $4,
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

// Reset conversation to idle
async function resetConversation(phone) {
  await pool.query(`
    UPDATE conversations
    SET state = 'idle', data = '{}', updated_at = NOW()
    WHERE phone = $1
  `, [phone]);
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

// Clean old conversations (30 min timeout)
async function cleanOldConversations() {
  await pool.query(`
    UPDATE conversations
    SET state = 'idle', data = '{}'
    WHERE updated_at < NOW() - INTERVAL '30 minutes'
      AND state != 'idle'
  `);
}

// Run cleanup every 5 minutes
setInterval(cleanOldConversations, 5 * 60 * 1000);

module.exports = {
  pool,
  initDb,
  getConversation,
  setConversation,
  updateConversationData,
  resetConversation,
  saveLead,
};
