import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { CompareArrows } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { getStats, compareTimePeriods } from '../services/api';

// Color palette for charts
const COLORS = ['#1976d2', '#dc004e', '#f57c00', '#388e3c', '#7b1fa2', '#0288d1'];

function StatsPanel({ filters, isExpanded = false, onToggleExpand, comparisonMode = false, onComparisonModeChange, token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [error, setError] = useState(null);
  const [period1Start, setPeriod1Start] = useState(null);
  const [period1End, setPeriod1End] = useState(null);
  const [period2Start, setPeriod2Start] = useState(null);
  const [period2End, setPeriod2End] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = { ...filters };
        if (token) {
          params.token = token;
        }
        const data = await getStats(params);
        setStats(data);
      } catch (err) {
        console.error('Error loading stats:', err);
        setError(err.message || 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    if (!comparisonMode) {
      loadStats();
    }
  }, [filters, comparisonMode, token]);

  // Load comparison data when dates are set
  useEffect(() => {
    const loadComparison = async () => {
      if (!comparisonMode || !period1Start || !period1End || !period2Start || !period2End) {
        return;
      }

      try {
        setComparisonLoading(true);
        setError(null);
        const params = {
          period1_start: period1Start.toISOString(),
          period1_end: period1End.toISOString(),
          period2_start: period2Start.toISOString(),
          period2_end: period2End.toISOString(),
          ...filters
        };
        if (token) {
          params.token = token;
        }
        const data = await compareTimePeriods(params);
        setComparisonData(data);
      } catch (err) {
        console.error('Error loading comparison:', err);
        setError(err.message || 'Failed to load comparison');
      } finally {
        setComparisonLoading(false);
      }
    };

    if (comparisonMode) {
      loadComparison();
    }
  }, [comparisonMode, period1Start, period1End, period2Start, period2End, filters, token]);


  // Show loading state only for initial stats loading (not comparison loading)
  if (loading && !comparisonMode) {
    return (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </LocalizationProvider>
    );
  }

  // Show error state
  if (error) {
    return (
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ p: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </LocalizationProvider>
    );
  }

  // Check if we have data to display
  if (!stats && !comparisonData) {
    return null;
  }

  // Determine if we're showing comparison
  const showingComparison = comparisonMode && comparisonData && comparisonData.period1 && comparisonData.period2;

  // Use comparison data if available, otherwise regular stats
  const period1Data = showingComparison ? comparisonData.period1 : stats;
  const period2Data = showingComparison ? comparisonData.period2 : null;

  // Format date range
  const formatDateRange = (data) => {
    if (!data || !data.date_range || !data.date_range.first_checkin || !data.date_range.last_checkin) {
      return 'No data';
    }
    const first = new Date(data.date_range.first_checkin).toLocaleDateString();
    const last = new Date(data.date_range.last_checkin).toLocaleDateString();
    return `${first} - ${last}`;
  };

  // Prepare comparison data for bar charts (merge both periods)
  const prepareComparisonBarData = (period1Array, period2Array, keyField) => {
    const combined = {};

    // Add period 1 data
    period1Array.forEach(item => {
      const key = item[keyField];
      combined[key] = {
        name: key,
        period1: parseInt(item.count) || 0,
        period2: 0
      };
    });

    // Add period 2 data
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

    // Convert to array and sort by total count
    return Object.values(combined)
      .map(item => ({
        ...item,
        total: item.period1 + item.period2
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // Top 5
  };

  // Prepare comparison timeline data (overlapping periods with relative time indices)
  const prepareComparisonTimelineData = (period1Timeline, period2Timeline) => {
    // Convert timeline items to relative indices (0, 1, 2, ...)
    const maxLength = Math.max(period1Timeline.length, period2Timeline.length);
    const result = [];

    for (let i = 0; i < maxLength; i++) {
      const dataPoint = {
        index: i + 1, // Start from 1 for better readability
        period1: i < period1Timeline.length ? (parseInt(period1Timeline[i].count) || 0) : null,
        period2: i < period2Timeline.length ? (parseInt(period2Timeline[i].count) || 0) : null
      };
      result.push(dataPoint);
    }

    return result;
  };

  // Prepare timeline data - backend now provides adaptive granularity
  const prepareTimelineData = () => {
    if (!stats.timeline || stats.timeline.length === 0) return [];

    return stats.timeline
      .filter(item => item.count !== undefined)
      .map(item => {
        let dateLabel;

        // Backend provides different fields based on granularity
        if (item.day) {
          // Daily: year, month, day
          dateLabel = `${item.year}-${String(item.month).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`;
        } else if (item.week) {
          // Weekly: year, week
          dateLabel = `${item.year}-W${String(item.week).padStart(2, '0')}`;
        } else if (item.quarter) {
          // Quarterly: year, quarter
          dateLabel = `${item.year}-Q${item.quarter}`;
        } else if (item.month) {
          // Monthly: year, month
          dateLabel = `${item.year}-${String(item.month).padStart(2, '0')}`;
        } else {
          // Yearly: year only
          dateLabel = `${item.year}`;
        }

        return {
          date: dateLabel,
          count: parseInt(item.count) || 0
        };
      });
  };

  const chartHeight = isExpanded ? 400 : 250;
  const pieChartHeight = isExpanded ? 500 : 300;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 2, height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Statistics
          </Typography>
          {isExpanded && onComparisonModeChange && (
            <Tooltip title="Compare two time periods">
              <IconButton
                onClick={() => onComparisonModeChange(!comparisonMode)}
                size="small"
                color={comparisonMode ? "primary" : "default"}
              >
                <CompareArrows />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Comparison Date Pickers */}
        {isExpanded && comparisonMode && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" gutterBottom>
                Select Time Periods to Compare
              </Typography>
              {comparisonLoading && (
                <CircularProgress size={20} />
              )}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mt: 2 }}>
              {/* Period 1 */}
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  Period 1
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <DatePicker
                    label="Start Date"
                    value={period1Start}
                    onChange={setPeriod1Start}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                  <DatePicker
                    label="End Date"
                    value={period1End}
                    onChange={setPeriod1End}
                    minDate={period1Start || undefined}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Box>
              </Box>

              {/* Period 2 */}
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  Period 2
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <DatePicker
                    label="Start Date"
                    value={period2Start}
                    onChange={setPeriod2Start}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                  <DatePicker
                    label="End Date"
                    value={period2End}
                    onChange={setPeriod2End}
                    minDate={period2Start || undefined}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Box>
              </Box>
            </Box>
          </Paper>
        )}

      {/* Summary Cards */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: isExpanded ? 'repeat(auto-fit, minmax(250px, 1fr))' : '1fr',
        gap: 2,
        mb: 2
      }}>
        {/* Total Check-ins */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Total Check-ins
          </Typography>
          {showingComparison ? (
            <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'baseline' }}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Period 1</Typography>
                <Typography variant="h5" color="primary">
                  {period1Data.total_checkins.toLocaleString()}
                </Typography>
              </Box>
              <Typography variant="h6" color="text.secondary">vs</Typography>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Period 2</Typography>
                <Typography variant="h5" color="secondary">
                  {period2Data.total_checkins.toLocaleString()}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography variant="h4" sx={{ mt: 1 }}>
              {period1Data.total_checkins.toLocaleString()}
            </Typography>
          )}
        </Paper>

        {/* Total Venues */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Total Venues
          </Typography>
          {showingComparison ? (
            <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'baseline' }}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Period 1</Typography>
                <Typography variant="h5" color="primary">
                  {period1Data.total_venues.toLocaleString()}
                </Typography>
              </Box>
              <Typography variant="h6" color="text.secondary">vs</Typography>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Period 2</Typography>
                <Typography variant="h5" color="secondary">
                  {period2Data.total_venues.toLocaleString()}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography variant="h4" sx={{ mt: 1 }}>
              {period1Data.total_venues.toLocaleString()}
            </Typography>
          )}
        </Paper>

        {/* Date Range */}
        {!showingComparison && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Date Range
            </Typography>
            <Typography variant="body1" sx={{ mt: 1 }}>
              {formatDateRange(period1Data)}
            </Typography>
          </Paper>
        )}

        {/* Most Visited Venue */}
        {period1Data.top_venue && !showingComparison && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Most Visited Venue
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {period1Data.top_venue.venue_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {period1Data.top_venue.count} visit{period1Data.top_venue.count !== 1 ? 's' : ''}
            </Typography>
          </Paper>
        )}

        {/* Comparison Summary */}
        {showingComparison && comparisonData.comparison && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Change
            </Typography>
            <Typography variant="h5" sx={{
              color: comparisonData.comparison.checkins_change >= 0 ? 'success.main' : 'error.main'
            }}>
              {comparisonData.comparison.checkins_change >= 0 ? '+' : ''}
              {comparisonData.comparison.checkins_change.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ({comparisonData.comparison.checkins_change_percent >= 0 ? '+' : ''}
              {comparisonData.comparison.checkins_change_percent}% change)
            </Typography>
          </Paper>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Charts Grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: isExpanded ? 'repeat(auto-fit, minmax(500px, 1fr))' : '1fr',
        gap: 2
      }}>
        {/* Top Countries */}
        {period1Data.top_countries && period1Data.top_countries.length > 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Top 5 Countries
            </Typography>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={showingComparison
                ? prepareComparisonBarData(period1Data.top_countries, period2Data.top_countries, 'country')
                : period1Data.top_countries
              }>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={showingComparison ? "name" : "country"}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  style={{ fontSize: '12px' }}
                />
                <YAxis />
                <ChartTooltip />
                {showingComparison ? (
                  <>
                    <Legend />
                    <Bar dataKey="period1" fill="#1976d2" name="Period 1" />
                    <Bar dataKey="period2" fill="#dc004e" name="Period 2" />
                  </>
                ) : (
                  <Bar dataKey="count" fill="#1976d2" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Top Categories - Bar Chart */}
        {period1Data.top_categories && period1Data.top_categories.length > 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Top 5 Categories
            </Typography>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={showingComparison
                ? prepareComparisonBarData(period1Data.top_categories, period2Data.top_categories, 'category')
                : period1Data.top_categories
              }>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={showingComparison ? "name" : "category"}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  style={{ fontSize: '12px' }}
                />
                <YAxis />
                <ChartTooltip />
                {showingComparison ? (
                  <>
                    <Legend />
                    <Bar dataKey="period1" fill="#1976d2" name="Period 1" />
                    <Bar dataKey="period2" fill="#dc004e" name="Period 2" />
                  </>
                ) : (
                  <Bar dataKey="count" fill="#f57c00" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Timeline Chart */}
        {period1Data.timeline && period1Data.timeline.length > 0 && (
          <Paper sx={{ p: 2, gridColumn: isExpanded ? '1 / -1' : 'auto' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {showingComparison ? 'Check-ins Over Time (Overlapping Periods)' : 'Check-ins Over Time'}
            </Typography>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <LineChart data={showingComparison
                ? prepareComparisonTimelineData(period1Data.timeline, period2Data.timeline)
                : prepareTimelineData()
              }>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={showingComparison ? "index" : "date"}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  style={{ fontSize: '10px' }}
                  label={showingComparison ? { value: 'Time Period Index', position: 'insideBottom', offset: -5 } : undefined}
                />
                <YAxis />
                <ChartTooltip />
                <Legend />
                {showingComparison ? (
                  <>
                    <Line
                      type="monotone"
                      dataKey="period1"
                      stroke="#1976d2"
                      name="Period 1"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="period2"
                      stroke="#dc004e"
                      name="Period 2"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </>
                ) : (
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#1976d2"
                    name="Check-ins"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        )}
      </Box>
      </Box>
    </LocalizationProvider>
  );
}

export default StatsPanel;
