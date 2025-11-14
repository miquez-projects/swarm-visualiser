const db = require('../db/connection');

class GarminDailySleep {
  /**
   * Upsert daily sleep (update if exists, insert if not)
   */
  static async upsert(sleepData) {
    const query = `
      INSERT INTO garmin_daily_sleep (
        user_id, date, sleep_duration_seconds, sleep_score,
        deep_sleep_seconds, light_sleep_seconds, rem_sleep_seconds, awake_seconds
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, date) DO UPDATE SET
        sleep_duration_seconds = EXCLUDED.sleep_duration_seconds,
        sleep_score = EXCLUDED.sleep_score,
        deep_sleep_seconds = EXCLUDED.deep_sleep_seconds,
        light_sleep_seconds = EXCLUDED.light_sleep_seconds,
        rem_sleep_seconds = EXCLUDED.rem_sleep_seconds,
        awake_seconds = EXCLUDED.awake_seconds
      RETURNING *
    `;

    const values = [
      sleepData.user_id,
      sleepData.date,
      sleepData.sleep_duration_seconds,
      sleepData.sleep_score,
      sleepData.deep_sleep_seconds,
      sleepData.light_sleep_seconds,
      sleepData.rem_sleep_seconds,
      sleepData.awake_seconds
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Bulk upsert daily sleep
   */
  static async bulkUpsert(sleepArray) {
    if (sleepArray.length === 0) return 0;

    const valuesClauses = [];
    const allValues = [];

    sleepArray.forEach((sleep, idx) => {
      const offset = idx * 8;
      valuesClauses.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`
      );
      allValues.push(
        sleep.user_id,
        sleep.date,
        sleep.sleep_duration_seconds,
        sleep.sleep_score,
        sleep.deep_sleep_seconds,
        sleep.light_sleep_seconds,
        sleep.rem_sleep_seconds,
        sleep.awake_seconds
      );
    });

    const query = `
      INSERT INTO garmin_daily_sleep (
        user_id, date, sleep_duration_seconds, sleep_score,
        deep_sleep_seconds, light_sleep_seconds, rem_sleep_seconds, awake_seconds
      )
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (user_id, date) DO UPDATE SET
        sleep_duration_seconds = EXCLUDED.sleep_duration_seconds,
        sleep_score = EXCLUDED.sleep_score,
        deep_sleep_seconds = EXCLUDED.deep_sleep_seconds,
        light_sleep_seconds = EXCLUDED.light_sleep_seconds,
        rem_sleep_seconds = EXCLUDED.rem_sleep_seconds,
        awake_seconds = EXCLUDED.awake_seconds
      RETURNING id
    `;

    const result = await db.query(query, allValues);
    return result.rowCount;
  }

  /**
   * Find sleep by user and date range
   */
  static async findByUserAndDateRange(userId, startDate, endDate) {
    const query = `
      SELECT * FROM garmin_daily_sleep
      WHERE user_id = $1
        AND date >= $2
        AND date <= $3
      ORDER BY date DESC
    `;

    const result = await db.query(query, [userId, startDate, endDate]);
    return result.rows;
  }
}

module.exports = GarminDailySleep;
