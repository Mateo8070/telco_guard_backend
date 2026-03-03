import express from 'express';
import db from '../db.js';

const router = express.Router();

// How many historical readings per sensor to return
const HISTORY_LIMIT = 100;

const SENSOR_DEFAULTS = {
  temperature: { threshold: 29.5, unit: '°C' },
  humidity:    { threshold: 70.0, unit: '%'  },
  smoke:       { threshold: 10.0, unit: 'ppm'},
};

/**
 * GET /api/sites
 * Returns all sites with their latest sensor values and reading history.
 */
router.get('/', async (req, res) => {
  try {
    const { data: sites, error: sitesError } = await db
      .from('telco_sites')
      .select('*');

    if (sitesError) throw sitesError;

    const enrichedSites = await Promise.all(sites.map(async (site) => {
      const { data: rows, error: readingsError } = await db
        .from('telco_sensor_readings')
        .select('sensor_type, value, timestamp')
        .eq('site_id', site.id)
        .order('timestamp', { ascending: false })
        .limit(HISTORY_LIMIT * Object.keys(SENSOR_DEFAULTS).length);

      if (readingsError) throw readingsError;

      // Build a map of sensor_type → readings[]
      const readingsByType = {};
      rows.forEach((r) => {
        const type = r.sensor_type === 'gas' ? 'smoke' : r.sensor_type;
        if (!SENSOR_DEFAULTS[type]) return;
        if (!readingsByType[type]) readingsByType[type] = [];
        readingsByType[type].push({ timestamp: r.timestamp, value: r.value });
      });

      // Shape sensors object expected by the frontend
      const sensors = {};
      for (const [type, defaults] of Object.entries(SENSOR_DEFAULTS)) {
        const history = readingsByType[type] || [];
        sensors[type] = {
          current:   history.length > 0 ? history[0].value : 0,
          history,
          threshold: defaults.threshold,
          unit:      defaults.unit,
        };
      }

      return {
        id:         site.id,
        name:       site.name,
        location:   site.location,
        status:     site.status,
        lastUpdate: rows.length > 0 ? rows[0].timestamp : new Date(site.created_at).getTime(),
        sensors,
      };
    }));

    res.json(enrichedSites);
  } catch (err) {
    console.error('[SITES] Error fetching sites:', err.message);
    res.status(500).json({ error: 'Failed to retrieve site data.' });
  }
});

export default router;
