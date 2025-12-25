const {
  getConversation,
  setConversation,
  updateConversationData,
  resetConversation,
  saveLead,
} = require('./db');
const { sendText, sendImage, formatChatId } = require('./waha');
const MESSAGES = require('./messages');

const OWNER_PHONE = process.env.OWNER_PHONE || '972544994417';

// Delay before responding (makes bot feel more natural)
const RESPONSE_DELAY_MS = 3000;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Trigger words that start a new conversation
const TRIGGER_WORDS = [
  'ניקוי', 'שלום', 'היי', 'הי',
  'מחיר', 'הצעת מחיר', 'כמה עולה'
];

// Check if message contains any trigger word (whole word match only)
function containsTrigger(text) {
  const normalized = text.trim();
  // Split into words and check for exact matches
  const words = normalized.split(/\s+/);
  return TRIGGER_WORDS.some(trigger =>
    words.some(word => word === trigger) || normalized === trigger
  );
}

// Input sanitization - limit length and remove dangerous characters
function sanitizeInput(text, maxLength = 500) {
  if (!text || typeof text !== 'string') return '';
  return text.trim().substring(0, maxLength);
}

function sanitizeName(name) {
  if (!name || typeof name !== 'string') return 'Unknown';
  return name.trim()
    .replace(/[<>]/g, '') // Remove HTML-like chars
    .substring(0, 100);
}

// Get context-aware hint for current state
function getContextHint(state) {
  const hints = {
    [STATES.AWAITING_LOCATION]: {
      question: 'מהיכן אתם?',
      example: 'לדוגמה: חיפה, קריות, עכו'
    },
    [STATES.AWAITING_ITEM]: {
      question: 'איזה פריט תרצו לנקות?',
      example: 'שלחו 1 לספה, 2 למזרן, 3 לשטיח, או 4 לכמה פריטים'
    },
    [STATES.MATTRESS_TYPE]: {
      question: 'איזה סוג מזרן?',
      example: 'שלחו 1 ליחיד, 2 לזוגי, 3 לקינג סייז'
    },
    [STATES.MATTRESS_BOTH_SIDES]: {
      question: 'האם ניקוי משני הצדדים?',
      example: 'שלחו 1 לכן, 2 ללא'
    },
    [STATES.MATTRESS_STAINS]: {
      question: 'האם יש כתמים קשים?',
      example: 'שלחו 1 לכן, 2 ללא'
    },
    [STATES.SOFA_TYPE]: {
      question: 'איזה סוג ספה?',
      example: 'שלחו מספר 1-4'
    },
    [STATES.CARPET_TYPE]: {
      question: 'איזה סוג שטיח?',
      example: 'שלחו מספר 1-5'
    },
    [STATES.MULTIPLE_SELECT]: {
      question: 'אילו פריטים?',
      example: 'שלחו מספרים מופרדים בפסיק, למשל: 1,2'
    }
  };
  return hints[state] || null;
}

// Send context-aware error message
async function sendContextError(chatId, state, userInput) {
  const hint = getContextHint(state);
  if (hint) {
    await sendText(chatId, MESSAGES.contextError(userInput, hint.question, hint.example));
  } else {
    await sendText(chatId, MESSAGES.notUnderstood);
  }
}

// Once a lead completes the flow, they cannot start again

// State machine states
const STATES = {
  IDLE: 'idle',
  COMPLETED: 'completed',
  AWAITING_LOCATION: 'awaiting_location',
  AWAITING_ITEM: 'awaiting_item',
  // Mattress flow
  MATTRESS_TYPE: 'mattress_type',
  MATTRESS_BOTH_SIDES: 'mattress_both_sides',
  MATTRESS_STAINS: 'mattress_stains',
  MATTRESS_AGE: 'mattress_age',
  MATTRESS_PHOTO: 'mattress_photo',
  // Sofa flow
  SOFA_TYPE: 'sofa_type',
  SOFA_PHOTO: 'sofa_photo',
  // Carpet flow
  CARPET_TYPE: 'carpet_type',
  CARPET_SIZE: 'carpet_size',
  CARPET_PHOTO: 'carpet_photo',
  // Multiple items
  MULTIPLE_SELECT: 'multiple_select',
};

// Parse numbered option (1,2,3...) or return original text
function parseNumberedOption(text, options) {
  const trimmed = text.trim();
  const num = parseInt(trimmed, 10);

  // If it's a valid number and within range, return the corresponding option
  if (!isNaN(num) && num >= 1 && num <= options.length) {
    return options[num - 1];
  }

  // Check if text matches any option
  for (const option of options) {
    if (trimmed.includes(option) || option.includes(trimmed)) {
      return option;
    }
  }

  // Return original text as fallback
  return trimmed;
}

// Parse multiple items selection - supports "1,2,3" or "ספה מזרן שטיח"
function parseMultipleItems(text) {
  const trimmed = text.trim();
  const items = [];

  // Check for numbered input (e.g., "1,2" or "1 2 3")
  const numbers = trimmed.match(/[123]/g);
  if (numbers) {
    const uniqueNumbers = [...new Set(numbers)];
    for (const num of uniqueNumbers) {
      if (num === '1') items.push('ספה');
      if (num === '2') items.push('מזרן');
      if (num === '3') items.push('שטיח');
    }
    if (items.length > 0) return items;
  }

  // Check for text mentions
  if (trimmed.includes('ספה')) items.push('ספה');
  if (trimmed.includes('מזרן')) items.push('מזרן');
  if (trimmed.includes('שטיח')) items.push('שטיח');

  return items;
}

// Handle incoming message
async function handleMessage(payload) {
  const rawChatId = payload.from;

  // Ignore group messages - only respond to private chats
  if (rawChatId.endsWith('@g.us')) {
    console.log(`[Flow] Ignoring group message from ${rawChatId}`);
    return;
  }

  // Extract phone number (works with @c.us, @lid, @s.whatsapp.net formats)
  const phone = rawChatId.replace('@lid', '').replace('@c.us', '').replace('@s.whatsapp.net', '');

  // Preserve original format: @lid for Facebook/Instagram ad leads, @c.us for regular contacts
  const chatId = rawChatId.endsWith('@lid') ? `${phone}@lid` : formatChatId(phone);
  // Try multiple sources for the contact name - NOWEB engine uses different fields
  const rawName = payload.pushName
    || payload._data?.notifyName
    || payload._data?.pushName
    || payload.notifyName
    || payload.sender?.pushname
    || payload.sender?.name
    || payload.contact?.name
    || payload.contact?.pushname;
  // Fallback to phone number if no name found (better than "Unknown")
  const name = sanitizeName(rawName) !== 'Unknown' ? sanitizeName(rawName) : phone;
  // Sanitize message text - limit length
  const messageText = sanitizeInput(payload.body, 1000);
  const hasMedia = payload.hasMedia || false;
  const mediaUrl = payload.media?.url || null;

  console.log(`[Flow] Message from ${phone} (${name}): "${messageText}" (hasMedia: ${hasMedia}, rawChatId: ${rawChatId}, derivedChatId: ${chatId})`);

  // Get current conversation state
  let conv = await getConversation(phone);

  // If no active conversation or completed, check for trigger word to start new one
  if (!conv || conv.state === STATES.IDLE || conv.state === STATES.COMPLETED) {
    // If lead already completed the flow once, ignore forever
    if (conv?.data?.completed_at) {
      console.log(`[Flow] Ignoring - lead ${phone} already completed flow`);
      return;
    }

    // If owner has contacted this user, don't auto-start bot
    // This covers: imported contacts, owner messaged first, owner took over
    if (conv?.data?.owner_contacted) {
      console.log(`[Flow] Ignoring - owner has contact with ${phone}`);
      return;
    }

    if (containsTrigger(messageText)) {
      // Store chatId to always reply to same format (@lid or @c.us)
      console.log(`[Flow] Trigger detected for ${phone}, starting flow with chatId: ${chatId}`);
      await setConversation(phone, name, STATES.AWAITING_LOCATION, { chatId });
      await sleep(RESPONSE_DELAY_MS);
      await sendText(chatId, MESSAGES.welcome);
    } else {
      console.log(`[Flow] Ignoring message - no active conversation`);
    }
    return;
  }

  // Use stored chatId if available, otherwise use current chatId
  // This ensures we always reply to the same chat where conversation started
  const storedChatId = conv.data?.chatId;
  let replyChatId = storedChatId || chatId;

  console.log(`[Flow] ChatId resolution: stored=${storedChatId}, current=${chatId}, using=${replyChatId}`);

  // Update stored chatId if user switched formats (e.g., from @lid to @c.us)
  if (storedChatId && storedChatId !== chatId) {
    console.log(`[Flow] User switched from ${storedChatId} to ${chatId} - updating`);
    await updateConversationData(phone, { chatId });
    // Continue using the new chatId for this and future messages
    replyChatId = chatId;
  } else if (!storedChatId) {
    // First message after trigger - store the chatId
    console.log(`[Flow] No stored chatId, storing: ${chatId}`);
    await updateConversationData(phone, { chatId });
  }

  // Process based on current state
  console.log(`[Flow] Processing state ${conv.state} for ${phone}, replying to ${replyChatId}`);
  await processState(replyChatId, phone, name, conv, messageText, hasMedia, mediaUrl);
}

// Process message based on conversation state
async function processState(chatId, phone, name, conv, text, hasMedia, mediaUrl) {
  const state = conv.state;
  const data = conv.data || {};

  // Wait before responding
  await sleep(RESPONSE_DELAY_MS);

  try {
    switch (state) {
    case STATES.AWAITING_LOCATION:
      await setConversation(phone, name, STATES.AWAITING_ITEM, { ...data, location: text });
      await sendText(chatId, MESSAGES.itemSelection);
      break;

    case STATES.AWAITING_ITEM:
      await handleItemSelection(chatId, phone, name, text, data);
      break;

    // Mattress flow
    case STATES.MATTRESS_TYPE:
      await setConversation(phone, name, STATES.MATTRESS_BOTH_SIDES, { ...data, mattressType: parseNumberedOption(text, ['יחיד', 'זוגי', 'קינג סייז']) });
      await sendText(chatId, MESSAGES.mattressBothSides);
      break;

    case STATES.MATTRESS_BOTH_SIDES:
      await setConversation(phone, name, STATES.MATTRESS_STAINS, { ...data, bothSides: parseNumberedOption(text, ['כן', 'לא']) });
      await sendText(chatId, MESSAGES.mattressStains);
      break;

    case STATES.MATTRESS_STAINS:
      await setConversation(phone, name, STATES.MATTRESS_AGE, { ...data, stains: parseNumberedOption(text, ['כן', 'לא']) });
      await sendText(chatId, MESSAGES.mattressAge);
      break;

    case STATES.MATTRESS_AGE:
      await setConversation(phone, name, STATES.MATTRESS_PHOTO, { ...data, age: text });
      await sendText(chatId, MESSAGES.mattressPhoto);
      break;

    case STATES.MATTRESS_PHOTO:
      if (hasMedia || text === '0' || text === 'דלג') {
        await handleItemComplete(chatId, phone, name, 'מזרן', {
          subType: data.mattressType,
          bothSides: data.bothSides,
          stains: data.stains,
          age: data.age,
        }, hasMedia ? mediaUrl : null, data);
      } else {
        await sendText(chatId, '📸 אנא שלחו תמונה של המזרן\n\n_שלחו 0 לדלג_');
      }
      break;

    // Sofa flow
    case STATES.SOFA_TYPE:
      await setConversation(phone, name, STATES.SOFA_PHOTO, { ...data, sofaType: parseNumberedOption(text, ['ספה סטנדרטית', 'שזלונג "ר"', 'מערכת ישיבה גדולה', 'ספה מלבנית']) });
      await sendText(chatId, MESSAGES.sofaPhoto);
      break;

    case STATES.SOFA_PHOTO:
      if (hasMedia || text === '0' || text === 'דלג') {
        await handleItemComplete(chatId, phone, name, 'ספה', {
          subType: data.sofaType,
        }, hasMedia ? mediaUrl : null, data);
      } else {
        await sendText(chatId, '📸 אנא שלחו תמונה של הספה\n\n_שלחו 0 לדלג_');
      }
      break;

    // Carpet flow
    case STATES.CARPET_TYPE:
      await setConversation(phone, name, STATES.CARPET_SIZE, { ...data, carpetType: parseNumberedOption(text, ['שטיח שאגי', 'שטיח סינטתי', 'שטיח וינטג׳ / מודרני', 'שטיח עבודת יד (צמר / כותנה)', 'שטיח מקיר לקיר']) });
      await sendText(chatId, MESSAGES.carpetSize);
      break;

    case STATES.CARPET_SIZE:
      await setConversation(phone, name, STATES.CARPET_PHOTO, { ...data, carpetSize: text });
      await sendText(chatId, MESSAGES.carpetPhoto);
      break;

    case STATES.CARPET_PHOTO:
      if (hasMedia || text === '0' || text === 'דלג') {
        await handleItemComplete(chatId, phone, name, 'שטיח', {
          subType: data.carpetType,
          size: data.carpetSize,
        }, hasMedia ? mediaUrl : null, data);
      } else {
        await sendText(chatId, '📸 אנא שלחו תמונה של השטיח\n\n_שלחו 0 לדלג_');
      }
      break;

    // Multiple items selection
    case STATES.MULTIPLE_SELECT:
      // Parse text for item selection - support numbered input or text
      const items = parseMultipleItems(text);
      if (items.length > 0) {
        await handleMultipleSelect(chatId, phone, name, items, data);
      } else {
        await sendContextError(chatId, state, text);
      }
      break;

    default:
      console.log(`[Flow] Unknown state: ${state}`);
      await sendContextError(chatId, state, text);
    }
  } catch (err) {
    console.error(`[Flow] Error in state ${state} for ${phone}:`, err.message);
    // Try to send error message to user, but don't fail if that also errors
    await sendText(chatId, MESSAGES.notUnderstood).catch(() => {});
  }
}

// Handle item selection - supports numbered options (1,2,3,4) or text
async function handleItemSelection(chatId, phone, name, text, data) {
  const normalizedText = text.trim();

  // Check for numbered input first
  if (normalizedText === '1' || normalizedText.includes('ספה')) {
    await setConversation(phone, name, STATES.SOFA_TYPE, { ...data, itemType: 'ספה' });
    await sendText(chatId, MESSAGES.sofaType);
  } else if (normalizedText === '2' || normalizedText.includes('מזרן')) {
    await setConversation(phone, name, STATES.MATTRESS_TYPE, { ...data, itemType: 'מזרן' });
    await sendText(chatId, MESSAGES.mattressType);
  } else if (normalizedText === '3' || normalizedText.includes('שטיח')) {
    await setConversation(phone, name, STATES.CARPET_TYPE, { ...data, itemType: 'שטיח' });
    await sendText(chatId, MESSAGES.carpetType);
  } else if (normalizedText === '4' || normalizedText.includes('כמה פריטים') || normalizedText.includes('יחד')) {
    await setConversation(phone, name, STATES.MULTIPLE_SELECT, { ...data, itemType: 'כמה פריטים' });
    await sendText(chatId, MESSAGES.multipleItems);
  } else {
    await sendContextError(chatId, STATES.AWAITING_ITEM, text);
  }
}

// Handle multiple items selection
async function handleMultipleSelect(chatId, phone, name, selectedItems, data) {
  if (!selectedItems || selectedItems.length === 0) {
    await sendContextError(chatId, STATES.MULTIPLE_SELECT, '');
    return;
  }

  // Store pending items and completed items
  const pendingItems = [...selectedItems];
  const firstItem = pendingItems.shift();

  await sendText(chatId, MESSAGES.startingWith(firstItem));

  // Start with first item
  const newData = {
    ...data,
    itemType: 'כמה פריטים',
    pendingItems,
    completedItems: [],
    currentItem: firstItem,
  };

  if (firstItem === 'מזרן') {
    await setConversation(phone, name, STATES.MATTRESS_TYPE, newData);
    await sendText(chatId, MESSAGES.mattressType);
  } else if (firstItem === 'ספה') {
    await setConversation(phone, name, STATES.SOFA_TYPE, newData);
    await sendText(chatId, MESSAGES.sofaType);
  } else if (firstItem === 'שטיח') {
    await setConversation(phone, name, STATES.CARPET_TYPE, newData);
    await sendText(chatId, MESSAGES.carpetType);
  }
}

// Handle item completion - check if more items pending
async function handleItemComplete(chatId, phone, name, itemType, itemDetails, photoUrl, data) {
  const completedItem = {
    type: itemType,
    details: itemDetails,
    photos: photoUrl ? [photoUrl] : [],
  };

  // Check if this is part of multiple items flow
  const pendingItems = data.pendingItems || [];
  const completedItems = [...(data.completedItems || []), completedItem];

  if (pendingItems.length > 0) {
    // More items to process
    const nextItem = pendingItems.shift();

    await sendText(chatId, MESSAGES.itemTransition(itemType, nextItem));

    const newData = {
      location: data.location,
      itemType: 'כמה פריטים',
      pendingItems,
      completedItems,
      currentItem: nextItem,
    };

    if (nextItem === 'מזרן') {
      await setConversation(phone, name, STATES.MATTRESS_TYPE, newData);
      await sendText(chatId, MESSAGES.mattressType);
    } else if (nextItem === 'ספה') {
      await setConversation(phone, name, STATES.SOFA_TYPE, newData);
      await sendText(chatId, MESSAGES.sofaType);
    } else if (nextItem === 'שטיח') {
      await setConversation(phone, name, STATES.CARPET_TYPE, newData);
      await sendText(chatId, MESSAGES.carpetType);
    }
  } else {
    // All items completed - save lead
    if (completedItems.length > 1) {
      // Multiple items - combine into one lead
      const allPhotos = completedItems.flatMap(item => item.photos);
      const combinedDetails = {
        items: completedItems.map(item => ({
          type: item.type,
          ...item.details,
        })),
      };

      await completeLead(chatId, phone, name, 'כמה פריטים', combinedDetails, allPhotos, data.location);
    } else {
      // Single item
      await completeLead(chatId, phone, name, itemType, itemDetails, photoUrl ? [photoUrl] : [], data.location);
    }
  }
}

// Complete lead and notify owner
async function completeLead(chatId, phone, name, itemType, itemDetails, photos, location) {
  // Save lead to database
  const lead = await saveLead({
    phone,
    name,
    location,
    itemType,
    itemDetails,
    photos,
  });

  console.log(`[Flow] Lead saved: ${lead.id}`);

  // Send thank you message to customer
  await sendText(chatId, MESSAGES.thankYou);

  // Notify owner
  const ownerChatId = formatChatId(OWNER_PHONE);
  const notification = MESSAGES.ownerNotification({
    phone,
    name,
    location,
    itemType,
    itemDetails,
    photos,
  });

  await sendText(ownerChatId, notification);

  // Forward photos to owner
  if (photos && photos.length > 0) {
    for (const photoUrl of photos) {
      if (photoUrl) {
        try {
          await sendImage(ownerChatId, photoUrl, `תמונה מ-${name}`);
        } catch (err) {
          console.error(`[Flow] Failed to forward photo:`, err.message);
        }
      }
    }
  }

  // Reset conversation
  await resetConversation(phone);
}

// Handle outgoing message from owner - marks user to prevent bot interference
async function handleOwnerMessage(payload) {
  // For outgoing messages, WAHA puts the recipient in 'from' field (the chat ID)
  const rawChatId = payload.from || payload.to;

  // Ignore messages without recipient (reactions, status updates, etc.)
  if (!rawChatId) {
    return;
  }

  // Ignore group messages
  if (rawChatId.endsWith('@g.us')) {
    return;
  }

  // Extract phone number of recipient
  const phone = rawChatId.replace('@lid', '').replace('@c.us', '').replace('@s.whatsapp.net', '');

  // Check if recipient has an existing conversation record
  const conv = await getConversation(phone);

  if (conv) {
    // Mark with owner_contacted if not already marked
    if (!conv.data?.owner_contacted) {
      console.log(`[Flow] Owner contacted ${phone} - marking to prevent bot interference`);
      await updateConversationData(phone, { owner_contacted: Date.now() });
    }
  } else {
    // No conversation exists - create one with owner_contacted flag
    console.log(`[Flow] Owner initiated contact with ${phone} - bot will not auto-respond`);
    await setConversation(phone, 'Unknown', STATES.IDLE, { owner_contacted: Date.now() });
  }
}

module.exports = {
  handleMessage,
  handleOwnerMessage,
};
