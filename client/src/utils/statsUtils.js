/**
 * Format a date range from stats data.
 */
export function formatDateRange(data) {
  if (!data || !data.date_range || !data.date_range.first_checkin || !data.date_range.last_checkin) {
    return 'No data';
  }
  const first = new Date(data.date_range.first_checkin).toLocaleDateString();
  const last = new Date(data.date_range.last_checkin).toLocaleDateString();
  return `${first} - ${last}`;
}

/**
 * Prepare comparison bar chart data by merging two period arrays.
 */
export function prepareComparisonBarData(period1Array, period2Array, keyField) {
  const combined = {};

  period1Array.forEach(item => {
    const key = item[keyField];
    combined[key] = {
      name: key,
      period1: parseInt(item.count) || 0,
      period2: 0
    };
  });

  period2Array.forEach(item => {
    const key = item[keyField];
    if (combined[key]) {
      combined[key].period2 = parseInt(item.count) || 0;
    } else {
      combined[key] = {
        name: key,
        period1: 0,
        period2: parseInt(item.count) || 0
      };
    }
  });

  return Object.values(combined)
    .map(item => ({
      ...item,
      total: item.period1 + item.period2
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

/**
 * Prepare comparison timeline data with relative time indices.
 */
export function prepareComparisonTimelineData(period1Timeline, period2Timeline) {
  const maxLength = Math.max(period1Timeline.length, period2Timeline.length);
  const result = [];

  for (let i = 0; i < maxLength; i++) {
    const dataPoint = {
      index: i + 1,
      period1: i < period1Timeline.length ? (parseInt(period1Timeline[i].count) || 0) : null,
      period2: i < period2Timeline.length ? (parseInt(period2Timeline[i].count) || 0) : null
    };
    result.push(dataPoint);
  }

  return result;
}
