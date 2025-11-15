const GarminJsonParser = require('./garminJsonParser');

describe('GarminJsonParser', () => {
  describe('parseUDSFile', () => {
    it('should parse UDS file with steps and heart rate data', async () => {
      const jsonContent = JSON.stringify([
        {
          "calendarDate": "2025-04-29",
          "totalSteps": 9909,
          "minHeartRate": 50,
          "maxHeartRate": 117,
          "restingHeartRate": 56
        },
        {
          "calendarDate": "2025-04-30",
          "totalSteps": 12453,
          "minHeartRate": 48,
          "maxHeartRate": 125,
          "restingHeartRate": 54
        }
      ]);

      const result = await GarminJsonParser.parseUDSFile(jsonContent);

      expect(result.steps).toEqual([
        { date: '2025-04-29', step_count: 9909 },
        { date: '2025-04-30', step_count: 12453 }
      ]);

      expect(result.heartRate).toEqual([
        {
          date: '2025-04-29',
          resting_heart_rate: 56,
          min_heart_rate: 50,
          max_heart_rate: 117
        },
        {
          date: '2025-04-30',
          resting_heart_rate: 54,
          min_heart_rate: 48,
          max_heart_rate: 125
        }
      ]);
    });

    it('should handle missing heart rate data', async () => {
      const jsonContent = JSON.stringify([
        {
          "calendarDate": "2025-04-29",
          "totalSteps": 9909
        }
      ]);

      const result = await GarminJsonParser.parseUDSFile(jsonContent);

      expect(result.steps).toEqual([
        { date: '2025-04-29', step_count: 9909 }
      ]);

      expect(result.heartRate).toEqual([
        {
          date: '2025-04-29',
          resting_heart_rate: null,
          min_heart_rate: null,
          max_heart_rate: null
        }
      ]);
    });
  });

  describe('parseSleepFile', () => {
    it('should parse sleep data JSON with all sleep stages', async () => {
      const jsonContent = JSON.stringify([
        {
          "calendarDate": "2018-07-04",
          "sleepStartTimestampGMT": "2018-07-03T22:49:00.0",
          "sleepEndTimestampGMT": "2018-07-04T07:28:00.0",
          "deepSleepSeconds": 2640,
          "lightSleepSeconds": 20220,
          "remSleepSeconds": 7560,
          "awakeSleepSeconds": 720
        },
        {
          "calendarDate": "2018-07-05",
          "sleepStartTimestampGMT": "2018-07-04T22:43:00.0",
          "sleepEndTimestampGMT": "2018-07-05T06:53:00.0",
          "deepSleepSeconds": 4080,
          "lightSleepSeconds": 18780,
          "remSleepSeconds": 6240,
          "awakeSleepSeconds": 300
        }
      ]);

      const result = await GarminJsonParser.parseSleepFile(jsonContent);

      expect(result).toEqual([
        {
          date: '2018-07-04',
          sleep_duration_seconds: 31140, // 2640 + 20220 + 7560 + 720
          deep_sleep_seconds: 2640,
          light_sleep_seconds: 20220,
          rem_sleep_seconds: 7560,
          awake_seconds: 720
        },
        {
          date: '2018-07-05',
          sleep_duration_seconds: 29400, // 4080 + 18780 + 6240 + 300
          deep_sleep_seconds: 4080,
          light_sleep_seconds: 18780,
          rem_sleep_seconds: 6240,
          awake_seconds: 300
        }
      ]);
    });

    it('should handle records with missing sleep stage data', async () => {
      const jsonContent = JSON.stringify([
        {
          "calendarDate": "2018-07-08",
          "sleepStartTimestampGMT": "2018-07-07T23:00:00.0",
          "sleepEndTimestampGMT": "2018-07-08T07:15:00.0",
          "sleepWindowConfirmationType": "UNCONFIRMED"
        }
      ]);

      const result = await GarminJsonParser.parseSleepFile(jsonContent);

      expect(result).toEqual([
        {
          date: '2018-07-08',
          sleep_duration_seconds: null,
          deep_sleep_seconds: null,
          light_sleep_seconds: null,
          rem_sleep_seconds: null,
          awake_seconds: null
        }
      ]);
    });

    it('should handle OFF_WRIST records with zero sleep data', async () => {
      const jsonContent = JSON.stringify([
        {
          "calendarDate": "2018-06-28",
          "sleepStartTimestampGMT": "2018-06-27T15:34:00.0",
          "sleepEndTimestampGMT": "2018-06-28T02:18:00.0",
          "sleepWindowConfirmationType": "OFF_WRIST",
          "deepSleepSeconds": 0,
          "lightSleepSeconds": 0,
          "awakeSleepSeconds": 0,
          "unmeasurableSeconds": 0
        }
      ]);

      const result = await GarminJsonParser.parseSleepFile(jsonContent);

      expect(result).toEqual([
        {
          date: '2018-06-28',
          sleep_duration_seconds: 0,
          deep_sleep_seconds: 0,
          light_sleep_seconds: 0,
          rem_sleep_seconds: null,
          awake_seconds: 0
        }
      ]);
    });
  });
});
