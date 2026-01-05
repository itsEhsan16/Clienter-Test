// Quick test to verify Supabase Admin API connection
const { readFileSync } = require('fs')
const { createClient } = require('@supabase/supabase-js')

// Manually load .env.local
try {
  const envFile = readFileSync('.env.local', 'utf8')
  envFile.split('\n').forEach((line) => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
    }
  })
} catch (err) {
  console.log('Could not load .env.local file')
}

async function testAdminConnection() {
  console.log('🔍 Testing Supabase Admin API Connection...\n')

  // Check environment variables
  console.log('Environment Variables:')
  console.log(
    '✓ NEXT_PUBLIC_SUPABASE_URL:',
    process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing'
  )
  console.log(
    '✓ SUPABASE_SERVICE_ROLE_KEY:',
    process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'
  )
  console.log()

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set!')
    return
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    console.log('Testing Admin API...')

    // Try to list users (this requires service role key)
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      console.error('This might mean your SERVICE_ROLE_KEY is invalid or expired.')
      return
    }

    console.log(`✅ Successfully connected! Found ${users.users.length} users in the system.`)
    console.log()

    // Test creating a test user
    console.log('Testing user creation with a test email...')
    const testEmail = `test-${Date.now()}@example.com`

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: 'test123456',
      email_confirm: true,
    })

    if (createError) {
      console.error('❌ Error creating test user:', createError.message)
      console.error('Full error:', createError)

      if (createError.message.includes('Database error')) {
        console.error('\n⚠️  This is a DATABASE ERROR. Possible causes:')
        console.error('   1. Your Supabase project might not be fully initialized')
        console.error('   2. Auth schema might not be properly set up')
        console.error('   3. Database might be paused (check Supabase dashboard)')
        console.error('   4. Your project might have reached user limits')
        console.error('\n💡 Try:')
        console.error('   - Visit your Supabase dashboard')
        console.error('   - Check if the project is active (not paused)')
        console.error('   - Go to Authentication → Users to see if you can create users there')
      }
      return
    }

    console.log('✅ Test user created successfully!')
    console.log('User ID:', newUser.user.id)

    // Clean up test user
    console.log('Cleaning up test user...')
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
    console.log('✅ Test user deleted.')

    console.log('\n✅ All tests passed! Your Supabase Admin API is working correctly.')
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    console.error(error)
  }
}

testAdminConnection()
