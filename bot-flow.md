# המבריקן Bot - Conversation Flow

## Trigger Word
**ניקוי** - activates the bot

---

## Welcome Message
```
ברוכים הבאים להמבריקן - שירותי ניקוי מקצועיים לספות, שטיחים, מזרנים, כורסאות וריפודים.
נשמח לעזור ולתת לכם הצעת מחיר מדויקת.
מהיכן אתם? (אנחנו נותנים שירות בחיפה הקריון והצפון בלבד)
```

**User answers with location**

---

## Item Selection
```
מעולה! איזה פריט תרצו לנקות?
1) ספות
2) שטיח
3) מזרן
4) כמה פריטים יחד
```

---

## Flow: מזרן (Mattress)

### Step 1: Type
```
איזה סוג מזרן יש לכם?
1) יחיד
2) זוגי
3) קינג סייז
```

### Step 2: Both Sides
```
האם יש צורך בניקוי משני הצדדים?
כן
לא
```

### Step 3: Stains
```
האם יש כתמים קשים וריח לא טוב (שתן, דם וכדומה)?
כן
לא
```

### Step 4: Age
```
כמה זמן המזרן בשימוש?
```

### Step 5: Photo Request
```
אנא שלחו תמונה של המזרן לקבלת אבחון והצעת מחיר מדויקת
```

---

## Flow: ספות (Sofa)

### Step 1: Type
```
איזה סוג ספה יש לכם?
1) ספה סטנדרטית
2) שזלונג "ר"
3) מערכת ישיבה גדולה
4) ספה מלבנית
```

### Step 2: Photo Request
```
אנא שלחו תמונה של הספה לקבלת אבחון והצעת מחיר מדויקת
(חשוב: הצעת מחיר מבוססת על פי גודל הספה, מצב הלכלוך והכתמים והאם הכריות נשלפות או קבועות)
```

---

## Flow: שטיח (Carpet)
*TODO: Not implemented yet*

---

## Flow: כמה פריטים יחד (Multiple Items)

### Step 1: Select Items
```
אילו פריטים תרצו לנקות? (ניתן לבחור כמה)
1) ספה
2) מזרן
3) שטיח (בקרוב)
```

**Then runs the relevant flow for each selected item**

---

## After Photo Received

### Step 1: Confirmation to User
```
תודה! נציג יחזור אליכם בהקדם עם הצעת מחיר
```

### Step 2: Notify Business Owner
Send WhatsApp message to **972544994417** with:
- Customer name
- Phone number
- Location
- Item type & details
- Photo(s)

---

## Data to Collect (Leads Table)

| Field | Description |
|-------|-------------|
| phone | User phone number |
| name | WhatsApp display name |
| location | City/area |
| item_type | ספה / שטיח / מזרן / כמה פריטים |
| item_details | JSON with specific answers |
| photos | Array of photo URLs |
| status | new / quoted / converted |
| created_at | Timestamp |
