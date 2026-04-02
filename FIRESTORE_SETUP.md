# Firestore Setup Instructions

## Security Rules Deployment

The `firestore.rules` file contains the security rules for GridWorkz LMS. To deploy these rules:

### Using Firebase CLI
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy security rules
firebase deploy --only firestore:rules
```

### Using Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (gridworkz-lms)
3. Navigate to Firestore Database → Rules
4. Replace the contents with the rules from `firestore.rules`
5. Click "Publish"

## Common Issues & Solutions

### Permission Denied Errors
If you see "Missing or insufficient permissions" errors:

1. **Check Security Rules**: Ensure the rules above are deployed
2. **Verify Authentication**: Make sure user is logged in
3. **Check parent_id**: Ensure documents have correct parent_id field

### Students Not Loading
If students show infinite loading:

1. **Check Console**: Look for Firebase errors in browser console
2. **Verify Rules**: Ensure security rules allow read access
3. **Check Auth State**: Verify currentUser.uid is not null

### Magic Link Issues
If magic links don't work:

1. **Check Slug Generation**: Verify slugs are saved correctly
2. **URL Format**: Ensure format is `/student/[slug]`
3. **Case Sensitivity**: Slugs should be lowercase

## Debug Information

The app includes a debug component (development only) that shows:
- Current user ID and email
- Loading state
- Student and submission counts
- Student names and slugs

This appears as a black overlay in the bottom-right corner in development mode.

## Collection Structure

### students
```javascript
{
  name: "Student Name",
  slug: "student-name-abc123",
  access_pin: "1234" || null,
  parent_id: "parent_uid",
  is_active: true,
  created_at: timestamp,
  updated_at: timestamp
}
```

### submissions
```javascript
{
  student_id: "student_uid",
  parent_id: "parent_uid", 
  subject_name: "Math",
  subject_id: "subject_uid",
  timestamp: timestamp,
  summary_text: "What I worked on...",
  block_duration: 30,
  date: "2026-04-01",
  is_locked: true,
  created_at: timestamp
}
```

## Testing Checklist

- [ ] Security rules deployed
- [ ] Users can add students
- [ ] Students appear in dashboard
- [ ] Magic links work correctly
- [ ] Submissions appear in Live Pulse
- [ ] No permission errors in console
