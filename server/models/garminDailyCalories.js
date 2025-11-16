const db = require('../db/connection');

class GarminDailyCalories {
  /**
   * Upsert daily calories record
   */
  static async upsert(caloriesData) {
    const query = `
      INSERT INTO garmin_daily_calories (user_id, date, total_calories, active_calories, bmr_calories)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        total_calories = EXCLUDED.total_calories,
        active_calories = EXCLUDED.active_calories,
        bmr_calories = EXCLUDED.bmr_calories,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      caloriesData.user_id,
      caloriesData.date,
      caloriesData.total_calories,
      caloriesData.active_calories,
      caloriesData.bmr_calories
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get calories for a specific date
   */
  static async findByUserAndDate(userId, date) {
    const query = `
      SELECT * FROM garmin_daily_calories
      WHERE user_id = $1 AND date = $2
    `;

    const result = await db.query(query, [userId, date]);
    return result.rows[0];
  }

  /**
   * Get calories for a date range
   */
  static async findByUserAndDateRange(userId, startDate, endDate) {
    const query = `
      SELECT * FROM garmin_daily_calories
      WHERE user_id = $1
        AND date >= $2
        AND date <= $3
      ORDER BY date ASC
    `;

    const result = await db.query(query, [userId, startDate, endDate]);
    return result.rows;
  }
}

module.exports = GarminDailyCalories;
