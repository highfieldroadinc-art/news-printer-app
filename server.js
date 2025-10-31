const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing required environment variables!');
    console.error('Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your .env file');
    process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Table name from env or default
const TABLE_NAME = process.env.SUPABASE_TABLE_NAME || 'news_printer';

// Middleware
app.use(express.static('public'));
app.use(express.json());

// API endpoint to get Supabase configuration (secured)
app.get('/api/config', (req, res) => {
    // Only send necessary public configuration
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
        tableName: TABLE_NAME
    });
});

// API endpoint to fetch recent news
app.get('/api/news', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to add news (optional - for testing)
app.post('/api/news', async (req, res) => {
    try {
        const { headline, content } = req.body;
        if (!content) {
            return res.status(400).json({ success: false, error: 'Content is required' });
        }

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .insert([
                { 
                    Headline: headline || 'News Update',
                    Content: content, 
                    DateTime: new Date().toISOString() 
                }
            ])
            .select();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error adding news:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Test database connection
        const { error } = await supabase
            .from(TABLE_NAME)
            .select('count')
            .limit(1);

        if (error) throw error;
        
        res.json({ 
            status: 'healthy', 
            database: 'connected',
            table: TABLE_NAME,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy', 
            database: 'disconnected',
            error: error.message 
        });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, HOST, () => {
    console.log('🚀 News Printer Server Started');
    console.log(`📡 Server: http://${HOST}:${PORT}`);
    console.log(`📊 Supabase URL: ${process.env.SUPABASE_URL}`);
    console.log(`📰 Table: ${TABLE_NAME}`);
    console.log('✅ Real-time updates enabled');
    console.log('');
    console.log('🔍 Available endpoints:');
    console.log(`   GET  /              - News Printer UI`);
    console.log(`   GET  /api/config    - Get configuration`);
    console.log(`   GET  /api/news      - Fetch recent news`);
    console.log(`   POST /api/news      - Add news item`);
    console.log(`   GET  /api/health    - Health check`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    app.close(() => {
        console.log('HTTP server closed');
    });
});