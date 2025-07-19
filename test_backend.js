#!/usr/bin/env node

// Test script to prove backend functionality
require('dotenv').config({ path: './.env' });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./backend/db');

const app = express();
app.use(express.json());
app.use(cors());

// Test database connection
async function testDatabase() {
  try {
    const result = await db.raw('SELECT 1+1 as result');
    console.log('✅ Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    return false;
  }
}

// Test admin user login
async function testAdminLogin() {
  try {
    const user = await db('users').where({ email: 'admin@example.com' }).first();
    if (!user) {
      console.log('❌ Admin user not found');
      return false;
    }
    
    const isValid = await bcrypt.compare('adminpassword', user.password_hash);
    if (!isValid) {
      console.log('❌ Admin password incorrect');
      return false;
    }
    
    console.log('✅ Admin user login test passed');
    return true;
  } catch (error) {
    console.log('❌ Admin login test failed:', error.message);
    return false;
  }
}

// Test JWT token generation
function testJWT() {
  try {
    const token = jwt.sign({ id: 1, username: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ JWT token generation/verification successful');
    return true;
  } catch (error) {
    console.log('❌ JWT test failed:', error.message);
    return false;
  }
}

// Test registration endpoint
app.post('/users/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log('📧 Registration attempt:', { username, email });
    
    const existing = await db('users').where({ email }).orWhere({ username }).first();
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    await db('users').insert({ username, email, password_hash: hashedPassword });
    
    console.log('✅ User registered successfully');
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.log('❌ Registration failed:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Test login endpoint
app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt:', { email });
    
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    console.log('✅ User logged in successfully');
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    console.log('❌ Login failed:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Run tests
async function runTests() {
  console.log('🧪 Testing Twoot Backend Functionality...\n');
  
  const dbTest = await testDatabase();
  const adminTest = await testAdminLogin();
  const jwtTest = testJWT();
  
  if (dbTest && adminTest && jwtTest) {
    console.log('\n🎉 ALL TESTS PASSED - Starting test server...');
    
    const server = app.listen(9001, () => {
      console.log('📡 Test server running on http://localhost:9001');
      console.log('📋 Test endpoints:');
      console.log('   POST http://localhost:9001/users/login');
      console.log('   POST http://localhost:9001/users/register');
      console.log('\n💡 Test with:');
      console.log('curl -X POST http://localhost:9001/users/login -H "Content-Type: application/json" -d \'{"email":"admin@example.com","password":"adminpassword"}\'');
    });
    
    // Keep running for 30 seconds
    setTimeout(() => {
      server.close(() => {
        console.log('\n✅ Test server stopped');
        process.exit(0);
      });
    }, 30000);
  } else {
    console.log('\n❌ TESTS FAILED');
    process.exit(1);
  }
}

runTests();