const db = require('../db/connection');

class DailyWeather {
  static async upsert(weatherData) {
    const query = `
      INSERT INTO daily_weather (date, country, region, temp_celsius, condition, weather_icon)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (date, country, region) DO UPDATE SET
        temp_celsius = EXCLUDED.temp_celsius,
        condition = EXCLUDED.condition,
        weather_icon = EXCLUDED.weather_icon
      RETURNING *
    `;
    const values = [
      weatherData.date,
      weatherData.country,
      weatherData.region,
      weatherData.temp_celsius,
      weatherData.condition,
      weatherData.weather_icon
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByDateAndLocation(date, country, region = null) {
    const query = `
      SELECT * FROM daily_weather
      WHERE date = $1 AND country = $2 AND (region = $3 OR ($3 IS NULL AND region IS NULL))
    `;
    const result = await db.query(query, [date, country, region]);
    return result.rows[0];
  }
}

module.exports = DailyWeather;
