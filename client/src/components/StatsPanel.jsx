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
import { Fullscreen, FullscreenExit, CompareArrows } from '@mui/icons-material';
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

function StatsPanel({ filters, isExpanded = false, onToggleExpand }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comparisonMode, setComparisonMode] = useState(false);
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
        const data = await getStats(filters);
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
  }, [filters, comparisonMode]);

  // Load comparison data when dates are set
  useEffect(() => {
    const loadComparison = async () => {
      if (!comparisonMode || !period1Start || !period1End || !period2Start || !period2End) {
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await compareTimePeriods({
          period1_start: period1Start.toISOString(),
          period1_end: period1End.toISOString(),
          period2_start: period2Start.toISOString(),
          period2_end: period2End.toISOString(),
          ...filters
        });
        setComparisonData(data);
      } catch (err) {
        console.error('Error loading comparison:', err);
        setError(err.message || 'Failed to load comparison');
      } finally {
        setLoading(false);
      }
    };

    if (comparisonMode) {
      loadComparison();
    }
  }, [comparisonMode, period1Start, period1End, period2Start, period2End, filters]);


  // Show loading state
  if (loading) {
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

  // For now, just show regular stats (comparison view to be implemented)
  if (!stats && !comparisonData) {
    return null;
  }

  // Format date range
  const formatDateRange = () => {
    if (!stats.date_range || !stats.date_range.first_checkin || !stats.date_range.last_checkin) {
      return 'No data';
    }
    const first = new Date(stats.date_range.first_checkin).toLocaleDateString();
    const last = new Date(stats.date_range.last_checkin).toLocaleDateString();
    return `${first} - ${last}`;
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
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isExpanded && (
              <Tooltip title="Compare two time periods">
                <IconButton
                  onClick={() => setComparisonMode(!comparisonMode)}
                  size="small"
                  color={comparisonMode ? "primary" : "default"}
                >
                  <CompareArrows />
                </IconButton>
              </Tooltip>
            )}
            {onToggleExpand && (
              <Tooltip title={isExpanded ? "Exit full screen" : "Expand to full screen"}>
                <IconButton
                  onClick={onToggleExpand}
                  size="small"
                  color="primary"
                >
                  {isExpanded ? <FullscreenExit /> : <Fullscreen />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Comparison Date Pickers */}
        {isExpanded && comparisonMode && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Select Time Periods to Compare
            </Typography>
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
          <Typography variant="h4" sx={{ mt: 1 }}>
            {stats.total_checkins.toLocaleString()}
          </Typography>
        </Paper>

        {/* Date Range */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Date Range
          </Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            {formatDateRange()}
          </Typography>
        </Paper>

        {/* Unmappable Count */}
        {stats.unmappable_count > 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Unmappable Check-ins
            </Typography>
            <Typography variant="h6" sx={{ mt: 1 }}>
              {stats.unmappable_count.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (Missing location data)
            </Typography>
          </Paper>
        )}

        {/* Most Visited Venue */}
        {stats.top_venue && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Most Visited Venue
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {stats.top_venue.venue_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stats.top_venue.count} visit{stats.top_venue.count !== 1 ? 's' : ''}
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
        {stats.top_countries && stats.top_countries.length > 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Top 5 Countries
            </Typography>
            <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={stats.top_countries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="country"
                angle={-45}
                textAnchor="end"
                height={80}
                style={{ fontSize: '12px' }}
              />
              <YAxis />
              <ChartTooltip />
              <Bar dataKey="count" fill="#1976d2" />
            </BarChart>
          </ResponsiveContainer>
          </Paper>
        )}

        {/* Top Categories - Bar Chart */}
        {stats.top_categories && stats.top_categories.length > 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Top 5 Categories
            </Typography>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={stats.top_categories}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="category"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  style={{ fontSize: '12px' }}
                />
                <YAxis />
                <ChartTooltip />
                <Bar dataKey="count" fill="#f57c00" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Timeline Chart */}
        {stats.timeline && stats.timeline.length > 0 && (
          <Paper sx={{ p: 2, gridColumn: isExpanded ? '1 / -1' : 'auto' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Check-ins Over Time
            </Typography>
            <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={prepareTimelineData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={80}
                style={{ fontSize: '10px' }}
              />
              <YAxis />
              <ChartTooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#1976d2"
                name="Check-ins"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
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
