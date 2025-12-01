const fetch = require('node-fetch');

const decode = (str) => Buffer.from(str, 'base64').toString('ascii');
const API_ENDPOINT = process.env.API_ENDPOINT ? decode(process.env.API_ENDPOINT) : 'https://ytapi.apps.mattw.io/v3';

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { url } = req;
        const path = url.replace('/api/server', '');
        const query = url.split('?')[1];
        
        if (!query) {
            return res.status(400).json({ error: 'Missing query parameters' });
        }
        
        const targetUrl = `${API_ENDPOINT}${path}?${query}`;
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.youtube.com/',
            'Origin': 'https://www.youtube.com'
        };
        
        const response = await fetch(targetUrl, { headers, timeout: 30000 });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json(data);
        
    } catch (error) {
        console.error('API Request failed:', error.message);
        res.status(500).json({ 
            error: 'Service temporarily unavailable',
            code: 'PROXY_ERROR'
        });
    }
};
