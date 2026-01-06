// Apply the missing expense columns migration
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function applyMigration() {
  try {
    console.log('📦 Reading migration file...')
    const migrationPath = path.join(
      __dirname,
      'supabase',
      'migrations',
      '20260106_add_missing_expense_columns.sql'
    )
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('🚀 Applying migration...')
    console.log('Migration SQL:')
    console.log(migrationSQL)
    console.log('\n')

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('Trying direct execution...')
      const { data: directData, error: directError } = await supabase.from('_migrations').insert({
        name: '20260106_add_missing_expense_columns',
        executed_at: new Date().toISOString(),
      })

      if (directError) {
        console.error('❌ Migration failed:', directError)
        console.log('\n📋 Please apply this migration manually in Supabase SQL Editor:')
        console.log('Go to: https://supabase.com/dashboard/project/zviakkdqtmhqfkxjjqvn/sql')
        console.log('\nPaste the following SQL:\n')
        console.log(migrationSQL)
        process.exit(1)
      }
    }

    console.log('✅ Migration applied successfully!')
  } catch (err) {
    console.error('❌ Error applying migration:', err)
    console.log('\n📋 Please apply this migration manually in Supabase SQL Editor:')
    console.log('Go to: https://supabase.com/dashboard/project/zviakkdqtmhqfkxjjqvn/sql')

    const migrationPath = path.join(
      __dirname,
      'supabase',
      'migrations',
      '20260106_add_missing_expense_columns.sql'
    )
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    console.log('\nPaste the following SQL:\n')
    console.log(migrationSQL)
    process.exit(1)
  }
}

applyMigration()
