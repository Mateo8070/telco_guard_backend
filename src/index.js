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

// Landing page
app.get('/', (_req, res) => {
  res.send(`
    <html>
      <head><title>TelcoGuard API</title></head>
      <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f4f4f9;">
        <h1 style="color: #2c3e50;">TelcoGuard REST API</h1>
        <p style="color: #7f8c8d;">Status: Online and connected to Supabase</p>
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <code>GET /api/sites</code> - Dashboard data<br>
          <code>POST /api/ingest</code> - Sensor ingestion
        </div>
      </body>
    </html>
  `);
});

// ── Start ──────────
app.listen(port, () => {
  console.log(`TelcoGuard backend running at http://localhost:${port}`);
  console.log(`  POST /api/ingest  — Raspberry Pi sensor data (requires X-API-Key)`);
  console.log(`  GET  /api/sites   — Dashboard data`);
});
