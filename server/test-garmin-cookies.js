require('dotenv').config();
const { GarminConnect } = require('garmin-connect');

/**
 * Test if we can authenticate with just session cookies
 *
 * The cookies you found:
 * - GARMIN-SSO = 1
 * - GARMIN-SSO-CUST-GUID = c6539bc3-85a7-4bf9-af95-19a655479dfc
 */

async function testWithCookies() {
  try {
    console.log('=== Testing with Session Cookies ===\n');

    // Create a client
    const client = new GarminConnect({ username: '', password: '' });

    // Try to manually set the session
    // The garmin-connect library internally uses these cookies
    console.log('Checking client internals...');
    console.log('Client properties:', Object.keys(client));
    console.log('HTTP Client properties:', Object.keys(client.client));

    // Check if we can access the axios instance or cookie jar
    if (client.client.jar) {
      console.log('\nFound cookie jar, attempting to set cookies...');
      // This is a long shot - we might be able to inject cookies
    }

    console.log('\n⚠️  Issue: The garmin-connect library expects OAuth tokens, not just session cookies');
    console.log('\nAlternative approach needed...');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

console.log('Cookie values found:');
console.log('GARMIN-SSO: 1');
console.log('GARMIN-SSO-CUST-GUID: c6539bc3-85a7-4bf9-af95-19a655479dfc\n');

testWithCookies();

console.log('\n=== Next Steps ===');
console.log('To find the OAuth tokens:');
console.log('1. Keep DevTools open with Network tab');
console.log('2. Refresh the Garmin Connect page');
console.log('3. Look for API requests (filter by XHR/Fetch)');
console.log('4. Check request headers for "Authorization" header');
console.log('5. Or check the response of the initial login/auth requests');
console.log('\nAlternatively:');
console.log('- Check Console tab for any window.oauth or similar variables');
console.log('- Look in Application → Local Storage for token keys');
console.log('- Check Session Storage as well');
