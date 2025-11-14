require('dotenv').config();
const { GarminConnect } = require('garmin-connect');
const axios = require('axios');

/**
 * Test using the JWT and session cookies we extracted
 */

const cookies = {
  'GARMIN-SSO': '1',
  'GARMIN-SSO-CUST-GUID': 'c6539bc3-85a7-4bf9-af95-19a655479dfc',
  'SESSIONID': 'YmY1NWMzOTEtZjlkZC00ZmE2LWFlYzctMGFhMGZlM2U5MTg2',
  'JWT_WEB': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjMxNDI3NDcsImlzcyI6ImF1dGgwIiwicm9sZXMiOlsiNCIsIjciLCI4IiwiOSIsIjExIiwiMjgiXX0.7umgCqL04zMnMZ1XM1MwUTYxm8hKePhCdbC7yBj5BTY',
  'session': 'Fe26.2*1*76caf17649b5e3a4455439eda5ee7c40162d3784d490b149f5d0eb7fdd3d71cb*mVBCrcFNBW-zdDSDPF4UhA*EnnBaynf5CEadRXJVEUYH_9xZ0u7SenQVadZbmPvP3A7kRGrR9l0lhohPbX_lGpufqd8fG6139ijZH8NaWS5ou7d2PUppFYefq00HakKjS3XaUQZRMlBcdFghQUQTRA97VlbcsbSE2YBSh6MUnakuGg6xIaNrIFzWl8huUm2OVepuaKVQ0DP-of8WJUSmBTPgZIQ_xesaHDKTCtIUY6V50Ae_JBPQKcjU9VTFtu6CZJR9XQ9-tyI7dH-kvPYQdpJeyrpWcIWOEJ3kN-tMGS0N0dQbmKPB0Q9XhFSBY1RyE72Mn6h-jCdD-Mw25K-tABoq47CUfAIYG3A3fGoeHpWvhtcWTBk6G4SiLT9AIS3dSNhSUnIdCcI_S3IDfu_WVuMYYZupalNdwsQlN6BqRwtvOHQ6LbRr2WNjeLQGnJHQS7SKGF6FZqWNuWhkdxbvpHUzlebxDl365Y5pH9NOJSZvLXidNH0Rkvaoxj5rtdqZbn_G03ouA2Haon34J1NvJEN-yP6KWaYALfs65KUe_wvTZA3gqH3krbaLbSPvwwnBN96WyjWwqemyclrPRh5SXUlEy_XUKKQP3S2RHO3znD_5W0I5irZWIH5XwKIPE8n7b6QJ-OXnP0767ofIC6OSjm4e4j1hR0SFoTbHSkgTLpQB7fbPf7L2oPw3lcUI1oIV4eH0pmK-IRJUEPxWsmdxsGhv4ajOchK3grWsQg9fFAXv4BA7Q1Ybk9O002R4JccF3XOdhYoXUgn--oqcTbqpzSJN8e7fxRQi0B22mSJSEfCOg_n0eTtK6tI6zifAGnfT9QHzrRYjXGmkZXELdn0CZMa3suZsIq8nVqQxKR2I9G6W72o3oYBLbTbTNPCkQKFay4t95lRcdmE3hBOOkwMzdoHxGOC4cL-XNPfthFQ97eXPCQC5RT9Qh3IC5eRiaZ9YYoaQZ7EFe-MWpMoUC5iUWJ4NyBES2lUBHZnEdbdQ-NDE9m-Lw2FEkUF2LuYiJ0agrK3RyAS0Q7Lv_U_Bv_6m-NTk4ZJojEYWsqlX4owImGb9NHa2ECtT5x31gKng-ybcU5cGXdEoLW-MK9KtgqNLvIBki0oB5phxNbCu9ZE9JgoaoD-au52k_MdYDcNp13_mcfz6lHijrenajLDlZAOPgShjhxuyxuKlhe2sKVeE5KU5HPVJmnkBNIh54u07J-HACkDCEPwfsTK2c855bdl7ySKc6hGLsaFDwlCYTWFJTGO0slf1uOvmWlTYjdKl8lL3oH1xKvcVcTx9thMFma7n4kDBc_OTvhTf86AZpPbjM5Sj20RY7NMGfex9iJtnx8uVC44F2F5D7yKC1iAvW7OEM0iujQR0hoW8B3DJ6ZgGg3iLJzCTdFUdOTxkw3D9qM0gO1aumVpAqDtppVyDu5ipS3fTryFaTD0ZIDaRHxsaHUDrq2PvbYKzj3OTSBELMxoa7eQxpn-ItiJmeQWU72cQAq5bf9S_Eiwz7qJ3JJI-92rcgn_CFb_W7VD7yMYAR6A4ncLtVAuu0Bhg9iAXpAiFHXLwsN9ZgBXeVU3rjb49ix3hFxkK8htLz232dsdGmdu32rsQY7w-LdWHIa5frt_rwIDYAL1uyvEV6V38IwkMQnc3hqc4dsCZBqdPFjbI2FGbABsewMPqgTjRfe7z5rajwLqW1_mMqVOXQnwYXdKRKd9ncBawAz2ZnPYlqKyR1CBszAyWYmAM4s0RNYHv-FJF3ZJh7K35Gs54JMxBFqw-HYzk-aLr0gCe2L7PEYDwrWDWC7AxWWqlaN7wqhbDoEqZkD_VWc02BCEiycHluH010cL0t5yOFbZmKgAJK-J-5WwNnXRTdAr2K527yedIiKcuXGhnzGCYecxeAvuQvFoic51SM2NZHZIC-jh_6Sd4xEMsnPjj40drGW9SqNEnWdDYI3p8a5qlZy00IHOPN85K1omAjKEK6DUs6CGnD_3u9HWz-E4Qxrga9tqVP-FMTgOiUsuXnFk-Ngmz_i-2T-CaTz9L8xu682WDz9mt_emCHo6QFI_bkJhl73lLsMlAodunlGVbPpmfjTHgPokHmJBmvwOFID5YA0hzKvQ74ot36qkYVdokrgDLwrIrknwbSqJ6oJ4nwYA_6-TqU3indGhvum3mRxoe3A0b-0G52CO_KGI6F2QotScPd0DgYFzBI1kQG3AcXHbMeZUQJJMt79Tb_KtS_R3mCVny9FgitqB1yxBsH48XrkcARQ6WnuqSTZ4tUZ4Ym7SZRUOm2AbSt4cuQh3Bk3Jo9lYujyK5SGd8LFuquQsKRkBvyCQRU-NitptpiMgo_ybCcXC7JIrqiYkQfzTL-Q8-yBwbkrxvUXYm2wMny9LXqqL1UE1gOWjp3q1OPUmAm9hR1Laa2qmSc8YqeA8T_Oh9q03nWfKWGFOIjOOmSAya91c_iZeF1LRMVgNJFq4*1770334548372*31e72673106384e42bc8a5a4ff23077d9446451de571b369b8bf778c84c09ba3*Nim4JSpMNCc4vaXDeQm_5x4Q8oTRpSuspOe4GDrG2Og~2'
};

async function testDirectAPI() {
  console.log('=== Testing Direct Garmin API with Cookies ===\n');

  // Build cookie string
  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');

  try {
    // Test fetching activities directly
    console.log('Attempting to fetch activities from Garmin API...');
    const response = await axios.get(
      'https://connect.garmin.com/activitylist-service/activities/search/activities',
      {
        params: {
          start: 0,
          limit: 1
        },
        headers: {
          'Cookie': cookieString,
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
          'NK': 'NT' // Garmin requires this header
        }
      }
    );

    console.log('✅ SUCCESS! Direct API call worked!');
    console.log(`Fetched ${response.data.length} activities`);
    if (response.data.length > 0) {
      console.log('Latest activity:', {
        name: response.data[0].activityName,
        type: response.data[0].activityType?.typeKey,
        date: response.data[0].startTimeGMT
      });
    }

    console.log('\n📝 This means we can bypass the garmin-connect library!');
    console.log('Next step: Store these cookies encrypted and use direct API calls');

  } catch (error) {
    console.error('❌ Direct API call failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }

    console.log('\n🔄 The cookies might have expired or format is wrong');
    console.log('Try refreshing the Garmin page and extracting fresh cookies');
  }
}

async function testWithLibrary() {
  console.log('\n=== Testing with garmin-connect Library ===\n');

  try {
    const client = new GarminConnect({ username: '', password: '' });

    // Try to inject cookies into the library's HTTP client
    console.log('Attempting to inject session cookies...');

    // The library uses axios internally
    if (client.client && client.client.client) {
      const cookieString = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');

      client.client.client.defaults.headers.common['Cookie'] = cookieString;
      console.log('✓ Cookies injected');

      // Try fetching activities
      console.log('Testing activity fetch...');
      const activities = await client.getActivities(0, 1);

      console.log('✅ Library method worked!');
      console.log(`Fetched ${activities.length} activities`);

    } else {
      console.log('⚠️  Could not access internal HTTP client');
    }

  } catch (error) {
    console.error('❌ Library method failed:', error.message);
  }
}

// Run tests
(async () => {
  await testDirectAPI();
  await testWithLibrary();
})();
