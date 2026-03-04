import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let isFirebaseInitialized = false;

try {
    // Check if configuration exists
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountPath) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccountPath)
        });
        isFirebaseInitialized = true;
        console.log('[NOTIFICATION] Firebase Admin initialized successfully.');
    } else {
        console.warn('[NOTIFICATION] FIREBASE_SERVICE_ACCOUNT_PATH not found in .env. Push notifications will be disabled.');
    }
} catch (error) {
    console.error('[NOTIFICATION] Error initializing Firebase:', error.message);
}

/**
 * Sends a push notification to the 'alerts' topic.
 * @param {string} siteName - The name of the site.
 * @param {string} level - Alert level (warning, critical).
 * @param {object} sensors - Current sensor readings.
 */
export async function sendPushNotification(siteName, level, sensors) {
    if (!isFirebaseInitialized) return;

    const title = level === 'critical' ? '🚨 CRITICAL ALERT' : '⚠️ WARNING';
    const body = `Site ${siteName} has reached ${level} levels. Temp: ${sensors.temperature}°C, Smoke: ${sensors.smoke}`;

    const message = {
        notification: {
            title: title,
            body: body,
        },
        data: {
            siteName: siteName,
            level: level,
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        topic: 'alerts',
    };

    try {
        const response = await admin.messaging().send(message);
        console.log(`[NOTIFICATION] Successfully sent message to topic 'alerts':`, response);
    } catch (error) {
        console.error('[NOTIFICATION] Error sending message:', error);
    }
}
