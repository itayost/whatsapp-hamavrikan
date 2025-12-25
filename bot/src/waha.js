const axios = require('axios');

const WAHA_URL = process.env.WAHA_URL || 'http://waha:3000';
const WAHA_API_KEY = process.env.WAHA_API_KEY;
const SESSION = process.env.WAHA_SESSION || 'default';

const api = axios.create({
  baseURL: WAHA_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(WAHA_API_KEY && { 'X-Api-Key': WAHA_API_KEY }),
  },
});

// Track phones the bot recently sent to (to distinguish from owner messages)
const recentBotRecipients = new Set();
const BOT_MESSAGE_WINDOW_MS = 5000; // 5 seconds

function markBotSent(chatId) {
  const phone = chatId.replace('@lid', '').replace('@c.us', '').replace('@s.whatsapp.net', '');
  recentBotRecipients.add(phone);
  setTimeout(() => recentBotRecipients.delete(phone), BOT_MESSAGE_WINDOW_MS);
}

function wasBotMessage(phone) {
  return recentBotRecipients.has(phone);
}

// Send a text message
async function sendText(chatId, text) {
  try {
    markBotSent(chatId);
    const response = await api.post('/api/sendText', {
      session: SESSION,
      chatId,
      text,
    });
    console.log(`[WAHA] Sent text to ${chatId}`);
    return response.data;
  } catch (error) {
    console.error(`[WAHA] Error sending text:`, error.message);
    throw error;
  }
}

// Send an image
async function sendImage(chatId, imageUrl, caption = '') {
  try {
    markBotSent(chatId);
    const response = await api.post('/api/sendImage', {
      session: SESSION,
      chatId,
      file: { url: imageUrl },
      caption,
    });
    console.log(`[WAHA] Sent image to ${chatId}`);
    return response.data;
  } catch (error) {
    console.error(`[WAHA] Error sending image:`, error.message);
    throw error;
  }
}

// Format phone number to WhatsApp chatId
function formatChatId(phone) {
  // Remove any non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // Add @c.us suffix for individual chats
  return `${cleaned}@c.us`;
}

module.exports = {
  sendText,
  sendImage,
  formatChatId,
  wasBotMessage,
};
