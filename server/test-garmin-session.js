require('dotenv').config();
const { GarminConnect } = require('garmin-connect');

/**
 * Test script to verify extracted Garmin session token works
 *
 * Usage:
 * 1. Extract OAuth tokens from browser (see instructions below)
 * 2. Save them to /tmp/garmin-session/oauth1_token.json and oauth2_token.json
 * 3. Run: node server/test-garmin-session.js
 *
 * To extract tokens from browser:
 * 1. Log into connect.garmin.com with MFA
 * 2. Open DevTools → Application → Local Storage
 * 3. Look for OAuth tokens (they might be in localStorage or cookies)
 * 4. We need both oauth1 and oauth2 tokens
 */

async function testSessionToken() {
  try {
    console.log('Creating Garmin client...');
    const client = new GarminConnect({ username: '', password: '' });

    // Method 1: Try loading from files (if library supports it)
    console.log('\nAttempting to load tokens from /tmp/garmin-session/...');
    try {
      client.loadTokenByFile('/tmp/garmin-session');
      console.log('✓ Tokens loaded from files');
    } catch (err) {
      console.log('✗ Could not load from files:', err.message);

      // Method 2: Try setting tokens directly
      console.log('\nAttempting to set tokens directly...');
      const fs = require('fs');
      const oauth1 = JSON.parse(fs.readFileSync('/tmp/garmin-session/oauth1_token.json', 'utf8'));
      const oauth2 = JSON.parse(fs.readFileSync('/tmp/garmin-session/oauth2_token.json', 'utf8'));

      client.client.oauth1Token = oauth1;
      client.client.oauth2Token = oauth2;
      console.log('✓ Tokens set directly');
    }

    // Test if session works
    console.log('\nTesting session by fetching user profile...');
    const userProfile = await client.getUserProfile();
    console.log('✓ Session works! User:', userProfile.displayName || userProfile.userName);

    // Test fetching activities
    console.log('\nTesting activity fetch...');
    const activities = await client.getActivities(0, 1);
    console.log(`✓ Fetched ${activities.length} activities`);

    if (activities.length > 0) {
      console.log('  Latest activity:', {
        name: activities[0].activityName,
        type: activities[0].activityType?.typeKey,
        date: activities[0].startTimeGMT
      });
    }

    console.log('\n✅ SUCCESS! Session token works!');
    console.log('\nNext step: We can store these OAuth tokens encrypted in the database');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure you extracted the correct OAuth tokens');
    console.log('2. Tokens may have expired - try logging in again and re-extracting');
    console.log('3. Check the token format matches what the library expects');
  }
}

console.log('=== Garmin Session Token Test ===\n');
testSessionToken();
