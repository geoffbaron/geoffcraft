const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;

if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } 
    catch (e) { console.error("Could not create DATA_DIR", e); }
}

const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.json': 'application/json',
};

if (!fs.existsSync(LEADERBOARD_FILE)) {
    try { fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify([])); } 
    catch (e) { console.error("Init write failed. Read-only filesystem?", e); }
}

const server = http.createServer((req, res) => {
    // Railway Cloud proxy protections
    let reqPath = req.url.split('?')[0];
    if (reqPath !== '/') reqPath = reqPath.replace(/\/$/, "");

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // API: Get Leaderboard
    if (req.method === 'GET' && reqPath === '/leaderboard') {
        try {
            const data = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(data);
        } catch (e) {
            console.error(e);
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end("[]");
        }
        return;
    }

    // API: Submit Score
    if (req.method === 'POST' && reqPath === '/score') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { name, score } = JSON.parse(body);
                if (typeof name !== 'string' || typeof score !== 'number') throw new Error('Invalid data');
                
                let scores = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf-8'));
                // Append and sort
                scores.push({ name: name.substring(0, 20), score });
                scores.sort((a, b) => b.score - a.score);
                scores = scores.slice(0, 100); // Top 100
                
                fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(scores));
                
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify(scores));
            } catch (e) {
                console.error("Score Save Error:", e);
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: e.toString() }));
            }
        });
        return;
    }

    // Static Asset Serving
    let filePath = reqPath === '/' ? '/index.html' : reqPath;
    filePath = path.join(__dirname, filePath);
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`EasterCraft Easter Egg Hunt Server running at http://localhost:${PORT}/`);
});
