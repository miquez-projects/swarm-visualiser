import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Typography,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { FilterList, Clear } from '@mui/icons-material';
import { getFilterOptions } from '../services/api';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

function FilterPanel({ onFilterChange, initialFilters = {}, comparisonModeActive = false }) {
  const [filters, setFilters] = useState({
    startDate: initialFilters.startDate || null,
    endDate: initialFilters.endDate || null,
    categories: initialFilters.categories || [],
    country: initialFilters.country || '',
    city: initialFilters.city || '',
    search: initialFilters.search || ''
  });

  const [filterOptions, setFilterOptions] = useState({
    countries: [],
    cities: [],
    categories: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        setLoading(true);
        setError(null);
        const options = await getFilterOptions();
        setFilterOptions(options);
      } catch (err) {
        console.error('Failed to load filter options:', err);
        setError('Failed to load filter options. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadFilterOptions();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCategoryChange = (event) => {
    const value = event.target.value;
    setFilters(prev => ({
      ...prev,
      categories: typeof value === 'string' ? value.split(',') : value
    }));
  };

  const handleApplyFilters = () => {
    // Build filter object with only non-empty values
    const appliedFilters = {};

    if (filters.startDate) {
      appliedFilters.startDate = filters.startDate.toISOString();
    }

    if (filters.endDate) {
      appliedFilters.endDate = filters.endDate.toISOString();
    }

    if (filters.categories && filters.categories.length > 0) {
      appliedFilters.category = filters.categories;
    }

    if (filters.country) {
      appliedFilters.country = filters.country;
    }

    if (filters.city) {
      appliedFilters.city = filters.city;
    }

    if (filters.search && filters.search.trim()) {
      appliedFilters.search = filters.search.trim();
    }

    onFilterChange(appliedFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      startDate: null,
      endDate: null,
      categories: [],
      country: '',
      city: '',
      search: ''
    };
    setFilters(clearedFilters);
    onFilterChange({});
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterList color="primary" />
          <Typography variant="h6" component="h2">
            Filters
          </Typography>
        </Box>

        <Divider />

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Date Range */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Date Range {comparisonModeActive && '(Disabled in Comparison Mode)'}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <DatePicker
              label="Start Date"
              value={filters.startDate}
              onChange={(newValue) => handleFilterChange('startDate', newValue)}
              disabled={comparisonModeActive}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small'
                }
              }}
            />
            <DatePicker
              label="End Date"
              value={filters.endDate}
              onChange={(newValue) => handleFilterChange('endDate', newValue)}
              minDate={filters.startDate || undefined}
              disabled={comparisonModeActive}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small'
                }
              }}
            />
          </Box>
        </Box>

        <Divider />

        {/* Categories */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Categories
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="categories-label">Select Categories</InputLabel>
            <Select
              labelId="categories-label"
              id="categories-select"
              multiple
              value={filters.categories}
              onChange={handleCategoryChange}
              input={<OutlinedInput label="Select Categories" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
              MenuProps={MenuProps}
            >
              {filterOptions.categories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider />

        {/* Location */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Location
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="country-label">Country</InputLabel>
              <Select
                labelId="country-label"
                id="country-select"
                value={filters.country}
                label="Country"
                onChange={(e) => handleFilterChange('country', e.target.value)}
              >
                <MenuItem value="">
                  <em>All Countries</em>
                </MenuItem>
                {filterOptions.countries.map((country) => (
                  <MenuItem key={country} value={country}>
                    {country}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="city-label">City</InputLabel>
              <Select
                labelId="city-label"
                id="city-select"
                value={filters.city}
                label="City"
                onChange={(e) => handleFilterChange('city', e.target.value)}
              >
                <MenuItem value="">
                  <em>All Cities</em>
                </MenuItem>
                {filterOptions.cities.map((city) => (
                  <MenuItem key={city} value={city}>
                    {city}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Divider />

        {/* Search */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Search Venue
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by venue name..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleApplyFilters();
              }
            }}
          />
        </Box>

        <Divider />

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={handleApplyFilters}
            startIcon={<FilterList />}
          >
            Apply Filters
          </Button>
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            onClick={handleClearFilters}
            startIcon={<Clear />}
          >
            Clear
          </Button>
        </Box>

        {/* Active Filters Count */}
        {(filters.startDate || filters.endDate || filters.categories.length > 0 ||
          filters.country || filters.city || filters.search) && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {[
                filters.startDate ? 1 : 0,
                filters.endDate ? 1 : 0,
                filters.categories.length,
                filters.country ? 1 : 0,
                filters.city ? 1 : 0,
                filters.search ? 1 : 0
              ].reduce((a, b) => a + b, 0)} filter(s) active
            </Typography>
          </Box>
        )}
      </Box>
    </LocalizationProvider>
  );
}

export default FilterPanel;
