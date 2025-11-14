const db = require('../db/connection');

class GarminDailySteps {
  /**
   * Upsert daily steps (update if exists, insert if not)
   */
  static async upsert(stepsData) {
    const query = `
      INSERT INTO garmin_daily_steps (user_id, date, step_count)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, date) DO UPDATE SET
        step_count = EXCLUDED.step_count
      RETURNING *
    `;

    const values = [stepsData.user_id, stepsData.date, stepsData.step_count];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Bulk upsert daily steps
   * Returns the count of rows affected (inserted or updated)
   */
  static async bulkUpsert(stepsArray) {
    if (stepsArray.length === 0) return 0;

    const valuesClauses = [];
    const allValues = [];

    stepsArray.forEach((steps, idx) => {
      const offset = idx * 3;
      valuesClauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
      allValues.push(steps.user_id, steps.date, steps.step_count);
    });

    const query = `
      INSERT INTO garmin_daily_steps (user_id, date, step_count)
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (user_id, date) DO UPDATE SET
        step_count = EXCLUDED.step_count
      RETURNING id
    `;

    const result = await db.query(query, allValues);
    return result.rowCount;
  }

  /**
   * Find steps by user and date range
   */
  static async findByUserAndDateRange(userId, startDate, endDate) {
    const query = `
      SELECT * FROM garmin_daily_steps
      WHERE user_id = $1
        AND date >= $2
        AND date <= $3
      ORDER BY date DESC
    `;

    const result = await db.query(query, [userId, startDate, endDate]);
    return result.rows;
  }
}

module.exports = GarminDailySteps;
