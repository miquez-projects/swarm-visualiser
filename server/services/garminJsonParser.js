class GarminJsonParser {
  /**
   * Parse UDS (User Daily Summary) file
   * Returns an object with steps and heartRate arrays
   */
  async parseUDSFile(jsonContent) {
    const data = JSON.parse(jsonContent);

    const steps = [];
    const heartRate = [];

    for (const record of data) {
      const date = record.calendarDate;

      // Extract steps
      if (record.totalSteps !== undefined) {
        steps.push({
          date,
          step_count: record.totalSteps
        });
      }

      // Extract heart rate data
      heartRate.push({
        date,
        resting_heart_rate: this._parseInt(record.restingHeartRate),
        min_heart_rate: this._parseInt(record.minHeartRate),
        max_heart_rate: this._parseInt(record.maxHeartRate)
      });
    }

    return { steps, heartRate };
  }

  /**
   * Parse sleep data file
   * Expected format: Array of sleep records with calendarDate and sleep stage seconds
   */
  async parseSleepFile(jsonContent) {
    const data = JSON.parse(jsonContent);

    return data
      .filter(record => {
        // Skip records without a valid date
        if (!record.calendarDate) {
          console.warn('[GARMIN PARSER] Skipping sleep record with null/missing calendarDate:', record);
          return false;
        }
        return true;
      })
      .map(record => {
        const deepSleep = this._parseInt(record.deepSleepSeconds);
        const lightSleep = this._parseInt(record.lightSleepSeconds);
        const remSleep = this._parseInt(record.remSleepSeconds);
        const awake = this._parseInt(record.awakeSleepSeconds);

        // Calculate total duration if we have any sleep stage data
        let totalDuration = null;
        if (deepSleep !== null || lightSleep !== null || remSleep !== null || awake !== null) {
          totalDuration = (deepSleep || 0) + (lightSleep || 0) + (remSleep || 0) + (awake || 0);
        }

        return {
          date: record.calendarDate,
          sleep_duration_seconds: totalDuration,
          deep_sleep_seconds: deepSleep,
          light_sleep_seconds: lightSleep,
          rem_sleep_seconds: remSleep,
          awake_seconds: awake
        };
      });
  }

  /**
   * Safely parse integer, return null if invalid
   */
  _parseInt(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }
}

module.exports = new GarminJsonParser();
