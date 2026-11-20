// תזכורות פוש: משימות חובה לפני טיסה
// רץ פעם ביום מתוך GitHub Actions (.github/workflows/push-reminders.yml)
//
// כללים:
//  - חלון שליחה: מ-30 ועד 24 ימים לפני הטיסה (לפי שעון ישראל)
//  - פוש אחד כל 3 ימים לכל היותר, עד 3 פעמים לטיול
//  - נשלח רק אם יש משימות חובה שלא סומנו, ורק אם הטיול לא הושלם
//  - אם תאריך הטיסה משתנה, המונה מתאפס
//
// TEST_MODE=true  -> שולח הודעת בדיקה לכל המכשירים, בלי לגעת במונים

const admin = require('firebase-admin');

const DATABASE_URL = 'https://family-travel-app-d4710-default-rtdb.europe-west1.firebasedatabase.app';
const SITE_URL = 'https://eliranshmilo-arch.github.io/family-travel-app/';
const TZ = 'Asia/Jerusalem';

const FIRST_DAY = 30;   // מתחילים 30 ימים לפני הטיסה
const LAST_DAY = 24;    // לא שולחים פחות מ-24 ימים לפני הטיסה
const INTERVAL = 3;     // כל 3 ימים
const MAX_SENDS = 3;    // עד 3 פעמים

const TEST_MODE = process.env.TEST_MODE === 'true';

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('Missing FIREBASE_SERVICE_ACCOUNT secret');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: DATABASE_URL
});
const db = admin.database();

// תאריך בפורמט YYYY-MM-DD לפי שעון ישראל
function israelDate(d = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function daysBetween(fromYmd, toYmd) {
    return Math.round((Date.parse(toYmd + 'T00:00:00Z') - Date.parse(fromYmd + 'T00:00:00Z')) / 86400000);
}
const isYmd = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);
const asList = v => (Array.isArray(v) ? v : Object.values(v || {})).filter(Boolean);

async function loadTokens() {
    const snap = await db.ref('PushTokens').once('value');
    const tokens = [];
    snap.forEach(child => { const t = child.val() && child.val().token; if (t) tokens.push({ key: child.key, token: t }); });
    return tokens;
}

// שליחה לכל המכשירים + ניקוי מכשירים שכבר לא רשומים
async function sendToAll(tokens, { title, body, link, tripId }) {
    let success = 0;
    for (let i = 0; i < tokens.length; i += 500) {
        const chunk = tokens.slice(i, i + 500);
        const res = await admin.messaging().sendEachForMulticast({
            tokens: chunk.map(t => t.token),
            notification: { title, body },
            data: { tripId: tripId || '' },
            webpush: {
                notification: { icon: SITE_URL + 'icon.png', dir: 'rtl', lang: 'he' },
                fcmOptions: { link }
            }
        });
        success += res.successCount;
        const removals = [];
        res.responses.forEach((r, idx) => {
            const code = r.error && r.error.code;
            if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument') {
                removals.push(db.ref('PushTokens/' + chunk[idx].key).remove());
            } else if (r.error) {
                console.warn('Send error:', code, r.error.message);
            }
        });
        await Promise.all(removals);
        if (removals.length) console.log(`Removed ${removals.length} stale tokens`);
    }
    return success;
}

async function main() {
    const tokens = await loadTokens();
    const today = israelDate();
    console.log(`Today (Israel): ${today} | registered devices: ${tokens.length}`);
    if (!tokens.length) { console.log('No devices registered. Nothing to do.'); return; }

    if (TEST_MODE) {
        const n = await sendToAll(tokens, { title: '🔔 בדיקת התראות', body: 'אם אתם רואים את זה – ההתראות של פורטל הטיולים עובדות!', link: SITE_URL });
        console.log(`Test push delivered to ${n}/${tokens.length} devices`);
        return;
    }

    const trips = (await db.ref('Trips').once('value')).val() || {};
    for (const [tripId, trip] of Object.entries(trips)) {
        const s = trip.settings || {};
        const name = s.lobbyTitle || 'הטיול';
        const tag = `[${tripId} | ${name}]`;

        if (s.isCompleted === true) { console.log(tag, 'skip: completed'); continue; }
        const returnDay = trip.flights && trip.flights.f2_date;
        if (isYmd(returnDay) && daysBetween(today, returnDay.slice(0, 10)) < 0) { console.log(tag, 'skip: auto-completed'); continue; }
        if (!isYmd(s.flightDateTime)) { console.log(tag, 'skip: no flight date'); continue; }

        const flightDay = s.flightDateTime.slice(0, 10);
        const daysLeft = daysBetween(today, flightDay);
        if (daysLeft > FIRST_DAY || daysLeft < LAST_DAY) { console.log(tag, `skip: ${daysLeft} days left (outside ${FIRST_DAY}-${LAST_DAY})`); continue; }

        const missing = asList(trip.mandatoryTasks).filter(t => !t.checked);
        if (!missing.length) { console.log(tag, 'skip: all mandatory tasks done'); continue; }

        let state = trip.pushReminders || {};
        if (state.flightDay !== flightDay) state = {}; // תאריך טיסה השתנה -> מתחילים מחדש
        const sent = state.sent || 0;
        if (sent >= MAX_SENDS) { console.log(tag, `skip: already sent ${sent} reminders`); continue; }
        if (state.lastSentDate && daysBetween(state.lastSentDate, today) < INTERVAL) { console.log(tag, `skip: last reminder on ${state.lastSentDate}`); continue; }

        const examples = missing.slice(0, 2).map(t => t.text).join(', ');
        const delivered = await sendToAll(tokens, {
            title: `✈️ בעוד ${daysLeft} ימים טסים – ${name}`,
            body: `נשארו ${missing.length} משימות חובה לפני הטיסה (${examples}${missing.length > 2 ? '...' : ''}). לחצו להשלמה.`,
            link: `${SITE_URL}?trip=${encodeURIComponent(tripId)}&tab=packing`,
            tripId
        });
        console.log(tag, `reminder #${sent + 1} delivered to ${delivered}/${tokens.length} devices`);

        if (delivered > 0) {
            await db.ref(`Trips/${tripId}/pushReminders`).set({ flightDay, sent: sent + 1, lastSentDate: today, lastDaysLeft: daysLeft });
        }
    }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
