const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function applyMigration(filename, sql) {
  console.log(`\n📦 Applying: ${filename}`)
  console.log('━'.repeat(60))

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql })

    if (error) {
      throw error
    }

    console.log('✅ Migration applied successfully!')
    return true
  } catch (err) {
    console.error(`❌ Error: ${err.message}`)
    return false
  }
}

async function runMigrations() {
  console.log('\n🚀 Starting Database Migrations\n')

  const migrations = [
    '20260106_add_missing_expense_columns.sql',
    '20260106_fix_projects_rls_recursion.sql',
  ]

  let allSuccess = true

  for (const migrationFile of migrations) {
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', migrationFile)

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationFile}`)
      allSuccess = false
      continue
    }

    const sql = fs.readFileSync(migrationPath, 'utf8')
    const success = await applyMigration(migrationFile, sql)

    if (!success) {
      allSuccess = false
    }
  }

  console.log('\n' + '━'.repeat(60))
  if (allSuccess) {
    console.log('✅ All migrations completed successfully!')
    console.log('\n🎉 You can now refresh your browser at http://localhost:3000/expenses')
  } else {
    console.log('\n⚠️  Some migrations failed.')
    console.log('\n📋 Manual Application Required:')
    console.log('Go to: https://supabase.com/dashboard/project/zviakkdqtmhqfkxjjqvn/sql/new')
    console.log('\nApply the migrations from these files:')
    migrations.forEach((m) => console.log(`  - supabase/migrations/${m}`))
  }
  console.log('━'.repeat(60) + '\n')
}

runMigrations().catch((err) => {
  console.error('\n❌ Fatal error:', err)
  console.log('\n📋 Please apply migrations manually in Supabase SQL Editor:')
  console.log('https://supabase.com/dashboard/project/zviakkdqtmhqfkxjjqvn/sql/new')
  process.exit(1)
})
