#!/usr/bin/env node

// Test login API directly
const fetch = require('node-fetch');

async function testLoginAPI() {
    const apiUrl = 'http://localhost:9000';
    
    console.log('🧪 Testing Login API...');
    
    try {
        // Test admin login
        console.log('\n1. Testing admin login...');
        const res = await fetch(`${apiUrl}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@example.com',
                password: 'adminpassword'
            })
        });
        
        const data = await res.json();
        
        console.log('Response status:', res.status);
        console.log('Response data:', data);
        
        if (res.ok) {
            console.log('✅ Admin login successful!');
            console.log('- Token received:', data.token ? '✅' : '❌');
            console.log('- User data:', data.user);
        } else {
            console.log('❌ Admin login failed:', data.message);
        }
        
        // Test registration
        console.log('\n2. Testing user registration...');
        const testEmail = 'testapi_' + Date.now() + '@example.com';
        const testUsername = 'testapi_' + Date.now();
        
        const regRes = await fetch(`${apiUrl}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: testUsername,
                email: testEmail,
                password: 'testpass123'
            })
        });
        
        const regData = await regRes.json();
        
        console.log('Registration status:', regRes.status);
        console.log('Registration data:', regData);
        
        if (regRes.ok) {
            console.log('✅ Registration successful!');
            
            // Test login with new user
            console.log('\n3. Testing new user login...');
            const loginRes = await fetch(`${apiUrl}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: testEmail,
                    password: 'testpass123'
                })
            });
            
            const loginData = await loginRes.json();
            
            console.log('New user login status:', loginRes.status);
            console.log('New user login data:', loginData);
            
            if (loginRes.ok) {
                console.log('✅ New user login successful!');
            } else {
                console.log('❌ New user login failed:', loginData.message);
            }
        } else {
            console.log('❌ Registration failed:', regData.message);
        }
        
    } catch (error) {
        console.log('❌ API Test failed:', error.message);
    }
}

testLoginAPI();