const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const TABLE_NAME = process.env.SUPABASE_TABLE_NAME || 'news_printer';

// CORS headers for browser requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).json({});
    }

    const { url, method, body } = req;
    const path = url.replace(/\?.*$/, '');

    // Set CORS headers for all responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    try {
        // Route: GET /api/config
        if (path === '/api/config' && method === 'GET') {
            return res.status(200).json({
                supabaseUrl: process.env.SUPABASE_URL,
                supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
                tableName: TABLE_NAME
            });
        }

        // Route: GET /api/news
        if (path === '/api/news' && method === 'GET') {
            const limit = parseInt(req.query.limit) || 20;
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return res.status(200).json({ success: true, data });
        }

        // Route: POST /api/news
        if (path === '/api/news' && method === 'POST') {
            const { headline, content } = body;
            
            if (!content) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Content is required' 
                });
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
            return res.status(200).json({ success: true, data });
        }

        // Route: GET /api/health
        if (path === '/api/health' && method === 'GET') {
            const { error } = await supabase
                .from(TABLE_NAME)
                .select('count')
                .limit(1);

            if (error) throw error;
            
            return res.status(200).json({ 
                status: 'healthy', 
                database: 'connected',
                table: TABLE_NAME,
                timestamp: new Date().toISOString()
            });
        }

        // 404 for unknown routes
        return res.status(404).json({ 
            error: 'Not found',
            path: path,
            method: method
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};