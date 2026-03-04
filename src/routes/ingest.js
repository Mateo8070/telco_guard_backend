import express from 'express';
import db from '../db.js';
import { sendPushNotification } from '../services/notificationService.js';

const router = express.Router();

/**
 * Middleware: verify X-API-Key header
 * The Raspberry Pi must include this header with every ingest request.
 */
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.INGEST_API_KEY;

  if (!expectedKey) {
    console.error('[AUTH] INGEST_API_KEY is not set in environment variables!');
    return res.status(500).json({ error: 'Server misconfigured: API key not set.' });
  }

  if (!apiKey || apiKey !== expectedKey) {
    console.warn(`[AUTH] Rejected ingest request — invalid or missing API key.`);
    return res.status(401).json({ error: 'Unauthorized: invalid or missing X-API-Key header.' });
  }

  next();
}

  /**
   * POST /api/ingest
   * Accepts sensor readings from the Raspberry Pi.
   *
   * Expected body:
   * {
   *   "siteId": "site-001",
   *   "sensors": {
   *     "temperature": 27.4,   // °C
   *     "humidity": 55.2,      // %
   *     "smoke": 1             // 0=Clear, 1=Detected
   *   }
   * }
   *
   * Headers:
   *   X-API-Key: <your secret key>
   */
router.post('/', requireApiKey, async (req, res) => {
  const { siteId, sensors } = req.body;

  if (!siteId || typeof sensors !== 'object') {
    return res.status(400).json({ error: 'Request must include siteId and sensors object.' });
  }

  const ALLOWED_SENSORS = ['temperature', 'humidity', 'smoke'];
  const timestamp = Date.now();

  const readingsToInsert = [];
  for (let [type, value] of Object.entries(sensors)) {
    // Normalise legacy 'gas' key → 'smoke'
    if (type === 'gas') type = 'smoke';

    if (!ALLOWED_SENSORS.includes(type)) continue; // ignore unknown sensors
    if (typeof value !== 'number') continue;

    readingsToInsert.push({
      site_id: siteId,
      sensor_type: type,
      value,
      timestamp
    });
  }

  try {
    // Insert sensor readings
    if (readingsToInsert.length > 0) {
      const { error: insertError } = await db
        .from('telco_sensor_readings')
        .insert(readingsToInsert);
      
      if (insertError) throw insertError;
    }

    // Derive site status from thresholds
    const temp  = sensors.temperature ?? 0;
    const humid = sensors.humidity    ?? 0;
    const smoke = sensors.smoke ?? sensors.gas ?? 0;

    let status = 'online';
    // Binary smoke sensor: 1 = critical alert
    if (temp > 45 || smoke > 0.5)    status = 'critical';
    else if (temp > 38 || humid > 70) status = 'warning';

    // Update site status and fetch name for notification
    const { data: siteData, error: updateError } = await db
      .from('telco_sites')
      .update({ status })
      .eq('id', siteId)
      .select('name')
      .single();

    if (updateError) throw updateError;

    // Trigger push notification for abnormal statuses
    if (status === 'critical' || status === 'warning') {
      const siteName = siteData?.name || siteId;
      sendPushNotification(siteName, status, sensors).catch(err => {
        console.error('[NOTIFICATION] Failed to send push notification:', err.message);
      });
    }

    console.log(`[INGEST] site=${siteId} temp=${sensors.temperature} humid=${sensors.humidity} smoke=${sensors.smoke ?? sensors.gas}`);
    res.status(200).json({ success: true, timestamp });
  } catch (err) {
    console.error('[INGEST] DB error:', err.message);
    res.status(500).json({ error: 'Failed to store sensor readings.' });
  }
});

export default router;
