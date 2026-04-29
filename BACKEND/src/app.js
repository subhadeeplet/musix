const cookieParser = require('cookie-parser');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const musicRoutes = require('./routes/music.routes');

function normalizeUrl(url, fallback) {
    if (!url) return fallback;
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const app = express();
app.use(
    cors({
        origin: normalizeUrl(process.env.FRONTEND_URL, 'http://localhost:5173'),
        credentials: true,
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
