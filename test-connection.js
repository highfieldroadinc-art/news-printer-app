const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🧪 Testing Supabase Connection...\n');

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing environment variables!');
    console.error('Please create a .env file with:');
    console.error('  SUPABASE_URL=your_url_here');
    console.error('  SUPABASE_ANON_KEY=your_key_here');
    process.exit(1);
}

const TABLE_NAME = process.env.SUPABASE_TABLE_NAME || 'news_printer';

console.log('📊 Configuration:');
console.log(`   URL: ${process.env.SUPABASE_URL}`);
console.log(`   Table: ${TABLE_NAME}`);
console.log('');

// Create Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function testConnection() {
    try {
        // Test 1: Check if table exists and is accessible
        console.log('1️⃣ Testing table access...');
        const { data, error, count } = await supabase
            .from(TABLE_NAME)
            .select('*', { count: 'exact' })
            .limit(1);

        if (error) {
            console.error('   ❌ Table access failed:', error.message);
            console.error('   Make sure the table exists and RLS policies allow access');
            return false;
        }
        
        console.log(`   ✅ Table accessible (${count || 0} total records)\n`);

        // Test 2: Test insert capability
        console.log('2️⃣ Testing insert capability...');
        const testContent = `Test bulletin - ${new Date().toISOString()}`;
        
        // Try the stored procedure first (more reliable)
        let { data: insertData, error: insertError } = await supabase
            .rpc('insert_news', {
                content_text: testContent
            });
        
        // If stored procedure doesn't exist, try direct insert
        if (insertError && insertError.message.includes('insert_news')) {
            console.log('   ℹ️ Stored procedure not found, trying direct insert...');
            const result = await supabase
                .from(TABLE_NAME)
                .insert([
                    {
                        Content: testContent,
                        DateTime: new Date().toISOString()
                    }
                ])
                .select();
            insertData = result.data;
            insertError = result.error;
        }

        if (insertError) {
            console.error('   ❌ Insert failed:', insertError.message);
            console.error('   Check your RLS policies for INSERT permissions');
            return false;
        }

        console.log('   ✅ Successfully inserted test record');
        if (insertData) {
            if (insertData.success !== undefined) {
                console.log('   Used stored procedure\n');
            } else if (insertData[0]?.id) {
                console.log(`   Record ID: ${insertData[0].id}\n`);
            }
        }

        // Test 3: Test real-time subscription
        console.log('3️⃣ Testing real-time subscription...');
        
        const channel = supabase
            .channel('test-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: TABLE_NAME
                },
                (payload) => {
                    console.log('   ✅ Real-time event received!');
                    console.log(`   New record: ${payload.new.Content}`);
                    
                    // Clean up and exit
                    supabase.removeChannel(channel);
                    console.log('\n🎉 All tests passed! Your setup is working correctly.');
                    process.exit(0);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('   ✅ Subscribed to real-time updates');
                    
                    // Insert a test record to trigger the subscription
                    setTimeout(async () => {
                        console.log('   📤 Sending test real-time message...');
                        await supabase
                            .from(TABLE_NAME)
                            .insert([
                                {
                                    Content: 'Real-time test message!',
                                    DateTime: new Date().toISOString()
                                }
                            ]);
                    }, 1000);
                }
            });

        // Timeout after 10 seconds
        setTimeout(() => {
            console.log('\n⏱️ Test timeout - Real-time might not be configured');
            console.log('Run this SQL in Supabase to enable real-time:');
            console.log(`ALTER PUBLICATION supabase_realtime ADD TABLE ${TABLE_NAME};`);
            supabase.removeChannel(channel);
            process.exit(1);
        }, 10000);

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        return false;
    }
}

// Run the test
testConnection();