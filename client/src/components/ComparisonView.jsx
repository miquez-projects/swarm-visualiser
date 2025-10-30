import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  ArrowUpward,
  ArrowDownward,
  ArrowBack,
  NewReleases,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { compareTimePeriods } from '../services/api';

// Color palette for comparison
const PERIOD_COLORS = {
  period1: '#1976d2',
  period2: '#dc004e'
};

function ComparisonView({ onClose }) {
  // Period 1 state
  const [period1Start, setPeriod1Start] = useState(null);
  const [period1End, setPeriod1End] = useState(null);

  // Period 2 state
  const [period2Start, setPeriod2Start] = useState(null);
  const [period2End, setPeriod2End] = useState(null);

  // Comparison data state
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Validate dates before fetching
  const canCompare = () => {
    if (!period1Start || !period1End || !period2Start || !period2End) {
      return false;
    }
    // Validate Period 1 dates
    if (period1Start > period1End) {
      return false;
    }
    // Validate Period 2 dates
    if (period2Start > period2End) {
      return false;
    }
    return true;
  };

  // Fetch comparison data
  const handleCompare = async () => {
    if (!canCompare()) {
      setError('Please select date ranges for both periods');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = {
        period1_start: period1Start.toISOString(),
        period1_end: period1End.toISOString(),
        period2_start: period2Start.toISOString(),
        period2_end: period2End.toISOString()
      };

      const data = await compareTimePeriods(params);
      setComparisonData(data);
    } catch (err) {
      console.error('Error comparing periods:', err);
      setError(err.message || 'Failed to compare time periods');
    } finally {
      setLoading(false);
    }
  };

  // Format change indicator with color and arrow
  const renderChangeIndicator = (change, changePercent) => {
    if (change === 0) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
          <Typography variant="body2">No change</Typography>
        </Box>
      );
    }

    const isIncrease = change > 0;
    const color = isIncrease ? 'success.main' : 'error.main';
    const Icon = isIncrease ? ArrowUpward : ArrowDownward;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color }}>
        <Icon fontSize="small" />
        <Typography variant="body2" fontWeight="bold">
          {Math.abs(change).toLocaleString()} ({Math.abs(changePercent)}%)
        </Typography>
      </Box>
    );
  };

  // Render trend icon based on change
  const renderTrendIcon = (change) => {
    if (change > 0) {
      return <TrendingUp sx={{ color: 'success.main', fontSize: 40 }} />;
    } else if (change < 0) {
      return <TrendingDown sx={{ color: 'error.main', fontSize: 40 }} />;
    }
    return null;
  };

  // Prepare comparison chart data
  const prepareComparisonChartData = () => {
    if (!comparisonData) return [];

    const categories1 = comparisonData.period1.top_categories || [];
    const categories2 = comparisonData.period2.top_categories || [];

    // Combine categories from both periods
    const categoryMap = new Map();

    categories1.forEach(cat => {
      categoryMap.set(cat.category, {
        name: cat.category,
        period1: parseInt(cat.count),
        period2: 0
      });
    });

    categories2.forEach(cat => {
      if (categoryMap.has(cat.category)) {
        categoryMap.get(cat.category).period2 = parseInt(cat.count);
      } else {
        categoryMap.set(cat.category, {
          name: cat.category,
          period1: 0,
          period2: parseInt(cat.count)
        });
      }
    });

    return Array.from(categoryMap.values());
  };

  // Prepare countries comparison chart data
  const prepareCountriesChartData = () => {
    if (!comparisonData) return [];

    const countries1 = comparisonData.period1.top_countries || [];
    const countries2 = comparisonData.period2.top_countries || [];

    // Combine countries from both periods
    const countryMap = new Map();

    countries1.forEach(country => {
      countryMap.set(country.country, {
        name: country.country,
        period1: parseInt(country.count),
        period2: 0
      });
    });

    countries2.forEach(country => {
      if (countryMap.has(country.country)) {
        countryMap.get(country.country).period2 = parseInt(country.count);
      } else {
        countryMap.set(country.country, {
          name: country.country,
          period1: 0,
          period2: parseInt(country.count)
        });
      }
    });

    return Array.from(countryMap.values());
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ height: '100%', overflow: 'auto', bgcolor: 'background.default', p: 3 }}>
        {/* Header with Back Button */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={onClose}
          >
            Back to Map
          </Button>
          <Typography variant="h4" component="h1">
            Time Period Comparison
          </Typography>
        </Box>

        {/* Date Range Selectors */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            {/* Period 1 */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ color: PERIOD_COLORS.period1 }}>
                Period 1
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <DatePicker
                  label="Start Date"
                  value={period1Start}
                  onChange={setPeriod1Start}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={period1End}
                  onChange={setPeriod1End}
                  minDate={period1Start || undefined}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </Box>
            </Grid>

            {/* Period 2 */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ color: PERIOD_COLORS.period2 }}>
                Period 2
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <DatePicker
                  label="Start Date"
                  value={period2Start}
                  onChange={setPeriod2Start}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
                <DatePicker
                  label="End Date"
                  value={period2End}
                  onChange={setPeriod2End}
                  minDate={period2Start || undefined}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </Box>
            </Grid>

            {/* Compare Button */}
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleCompare}
                disabled={!canCompare() || loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Compare Periods'}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Error Message */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Comparison Results */}
        {comparisonData && !loading && (
          <Box>
            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* Period 1 Total Check-ins */}
              <Grid item xs={12} md={6}>
                <Card sx={{ borderLeft: 4, borderColor: PERIOD_COLORS.period1 }}>
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      Period 1 Total Check-ins
                    </Typography>
                    <Typography variant="h3" sx={{ my: 1 }}>
                      {comparisonData.period1.total_checkins.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {comparisonData.period1.label}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Period 2 Total Check-ins */}
              <Grid item xs={12} md={6}>
                <Card sx={{ borderLeft: 4, borderColor: PERIOD_COLORS.period2 }}>
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      Period 2 Total Check-ins
                    </Typography>
                    <Typography variant="h3" sx={{ my: 1 }}>
                      {comparisonData.period2.total_checkins.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {comparisonData.period2.label}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Change Summary */}
              <Grid item xs={12}>
                <Card sx={{ bgcolor: 'action.hover' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {renderTrendIcon(comparisonData.comparison.checkins_change)}
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          Overall Change
                        </Typography>
                        {renderChangeIndicator(
                          comparisonData.comparison.checkins_change,
                          comparisonData.comparison.checkins_change_percent
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* New Countries & Categories */}
            {(comparisonData.comparison.new_countries?.length > 0 ||
              comparisonData.comparison.new_categories?.length > 0) && (
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NewReleases color="primary" />
                  New in Period 2
                </Typography>
                <Divider sx={{ my: 2 }} />

                {comparisonData.comparison.new_countries?.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      New Countries
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {comparisonData.comparison.new_countries.map((country) => (
                        <Chip
                          key={country}
                          label={country}
                          color="primary"
                          variant="outlined"
                          icon={<NewReleases />}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {comparisonData.comparison.new_categories?.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      New Categories
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {comparisonData.comparison.new_categories.map((category) => (
                        <Chip
                          key={category}
                          label={category}
                          color="secondary"
                          variant="outlined"
                          icon={<NewReleases />}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Paper>
            )}

            {/* Comparative Charts */}
            <Grid container spacing={3}>
              {/* Countries Comparison */}
              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Top Countries Comparison
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={prepareCountriesChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="period1"
                        fill={PERIOD_COLORS.period1}
                        name="Period 1"
                      />
                      <Bar
                        dataKey="period2"
                        fill={PERIOD_COLORS.period2}
                        name="Period 2"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Categories Comparison */}
              <Grid item xs={12} lg={6}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Top Categories Comparison
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={prepareComparisonChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="period1"
                        fill={PERIOD_COLORS.period1}
                        name="Period 1"
                      />
                      <Bar
                        dataKey="period2"
                        fill={PERIOD_COLORS.period2}
                        name="Period 2"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Most Visited Venues Comparison */}
              {comparisonData.period1.top_venue && comparisonData.period2.top_venue && (
                <Grid item xs={12}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Most Visited Venues
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Period 1
                          </Typography>
                          <Typography variant="h6">
                            {comparisonData.period1.top_venue.venue_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {comparisonData.period1.top_venue.count} visit
                            {comparisonData.period1.top_venue.count !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Period 2
                          </Typography>
                          <Typography variant="h6">
                            {comparisonData.period2.top_venue.venue_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {comparisonData.period2.top_venue.count} visit
                            {comparisonData.period2.top_venue.count !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {/* No Data State */}
        {!comparisonData && !loading && !error && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Select date ranges and click "Compare Periods" to see comparison
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose two different time periods to compare your check-in patterns
            </Typography>
          </Box>
        )}
      </Box>
    </LocalizationProvider>
  );
}

export default ComparisonView;
