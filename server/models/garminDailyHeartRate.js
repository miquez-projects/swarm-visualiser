const db = require('../db/connection');

class GarminDailyHeartRate {
  /**
   * Upsert daily heart rate (update if exists, insert if not)
   */
  static async upsert(hrData) {
    const query = `
      INSERT INTO garmin_daily_heart_rate (
        user_id, date, min_heart_rate, max_heart_rate, resting_heart_rate
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, date) DO UPDATE SET
        min_heart_rate = EXCLUDED.min_heart_rate,
        max_heart_rate = EXCLUDED.max_heart_rate,
        resting_heart_rate = EXCLUDED.resting_heart_rate
      RETURNING *
    `;

    const values = [
      hrData.user_id,
      hrData.date,
      hrData.min_heart_rate,
      hrData.max_heart_rate,
      hrData.resting_heart_rate
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Bulk upsert daily heart rate
   */
  static async bulkUpsert(hrArray) {
    if (hrArray.length === 0) return 0;

    const valuesClauses = [];
    const allValues = [];

    hrArray.forEach((hr, idx) => {
      const offset = idx * 5;
      valuesClauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      allValues.push(
        hr.user_id,
        hr.date,
        hr.min_heart_rate,
        hr.max_heart_rate,
        hr.resting_heart_rate
      );
    });

    const query = `
      INSERT INTO garmin_daily_heart_rate (
        user_id, date, min_heart_rate, max_heart_rate, resting_heart_rate
      )
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (user_id, date) DO UPDATE SET
        min_heart_rate = EXCLUDED.min_heart_rate,
        max_heart_rate = EXCLUDED.max_heart_rate,
        resting_heart_rate = EXCLUDED.resting_heart_rate
      RETURNING id
    `;

    const result = await db.query(query, allValues);
    return result.rowCount;
  }

  /**
   * Find heart rate by user and date range
   */
  static async findByUserAndDateRange(userId, startDate, endDate) {
    const query = `
      SELECT * FROM garmin_daily_heart_rate
      WHERE user_id = $1
        AND date >= $2
        AND date <= $3
      ORDER BY date DESC
    `;

    const result = await db.query(query, [userId, startDate, endDate]);
    return result.rows;
  }
}

module.exports = GarminDailyHeartRate;
