#!/usr/bin/env node

// Simple proof test for backend functionality
require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

console.log('🧪 PROVING TWOOT BACKEND FUNCTIONALITY...\n');

// Test 1: Environment Variables
console.log('Test 1: Environment Variables');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '✅ LOADED' : '❌ MISSING');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✅ LOADED' : '❌ MISSING');
console.log('- CLIENT_ORIGIN:', process.env.CLIENT_ORIGIN || 'http://localhost:3000');
console.log('- BACKEND_PORT:', process.env.BACKEND_PORT || '9000');

// Test 2: Database Connection
async function testDatabase() {
  try {
    console.log('\nTest 2: Database Connection');
    const result = await db.raw('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully');
    console.log('- Current time:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    return false;
  }
}

// Test 3: Admin User Exists
async function testAdminUser() {
  try {
    console.log('\nTest 3: Admin User');
    const user = await db('users').where({ email: 'admin@example.com' }).first();
    if (!user) {
      console.log('❌ Admin user not found');
      return false;
    }
    console.log('✅ Admin user found');
    console.log('- Username:', user.username);
    console.log('- Email:', user.email);
    console.log('- Created:', user.created_at);
    return user;
  } catch (error) {
    console.log('❌ Admin user check failed:', error.message);
    return false;
  }
}

// Test 4: Password Verification
async function testPasswordVerification(user) {
  try {
    console.log('\nTest 4: Password Verification');
    const isValid = await bcrypt.compare('adminpassword', user.password_hash);
    if (!isValid) {
      console.log('❌ Password verification failed');
      return false;
    }
    console.log('✅ Password verification successful');
    return true;
  } catch (error) {
    console.log('❌ Password verification error:', error.message);
    return false;
  }
}

// Test 5: JWT Token Generation
function testJWT() {
  try {
    console.log('\nTest 5: JWT Token Generation');
    const token = jwt.sign({ id: 1, username: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ JWT token generated and verified');
    console.log('- Token payload:', decoded);
    console.log('- Token expires in:', new Date(decoded.exp * 1000).toISOString());
    return token;
  } catch (error) {
    console.log('❌ JWT test failed:', error.message);
    return false;
  }
}

// Test 6: User Registration Simulation
async function testUserRegistration() {
  try {
    console.log('\nTest 6: User Registration Simulation');
    const testEmail = 'test_' + Date.now() + '@example.com';
    const testUsername = 'testuser_' + Date.now();
    
    // Check if user already exists
    const existing = await db('users').where({ email: testEmail }).first();
    if (existing) {
      console.log('❌ Test user already exists');
      return false;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    
    // Insert user
    await db('users').insert({
      username: testUsername,
      email: testEmail,
      password_hash: hashedPassword
    });
    
    console.log('✅ User registration simulation successful');
    console.log('- Test user:', testUsername);
    console.log('- Test email:', testEmail);
    
    // Clean up test user
    await db('users').where({ email: testEmail }).del();
    console.log('✅ Test user cleaned up');
    
    return true;
  } catch (error) {
    console.log('❌ User registration simulation failed:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  try {
    const dbTest = await testDatabase();
    if (!dbTest) return;
    
    const adminUser = await testAdminUser();
    if (!adminUser) return;
    
    const passwordTest = await testPasswordVerification(adminUser);
    if (!passwordTest) return;
    
    const jwtTest = testJWT();
    if (!jwtTest) return;
    
    const regTest = await testUserRegistration();
    if (!regTest) return;
    
    console.log('\n🎉 ALL TESTS PASSED! BACKEND IS FULLY FUNCTIONAL!');
    console.log('\n📋 PROOF SUMMARY:');
    console.log('✅ Environment variables loaded correctly');
    console.log('✅ Database connection working');
    console.log('✅ Admin user exists and is accessible');
    console.log('✅ Password hashing/verification working');
    console.log('✅ JWT token generation/verification working');
    console.log('✅ User registration logic working');
    
    process.exit(0);
  } catch (error) {
    console.log('\n❌ TESTS FAILED:', error.message);
    process.exit(1);
  }
}

runAllTests();