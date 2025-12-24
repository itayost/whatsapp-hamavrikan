/**
 * Import existing WhatsApp contacts to prevent bot interruption
 *
 * Uses WAHA API: GET /api/{session}/chats
 * Docs: https://waha.devlike.pro/docs/how-to/chats/
 *
 * Run: docker exec whatsapp-bot node src/import-contacts.js
 */

const axios = require('axios');
const { Pool } = require('pg');

const WAHA_URL = process.env.WAHA_URL || 'http://waha:3000';
const WAHA_API_KEY = process.env.WAHA_API_KEY;
const SESSION = process.env.WAHA_SESSION || 'default';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'leads',
  user: process.env.POSTGRES_USER || 'whatsapp',
  password: process.env.POSTGRES_PASSWORD,
});

const api = axios.create({
  baseURL: WAHA_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(WAHA_API_KEY && { 'X-Api-Key': WAHA_API_KEY }),
  },
});

async function importContacts() {
  console.log('=== Importing existing WhatsApp contacts ===\n');
  console.log(`WAHA URL: ${WAHA_URL}`);
  console.log(`Session: ${SESSION}\n`);

  try {
    // Fetch all chats from WAHA with pagination
    let allChats = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      console.log(`Fetching chats (offset: ${offset})...`);
      const response = await api.get(`/api/${SESSION}/chats`, {
        params: { limit, offset, sortBy: 'messageTimestamp', sortOrder: 'desc' }
      });

      const chats = response.data;
      if (!chats || chats.length === 0) break;

      allChats = allChats.concat(chats);
      if (chats.length < limit) break;
      offset += limit;
    }

    console.log(`\nFound ${allChats.length} total chats\n`);

    let imported = 0;
    let skipped = 0;

    for (const chat of allChats) {
      const chatId = chat.id || chat._id;
      if (!chatId) {
        skipped++;
        continue;
      }

      // Skip groups and broadcasts
      if (chatId.endsWith('@g.us') || chatId.endsWith('@broadcast')) {
        skipped++;
        continue;
      }

      // Extract phone number
      const phone = chatId
        .replace('@lid', '')
        .replace('@c.us', '')
        .replace('@s.whatsapp.net', '');

      // Skip invalid phone numbers
      if (!phone || phone.length < 8 || !/^\d+$/.test(phone)) {
        skipped++;
        continue;
      }

      const name = chat.name || chat.pushName || chat.contact?.name || phone;

      // Insert/update with owner_contacted flag
      await pool.query(`
        INSERT INTO conversations (phone, name, state, data, updated_at)
        VALUES ($1, $2, 'idle', $3, NOW())
        ON CONFLICT (phone) DO UPDATE SET
          data = conversations.data || $3,
          updated_at = NOW()
      `, [phone, name, JSON.stringify({ owner_contacted: Date.now() })]);

      imported++;
      if (imported % 10 === 0) {
        console.log(`Progress: ${imported} contacts imported...`);
      }
    }

    console.log(`\n=== Done ===`);
    console.log(`Imported: ${imported}`);
    console.log(`Skipped: ${skipped} (groups, broadcasts, invalid)`);
    console.log(`\nThese contacts will NOT trigger the bot automatically.`);

  } catch (error) {
    if (error.response?.status === 404) {
      console.error('Error: WAHA session not found. Is the session started?');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Error: Cannot connect to WAHA. Is it running?');
    } else {
      console.error('Error:', error.message);
      console.error('Status:', error.response?.status);
      console.error('Response:', JSON.stringify(error.response?.data, null, 2));
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

importContacts();
