const cookieParser = require('cookie-parser');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const musicRoutes = require('./routes/music.routes');

function normalizeUrl(url, fallback) {
    if (!url) return fallback;
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function getAllowedOrigins() {
    const raw = [
        process.env.FRONTEND_URLS,
        process.env.FRONTEND_URL,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ]
        .filter(Boolean)
        .join(',');

    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((u) => normalizeUrl(u, u))
        .map((u) => u.replace(/\/+$/, ''));
}

const allowedOrigins = new Set(getAllowedOrigins());

const app = express();
app.use(
    cors({
        origin(origin, cb) {
            // Same-origin / server-to-server requests won't send Origin.
            if (!origin) return cb(null, true);

            const clean = String(origin).replace(/\/+$/, '');
            if (allowedOrigins.has(clean)) return cb(null, true);

            // Allow Render static sites and previews.
            if (/^https:\/\/.+\.onrender\.com$/i.test(clean)) return cb(null, true);

            // Allow local dev.
            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(clean)) return cb(null, true);

            return cb(new Error(`CORS blocked for origin: ${clean}`));
        },
        credentials: true,
        optionsSuccessStatus: 200,
    })
);
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Musix API is running',
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/music', musicRoutes);

module.exports = app;
