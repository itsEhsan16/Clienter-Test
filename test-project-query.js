#!/usr/bin/env node

/**
 * Test script to check projects data
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? 'Set' : 'Missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function testQuery() {
  console.log('\n🔍 Testing Project Query...\n')

  const projectId = 'b86ed17a-69b2-430f-b1de-bc0180844e2d'

  try {
    // Test 1: Get project without relations
    console.log('Test 1: Fetch project without relations')
    const { data: projectOnly, error: error1 } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error1) {
      console.error('❌ Error:', error1)
    } else {
      console.log('✅ Success')
      console.log('Project data:', JSON.stringify(projectOnly, null, 2))
    }

    // Test 2: Check if project_team_members table exists
    console.log('\nTest 2: Check project_team_members table')
    const { data: teamMembers, error: error2 } = await supabase
      .from('project_team_members')
      .select('*')
      .limit(1)

    if (error2) {
      console.error('❌ Error:', error2)
      console.log('Table might not exist or have no data')
    } else {
      console.log('✅ Table exists')
      if (teamMembers && teamMembers.length > 0) {
        console.log('Sample columns:', Object.keys(teamMembers[0]))
      } else {
        console.log('No data in table')
      }
    }

    // Test 3: Get project with client relation
    console.log('\nTest 3: Fetch project with client')
    const { data: projectWithClient, error: error3 } = await supabase
      .from('projects')
      .select(
        `
        *,
        clients (
          id,
          name,
          phone
        )
      `
      )
      .eq('id', projectId)
      .single()

    if (error3) {
      console.error('❌ Error:', error3)
    } else {
      console.log('✅ Success')
      console.log('Has client data:', projectWithClient.clients ? 'Yes' : 'No')
    }

    // Test 4: Try with team members
    console.log('\nTest 4: Fetch project with team members')
    const { data: projectWithTeam, error: error4 } = await supabase
      .from('projects')
      .select(
        `
        *,
        project_team_members (*)
      `
      )
      .eq('id', projectId)
      .single()

    if (error4) {
      console.error('❌ Error:', error4)
    } else {
      console.log('✅ Success')
      console.log('Team members count:', projectWithTeam.project_team_members?.length || 0)
    }
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

testQuery()
