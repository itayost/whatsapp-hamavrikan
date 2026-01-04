// Hebrew message templates for המבריקן bot

const MESSAGES = {
  // Welcome flow
  welcome: `*ברוכים הבאים לחברת המבריקן!*

אנחנו נותנים שירותי ניקוי מקצועיים לספות, שטיחים, מזרנים, כורסאות וריפודים.

נשמח לעזור ולתת לכם הצעת מחיר מדויקת

📍 *מהיכן אתם?*
_(אנחנו נותנים שירות בחיפה, הקריות והצפון בלבד)_`,

  // Item selection
  itemSelection: `👍 מעולה!

🛋️ *איזה פריט תרצו לנקות?*

1️⃣ ספה
2️⃣ מזרן
3️⃣ שטיח
4️⃣ כמה פריטים יחד

_(שלחו את מספר האפשרות או שם הפריט)_`,

  // Mattress flow
  mattressType: `🛏️ *איזה סוג מזרן יש לכם?*

1️⃣ יחיד
2️⃣ זוגי
3️⃣ קינג סייז`,

  mattressBothSides: `🔄 *האם יש צורך בניקוי משני הצדדים?*

1️⃣ כן ✅
2️⃣ לא ❌`,

  mattressStains: `🔍 *האם יש כתמים קשים וריח לא טוב?*
_(שתן, דם וכדומה)_

1️⃣ כן ✅
2️⃣ לא ❌`,

  mattressAge: `⏰ *כמה זמן המזרן בשימוש?*

_(לדוגמה: שנה, 3 שנים, חדש)_`,

  mattressPhoto: `📸 *אנא שלחו תמונה של המזרן*

לקבלת אבחון והצעת מחיר מדויקת`,

  // Sofa flow
  sofaType: `🛋️ *איזה סוג ספה יש לכם?*

1️⃣ ספה סטנדרטית
2️⃣ שזלונג "ר"
3️⃣ מערכת ישיבה גדולה
4️⃣ ספה מלבנית`,

  sofaPhoto: `📸 *אנא שלחו תמונה של הספה*

לקבלת אבחון והצעת מחיר מדויקת

💡 _חשוב: הצעת מחיר מתבצעת על פי גודל הספה, מצב הלכלוך והכתמים, והאם הכריות נשלפות או קבועות_`,

  // Carpet flow
  carpetType: `🧶 *איזה סוג שטיח יש לכם?*

1️⃣ שטיח שאגי
2️⃣ שטיח סינטתי
3️⃣ שטיח וינטג׳ / מודרני
4️⃣ שטיח עבודת יד (צמר / כותנה)
5️⃣ שטיח מקיר לקיר`,

  carpetSize: `📏 *מה גודל השטיח?*

_(לדוגמה: 2x3 מטר, קטן, גדול)_`,

  carpetPhoto: `📸 *אנא שלחו תמונה של השטיח*

לקבלת אבחון והצעת מחיר מדויקת`,

  // Multiple items flow
  multipleItems: `📦 *אילו פריטים תרצו לנקות?*

1️⃣ ספה 🛋️
2️⃣ מזרן 🛏️
3️⃣ שטיח 🧶

_(בחרו כמה אופציות, למשל: ספה ומזרן)_`,

  // Completion
  thankYou: `🎉 *תודה רבה!*

נציג יחזור אליכם בהקדם עם אבחון מקצועי והצעת מחיר מדויקת

_המבריקן - ממשיכים להוביל את תחום הנקיון בחיפה, הקריות והצפון 🥇_`,

  // Errors / fallbacks
  notUnderstood: `🤔 לא הבנתי את התשובה

אנא בחרו אחת מהאפשרויות`,

  contextError: (userInput, question, example) => `🤔 לא הבנתי "${userInput}"

❓ *${question}*

💡 _${example}_`,

  // Transition messages for multiple items
  itemTransition: (fromItem, toItem) => `✅ סיימנו עם ה${fromItem}!

עכשיו נמשיך ל${toItem} 👇`,

  startingWith: (item) => `👍 מעולה! נתחיל עם ${item}`,

  // Owner notification template
  ownerNotification: (lead) => `🔔 *ליד חדש!*

👤 *שם:* ${lead.name}
📞 *טלפון:* ${formatPhone(lead.phone)}
📍 *מיקום:* ${lead.location}
🛋️ *פריט:* ${lead.itemType}

📋 *פרטים נוספים:*
${formatDetails(lead.itemDetails)}

${lead.photos?.length ? `📸 *תמונות:* ${lead.photos.length}` : ''}`,
};

// Format phone number: 972544994417 -> 0544994417
function formatPhone(phone) {
  if (!phone) return '';
  const phoneStr = String(phone);
  // Remove 972 prefix and add 0
  if (phoneStr.startsWith('972')) {
    return '0' + phoneStr.slice(3);
  }
  return phoneStr;
}

// Format item details for notification
function formatDetails(details) {
  if (!details || Object.keys(details).length === 0) return '_אין_';

  // Handle multiple items
  if (details.items && Array.isArray(details.items)) {
    return details.items.map((item, i) => {
      const lines = [`*פריט ${i + 1}:* ${item.type}`];
      if (item.subType) lines.push(`  📌 סוג: ${item.subType}`);
      if (item.size) lines.push(`  📏 גודל: ${item.size}`);
      if (item.bothSides) lines.push(`  🔄 שני צדדים: ${item.bothSides}`);
      if (item.stains) lines.push(`  🔍 כתמים: ${item.stains}`);
      if (item.age) lines.push(`  ⏰ זמן שימוש: ${item.age}`);
      return lines.join('\n');
    }).join('\n\n');
  }

  // Single item
  const lines = [];
  if (details.subType) lines.push(`📌 סוג: ${details.subType}`);
  if (details.size) lines.push(`📏 גודל: ${details.size}`);
  if (details.bothSides) lines.push(`🔄 שני צדדים: ${details.bothSides}`);
  if (details.stains) lines.push(`🔍 כתמים: ${details.stains}`);
  if (details.age) lines.push(`⏰ זמן שימוש: ${details.age}`);

  return lines.join('\n') || '_אין_';
}

module.exports = MESSAGES;
