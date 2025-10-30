import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { getStats } from '../services/api';

// Color palette for charts
const COLORS = ['#1976d2', '#dc004e', '#f57c00', '#388e3c', '#7b1fa2', '#0288d1'];

function StatsPanel({ filters }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

    loadStats();
  }, [filters]);

  // Prepare pie chart data
  const preparePieData = (data) => {
    if (!data || data.length === 0) return [];
    return data.map(item => ({
      name: item.category || item.country,
      value: parseInt(item.count)
    }));
  };

  // Memoize pie chart data to avoid duplicate calculations
  const pieChartData = useMemo(() =>
    preparePieData(stats?.top_categories),
    [stats?.top_categories]
  );

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!stats) {
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

  // Prepare timeline data
  const prepareTimelineData = () => {
    if (!stats.timeline || stats.timeline.length === 0) return [];

    return stats.timeline
      .filter(item => item.year && item.month && item.count !== undefined)
      .map(item => ({
        date: `${item.year}-${String(item.month).padStart(2, '0')}`,
        count: parseInt(item.count) || 0
      }));
  };

  return (
    <Box sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Statistics
      </Typography>

      {/* Total Check-ins */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Total Check-ins
        </Typography>
        <Typography variant="h4" sx={{ mt: 1 }}>
          {stats.total_checkins.toLocaleString()}
        </Typography>
      </Paper>

      {/* Date Range */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Date Range
        </Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>
          {formatDateRange()}
        </Typography>
      </Paper>

      {/* Unmappable Count */}
      {stats.unmappable_count > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
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

      <Divider sx={{ my: 2 }} />

      {/* Most Visited Venue */}
      {stats.top_venue && (
        <Paper sx={{ p: 2, mb: 2 }}>
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

      <Divider sx={{ my: 2 }} />

      {/* Top Countries */}
      {stats.top_countries && stats.top_countries.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Top 5 Countries
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
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
              <Tooltip />
              <Bar dataKey="count" fill="#1976d2" />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Top Categories */}
      {stats.top_categories && stats.top_categories.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Top 5 Categories
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Timeline Chart */}
      {stats.timeline && stats.timeline.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Check-ins Over Time
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
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
              <Tooltip />
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
  );
}

export default StatsPanel;
