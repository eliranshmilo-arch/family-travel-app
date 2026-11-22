# פורטל הטיולים המשפחתי (family-travel-app) – הנחיות לפרויקט

אפליקציית PWA בעברית (RTL) לניהול טיולים משפחתיים: טיסות וכרטיסים, מסלול, ציוד אריזה, משימות חובה לפני טיסה, הוצאות, מיקומים, מסמכים וטלפונים, תגיות מזוודה ופאנל ניהול.
ענה תמיד בעברית. הסבר כל שינוי בקצרה לפני שאתה מבצע אותו. צעד אחד בכל פעם, ולעצור כשאני אומר "עצור".

## ארכיטקטורה
- **repo:** `eliranshmilo-arch/family-travel-app` (GitHub Pages, מתעדכן אחרי `git push` ל-main)
- **Firebase project:** `family-travel-app-d4710` – **משותף גם עם cleaner-hours-app**
  - Authentication – כניסה אנונימית (`signInAnonymously`); פאנל ניהול מוגן ב-PIN (`Global/adminPin`)
  - Realtime Database – europe-west1
  - Cloud Messaging – Push
- **תזכורות Push:** GitHub Actions (`.github/workflows/push-reminders.yml`) מריץ כל יום ב-06:00 UTC את `.github/push/send-reminders.js`. דורש secret `FIREBASE_SERVICE_ACCOUNT`. הרצה ידנית עם `test=true` שולחת הודעת בדיקה בלי לעדכן מונים.

## קבצים
| קובץ | תפקיד |
|---|---|
| `index.html` | כל המסכים, ה-CSS וה-JS (קובץ גדול, ~110KB). Firebase compat SDK 10.13.0 |
| `firebase-messaging-sw.js` | Push ברקע |
| `manifest.json`, `icon.png` | התקנה למסך הבית |
| `*.jpg` | תמונות יעדים ורקע |

## מבנה הנתונים
- `Trips/{tripId}/` – flights, itinerary, packing, mandatoryTasks, expenses, locations
- `Global/Templates` – תבניות (למשל רשימות אריזה)
- `Global/adminPin` – קוד מנהל
- `PushTokens/{token}` – מכשירים לפוש

## לוגיקת תזכורות
- חלון שליחה: 30 עד 24 ימים לפני הטיסה (שעון ישראל)
- פוש אחד כל 3 ימים לכל היותר, עד 3 פעמים לטיול
- רק אם יש משימות חובה פתוחות ורק לטיול שלא הושלם; שינוי תאריך טיסה מאפס את המונה

## איך מעלים שינויים
```
git add .
git commit -m "<תיאור>"
git push origin main
```

## כללים
- `index.html` גדול – לערוך בבלוקים ממוקדים, לא לשכתב את כל הקובץ.
- לפני שינוי ב-database rules – לבדוק שאפליקציית שעון הנוכחות לא נפגעת.
- לא להכניס סודות לקוד; Service Account רק דרך GitHub Secrets.
- לא למחוק טיולים או נתונים בלי אישור מפורש.
