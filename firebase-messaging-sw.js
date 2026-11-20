// Service Worker להתראות פוש (Firebase Cloud Messaging)
// חייב לשבת בתיקייה הראשית של האתר, ליד index.html
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAKlewYVxd7bWRRV-M8hs_YZKuYp1V0TQM",
    authDomain: "family-travel-app-d4710.firebaseapp.com",
    databaseURL: "https://family-travel-app-d4710-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "family-travel-app-d4710",
    storageBucket: "family-travel-app-d4710.firebasestorage.app",
    messagingSenderId: "843954095365",
    appId: "1:843954095365:web:d9687120c3987d3a7aa36c"
});

// ההודעות נשלחות עם notification + fcmOptions.link,
// כך שה-SDK מציג אותן ופותח את הקישור בלחיצה באופן אוטומטי.
firebase.messaging();
