import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import ingestRouter from './routes/ingest.js';
import sitesRouter  from './routes/sites.js';

dotenv.config();

const app  = express();
const port = process.env.PORT || 3001;

// ── Middleware ──────
app.use(cors());
app.use(express.json());

// ── Routes ──────
app.use('/api/ingest', ingestRouter);
app.use('/api/sites',  sitesRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start ──────────
app.listen(port, () => {
  console.log(`TelcoGuard backend running at http://localhost:${port}`);
  console.log(`  POST /api/ingest  — Raspberry Pi sensor data (requires X-API-Key)`);
  console.log(`  GET  /api/sites   — Dashboard data`);
});
