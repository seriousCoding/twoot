# Twoot App Fix Plan

## Critical Issues Identified

### 1. **PORT CONFIGURATION MISMATCH**
- **Issue**: Frontend hardcoded fallback port `5055` doesn't match backend port `9000`
- **Files**: `Chat.tsx`, `Draw.tsx`, `Video.tsx`, `CodeSeek.tsx`
- **Fix**: Update hardcoded fallback ports to match `.env` configuration

### 2. **API ENDPOINT MISMATCH**
- **Issue**: Login/Register use relative paths but need API base URL
- **Files**: `Login.tsx`, `Register.tsx`
- **Fix**: Add proper API base URL configuration

### 3. **MISSING AUTHENTICATION IMPORT**
- **Issue**: `useAuth` import missing from `App.tsx` in Login component
- **Files**: `Login.tsx` (line 4)
- **Fix**: Import hook is actually exported from App.tsx - this is correct

### 4. **BACKEND ROUTE ORDERING**
- **Issue**: Error handler defined before routes in `app.js`
- **Files**: `backend/app.js`
- **Fix**: Move error handler after route definitions

### 5. **MISSING DEFAULT PORT FALLBACK**
- **Issue**: Backend won't start without PORT environment variable
- **Files**: `backend/bin/www`
- **Fix**: Add default port fallback

### 6. **SOCKET.IO CONNECTION ISSUES**
- **Issue**: Socket.io connections may fail due to port mismatches
- **Files**: All pages using socket.io
- **Fix**: Ensure consistent port usage

### 7. **MISSING PROXY CONFIGURATION**
- **Issue**: Frontend needs proxy for API calls in development
- **Files**: `frontend/package.json`
- **Fix**: Add proxy configuration

### 8. **SECURITY VULNERABILITIES**
- **Issue**: Backend has 7 npm vulnerabilities (3 low, 4 high)
- **Fix**: Run `npm audit fix` and update dependencies

## Implementation Plan

### Phase 1: Port Configuration Fix
1. Fix hardcoded port fallbacks in frontend components
2. Add proxy configuration to frontend package.json
3. Update API base URL handling

### Phase 2: Backend Route Structure
1. Fix route ordering in app.js
2. Add default port fallback
3. Improve error handling

### Phase 3: Database Setup
1. Run migrations to ensure database is properly set up
2. Test database connection
3. Run seed script for admin user

### Phase 4: Testing & Validation
1. Test authentication flow
2. Test socket.io connections
3. Test all features (chat, draw, video, games)

### Phase 5: Security & Dependencies
1. Fix npm vulnerabilities
2. Add input validation
3. Improve security headers

## Detailed Fixes

### Fix 1: Frontend Port Configuration
```typescript
// In Chat.tsx, Draw.tsx, Video.tsx, CodeSeek.tsx
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:9000'; // Changed from 5055 to 9000
```

### Fix 2: Frontend API Configuration
```typescript
// In Login.tsx and Register.tsx
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:9000';
// Then use: `${apiUrl}/users/login` instead of '/users/login'
```

### Fix 3: Frontend Proxy Configuration
```json
// In frontend/package.json
{
  "proxy": "http://localhost:9000"
}
```

### Fix 4: Backend Route Ordering
```javascript
// In backend/app.js - move routes before error handler
app.use('/', indexRouter);
app.use('/users', usersRouter);

// Error handler should be AFTER routes
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});
```

### Fix 5: Backend Default Port
```javascript
// In backend/bin/www
var port = normalizePort(process.env.PORT || '9000'); // Add default port
```

### Fix 6: Database Setup
```bash
# Run these commands to ensure database is working
cd backend
npm run migrate  # If migration script exists
npm run seed     # Seed admin user
```

## Testing Checklist

After implementing fixes:

- [ ] Backend starts without errors on port 9000
- [ ] Frontend starts without errors on port 3000
- [ ] Registration works correctly
- [ ] Login works correctly
- [ ] Dashboard loads after login
- [ ] Socket.io connections work for:
  - [ ] Chat functionality
  - [ ] Drawing functionality
  - [ ] Video functionality
  - [ ] Games functionality
- [ ] All features accessible from dashboard
- [ ] Logout functionality works
- [ ] Protected routes work correctly

## Commands to Run After Fixes

```bash
# Test backend
cd backend
npm start

# Test frontend (in another terminal)
cd frontend
npm start

# Test full app (in another terminal)
cd ..  # Root directory
npm run dev
```

## Priority Order
1. **HIGH**: Fix port configurations (breaks basic functionality)
2. **HIGH**: Fix API endpoint configurations (breaks auth)
3. **HIGH**: Fix backend route ordering (breaks error handling)
4. **MEDIUM**: Add proxy configuration (improves dev experience)
5. **MEDIUM**: Fix security vulnerabilities (security)
6. **LOW**: Add additional validation and error handling