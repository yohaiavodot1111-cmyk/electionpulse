# ElectionPulse — דשבורד בחירות לפריסה ב־GitHub + Vercel

מערכת HTML/JavaScript רספונסיבית ו־Serverless Function (Node.js), עם ממשק בעברית (RTL). **אין צורך ב־Python, במסד נתונים, ב־Next.js או בחבילות npm חיצוניות.**

## פרסום תוך דקות — בלי שורת פקודה

1. צור מאגר חדש ב־[GitHub](https://github.com/new) בשם `electionpulse`.
2. בחר **Add file → Upload files** והעלה את **כל תוכן התיקייה** (כולל `api/state.js`, `lib/feed.js`, `index.html`, `vercel.json`, `package.json`). אם GitHub לא מאפשר העלאת תיקיות בגרירה, הוסף אותן ב־Git או בממשק GitHub.
3. פתח [Vercel → Add New Project](https://vercel.com/new) ובחר **Import Git Repository** ואת המאגר.
4. בהגדרות הפרויקט השאר **Framework Preset: Other** (מוגדר ב־`vercel.json`) ו־**Root Directory: `./`**. לא נדרשת פקודת Build.
5. לחץ **Deploy**. תקבל כתובת בסגנון `https://electionpulse-xxx.vercel.app` שאפשר לפתוח מכל מכשיר.

המערכת תעלה מיד עם הגרפים ההיסטוריים ומצב הדגמה; **בלי פיד חיצוני לא יוצגו נתוני הצבעה חיים**.

## חיבור נתונים חיים

כשתשיג כתובת מאומתת של **קובץ JSON/CSV ישיר**, עבור ל־Vercel → Project → **Settings → Environment Variables**:

| Name | Value |
|---|---|
| `ELECTION_FEED_URL` | כתובת מלאה שמתחילה ב־`https://` ומחזירה JSON/CSV (לא עמוד HTML) |
| `ELECTION_FEED_KIND` | `external` עבור מקור חיצוני, או `test` עבור פיד הדגמה/בדיקה |

לאחר שמירת המשתנים, בצע **Redeploy** לפריסה החדשה. לבדיקת החיבור פתח `https://YOUR-DOMAIN.vercel.app/api/state` ובדוק `configured`, `lastError`, `sourceHost` ו־`data`.

**לא כל קובץ רשמי מתאים אוטומטית.** על הקובץ לעמוד בסכימה המתוארת בהמשך; לקבצים גולמיים של הוועדה ייתכן שיהיה צורך בהתאמת `lib/feed.js`. **נכון ליצירת הקוד לא שולבה כאן כתובת פיד רשמי מאומתת.** קבצי דמה/בדיקה אינם תוצאות אמת.

### סכימת JSON לדוגמה

```json
{
  "election": 26,
  "eligibleVoters": 7331981,
  "updatedAt": "2026-10-27T11:00:00+02:00",
  "turnout": { "percent": 18.0, "voters": 1319757 },
  "turnoutHistory": [{ "time": "11:00", "percent": 18.0 }],
  "counted": { "ballotsReported": 0, "totalBallots": 12018, "validVotes": 0, "invalidVotes": 0 },
  "localities": [{ "name": "דוגמה", "district": "מרכז", "eligibleVoters": 10000, "voters": 1800, "turnoutPercent": 18.0, "historicalComparablePercent": 16.0 }],
  "parties": [{ "name": "רשימה לדוגמה", "votes": 1000 }],
  "news": [{ "source": "מקור לדוגמה", "title": "פרסום לדוגמה", "kind": "news", "url": "https://example.com", "time": "2026-10-27T11:00:00+02:00" }]
}
```

כל המספרים בדוגמה **פיקטיביים**; הם אינם דיווחי ועדת הבחירות. עבור פיד בדיקה הגדר `ELECTION_FEED_KIND=test`.

### CSV נתמך

- פיד התקדמות: עמודות `time,percent` (או `שעה,אחוז הצבעה`).
- יישובים: `name,district,eligibleVoters,voters,turnoutPercent,historicalComparablePercent,ballotsReported,totalBallots` (חלק מהשמות בעברית נתמכים).
- קובץ יישובים לא משמש כמדידה ארצית עד שנוסף לו מדד השתתפות ארצי.

## אילו תכונות עובדות

- עיצוב בהיר, RTL, מדדי KPI דינמיים, השוואה לשיעורי הצבעה קודמים, גרף לפי שעות, סינון ומיון יישובים, ייצוא CSV.
- חישוב מודד מנדט בסיסי כשמועברים נתוני כל הרשימות והקולות הכשרים. חישוב זה **אינו** חלוקת 120 המנדטים הסופית לפי בדר–עופר.
- התראות סטטיסטיות/בדיקות עקביות (אינן מעידות כשלעצמן על אי־סדרים).
- מעקב פרסומים ידני או דרך שדה `news` בפיד — **אין כרגע אינטגרציה אוטומטית ל־X או לאתרי חדשות**.
- ייבוא JSON/CSV מהמחשב, מצב הדגמה מופרד, והעדכונים נמשכים כל דקה כשהדשבורד פתוח.

## התנהגות ענן ומגבלות

- Vercel מפעיל פונקציה בכל בקשת רענון. הנתונים אינם נשמרים בשרת, והעדפות/הזנות ידניות נשמרות ב־`localStorage` **בדפדפן המסוים בלבד**. למעקב ארוך־טווח או שיתוף בין מכשירים צריך להוסיף מסד נתונים.
- אם אין מקור מוגדר, אין חיבור לנתונים חיים. האתר לא יציג אחוזי הצבעה פיקטיביים, אלא רק לאחר לחיצה מפורשת על הדגמה.
- Vercel שומר מטמון של 30 שניות לקריאות ה־API. תדירות רענון בגרסה הזו תלויה בכך שהאתר פתוח בדפדפן.
- למקור CSV/JSON עם מבנה אחר יש לכתוב מתאם נוסף ב־`lib/feed.js`.
- מצב הדגמה או ידני **אינו מחליף אימות מקור**. נתונים מיובאים על ידי המשתמש אינם בהכרח רשמיים.
- אין להניח שהמקור מחזיר שיעורי הצבעה לפי יישוב במהלך היום באותו פרק זמן של הנתון הארצי. אין להסיק על תוצאות מפלגות מנתוני הצבעה חלקיים.

## בדיקה מקומית

Node.js 20+ (או חדש יותר):

```bash
npm run dev
```

ואז `http://localhost:3000`. אין צורך לבצע `npm install`, מאחר שהפרויקט אינו תלוי בחבילות חיצוניות.

לבדיקות יחידה:

```bash
npm test
```

## קובצי הפרויקט

- `index.html` — ממשק מלא, מסננים, גרפים, מחשבונים וייבוא קבצים.
- `api/state.js` — פונקציית Vercel לשאיבת נתונים (קריאה בלבד, מקור נקבע בשרת).
- `lib/feed.js` — מתאם JSON/CSV ובדיקת נתוני קלט.
- `vercel.json` — מזהה Framework: Other, הגדרות API ואבטחה.
- `local-server.js` — בדיקות מקומיות, ללא תלות חיצונית.
- `.env.example` — דוגמת הגדרות סביבת ייצור.

## מקורות רקע

- ועדת הבחירות: https://www.bechirot.gov.il/home/
- תוצאות בחירות היסטוריות: https://data.gov.il/he/datasets/central-election-committee/votes-knesset
- תיעוד Vercel לפריסת פונקציות: https://vercel.com/docs/functions/configuring-functions/runtime
