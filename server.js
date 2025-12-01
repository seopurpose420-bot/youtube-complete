require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

// Configuration
const decode = (str) => Buffer.from(str, 'base64').toString('ascii');
const API_ENDPOINT = process.env.API_ENDPOINT ? decode(process.env.API_ENDPOINT) : 'https://ytapi.apps.mattw.io/v3';

// Middleware
app.use(express.static(__dirname));
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Main API proxy handler
const handleAPIRequest = async (req, res) => {
    try {
        const path = req.path.replace('/api/data', '');
        const query = req.url.split('?')[1];
        
        if (!query) {
            return res.status(400).json({ error: 'Missing query parameters' });
        }
        
        const targetUrl = `${API_ENDPOINT}${path}?${query}`;
        
        // Stealth headers to mimic legitimate browser requests
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.youtube.com/',
            'Origin': 'https://www.youtube.com',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        
        console.log(`Proxying request to: ${targetUrl}`);
        
        const response = await fetch(targetUrl, { 
            headers,
            timeout: 30000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Add response headers for caching
        res.set({
            'Cache-Control': 'public, max-age=300',
            'X-Proxy-Status': 'success',
            'X-Response-Time': Date.now()
        });
        
        res.json(data);
        
        // Random delay to avoid detection patterns
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        
    } catch (error) {
        console.error('API Request failed:', error.message);
        
        // Generic error response to avoid revealing internal details
        res.status(500).json({ 
            error: 'Service temporarily unavailable',
            code: 'PROXY_ERROR',
            timestamp: new Date().toISOString()
        });
    }
};

// API routes
app.get('/api/data/*', handleAPIRequest);

// Serve main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static files explicitly
app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'styles.css'));
});

app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'script.js'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 3008;
const server = app.listen(PORT, () => {
    console.log(`🚀 YouTube Data Analyzer Server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = app;
