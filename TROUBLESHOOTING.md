# Student Persistence Troubleshooting

## Issue: Students Don't Persist After Refresh

### Quick Diagnosis Steps

1. **Open Browser Console** (F12) and look for:
   - Red error messages
   - "Firebase Error: Missing or insufficient permissions"
   - "Firebase test failed" messages

2. **Check Debug Panel** (bottom-right corner in development):
   - Current User UID should not be null
   - Students Count should update after adding
   - Loading should become false

3. **Test Firebase Connection**:
   - Click the red "Test Firebase" button (development only)
   - Check console for connection test results

### Common Issues & Solutions

#### 1. Environment Variables Missing
**Symptoms**: "VITE_FIREBASE_* Missing" in console
**Solution**: 
```bash
# Check .env.local exists and contains:
cat .env.local
# Should show VITE_FIREBASE_API_KEY=... etc.
```

#### 2. Firestore Security Rules Not Deployed
**Symptoms**: "permission-denied" errors
**Solution**:
```bash
firebase deploy --only firestore:rules
```
Or deploy manually via Firebase Console → Firestore → Rules

#### 3. Firebase Project Not Initialized
**Symptoms**: "Firebase test failed" or "unavailable" errors
**Solution**:
- Verify project ID matches Firebase Console
- Check internet connection
- Ensure Firebase is enabled in project

#### 4. Auth State Issues
**Symptoms**: Current User UID is null
**Solution**:
- Sign out and sign back in
- Clear browser cache/cookies
- Check Firebase Auth is enabled

### Debug Information Explained

The debug panel shows:
- **Current User**: Firebase Auth UID (should not be null)
- **Email**: Logged-in user email
- **Loading**: Should be false after initial load
- **Students Count**: Number of students fetched
- **Students List**: Names and slugs of all students

### Manual Testing Steps

1. **Add Student**:
   - Open modal → Enter name → Submit
   - Check console for "=== STUDENT CREATION DEBUG ==="
   - Verify "Student added successfully" message
   - Check "Verification - document exists: true"

2. **Check Persistence**:
   - Refresh page (F5)
   - Students should appear without loading spinner
   - Debug panel should show same student count

3. **Test Magic Link**:
   - Click "Copy Magic Link"
   - Paste in new tab: `http://localhost:3000/student/[slug]`
   - Should load student portal

### Console Output Analysis

**Good Output**:
```
Environment check:
VITE_FIREBASE_API_KEY: ✓ Set
VITE_FIREBASE_PROJECT_ID: ✓ Set
VITE_FIREBASE_AUTH_DOMAIN: ✓ Set

App initialized: [Object]
Firestore initialized: [Object]
Test document written: abc123...

=== STUDENT CREATION DEBUG ===
Current user: [Object]
User UID: xyz789...
Student added successfully with ID: abc123
Verification - document exists: true
```

**Bad Output**:
```
VITE_FIREBASE_API_KEY: ✗ Missing
Firebase test failed: permission-denied
=== STUDENT CREATION ERROR ===
Error adding student: permission-denied
```

### Next Steps If Issues Persist

1. **Deploy Security Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Verify Environment**:
   ```bash
   # Restart dev server to pick up .env.local changes
   npm run dev
   ```

3. **Check Firebase Console**:
   - Go to Firestore → Data
   - Look for "students" collection
   - Verify documents appear when added

4. **Reset Auth State**:
   ```javascript
   // In browser console
   localStorage.clear();
   location.reload();
   ```
