import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Autocomplete,
  Link,
  Checkbox
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { FilterList, Clear, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { getFilterOptions } from '../services/api';

// Custom listbox component for category dropdown with search and actions
const CustomCategoryListbox = React.forwardRef(function CustomCategoryListbox(props, ref) {
  const {
    searchFilteredCount,
    selectedCategories,
    onSelectAll,
    onClear,
    hasSearchTerm,
    ...other
  } = props;

  return (
    <Box>
      {/* Header with actions and counter */}
      <Box sx={{
        p: 2,
        pb: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Link
            component="button"
            variant="body2"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelectAll();
            }}
            sx={{ cursor: 'pointer' }}
          >
            Select all
          </Link>
          <Typography variant="body2" color="text.secondary">·</Typography>
          <Link
            component="button"
            variant="body2"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClear();
            }}
            sx={{ cursor: 'pointer' }}
          >
            Clear
          </Link>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Displaying {searchFilteredCount}
        </Typography>
      </Box>

      {/* Options list */}
      {searchFilteredCount === 0 && hasSearchTerm ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No categories found
          </Typography>
        </Box>
      ) : (
        <Box
          ref={ref}
          {...other}
          component="ul"
          sx={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            maxHeight: '300px',
            overflow: 'auto',
            ...other.sx
          }}
        />
      )}
    </Box>
  );
});

function FilterPanel({ onFilterChange, initialFilters = {}, comparisonModeActive = false, isExpanded = false, onToggleExpand, token }) {
  const [filters, setFilters] = useState({
    startDate: initialFilters.startDate || null,
    endDate: initialFilters.endDate || null,
    categories: initialFilters.categories || [],
    country: initialFilters.country || '',
    city: initialFilters.city || '',
    search: initialFilters.search || ''
  });

  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  const [filterOptions, setFilterOptions] = useState({
    countries: [],
    cities: [],
    categories: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter categories based on search term
  const searchFilteredCategories = filterOptions.categories.filter(cat =>
    cat.toLowerCase().includes(categorySearchTerm.toLowerCase())
  );

  // Only show categories matching the search (don't include non-matching selected items)
  const filteredCategories = categorySearchTerm
    ? searchFilteredCategories
    : filterOptions.categories;

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = {};
        if (token) {
          params.token = token;
        }
        const options = await getFilterOptions(params);
        setFilterOptions(options);
      } catch (err) {
        console.error('Failed to load filter options:', err);
        setError('Failed to load filter options. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadFilterOptions();
  }, [token]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCategoryChange = (event, newValue) => {
    setFilters(prev => ({
      ...prev,
      categories: newValue
    }));
  };

  const handleSelectAllCategories = () => {
    // Merge search results with existing selections (no duplicates)
    const newSelections = [...new Set([...filters.categories, ...searchFilteredCategories])];
    setFilters(prev => ({
      ...prev,
      categories: newSelections
    }));
  };

  const handleClearCategories = () => {
    setFilters(prev => ({
      ...prev,
      categories: []
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
          <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
            Filters
          </Typography>
          {onToggleExpand && (
            <Tooltip title={isExpanded ? "Collapse" : "Expand Full Screen"}>
              <IconButton onClick={onToggleExpand} size="small">
                {isExpanded ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Tooltip>
          )}
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
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={filteredCategories}
            value={filters.categories}
            inputValue={categorySearchTerm}
            onInputChange={(event, newInputValue) => {
              setCategorySearchTerm(newInputValue);
            }}
            onChange={handleCategoryChange}
            onClose={() => setCategorySearchTerm('')}
            filterOptions={(options) => options}
            renderTags={() => null}
            renderInput={(params) => (
              <TextField
                {...params}
                label={filters.categories.length > 0 ? `${filters.categories.length} selected` : "Select Categories"}
                size="small"
                placeholder={filters.categories.length === 0 ? "Search and select..." : ""}
              />
            )}
            ListboxComponent={(listboxProps) => (
              <CustomCategoryListbox
                {...listboxProps}
                searchFilteredCount={searchFilteredCategories.length}
                selectedCategories={filters.categories}
                onSelectAll={handleSelectAllCategories}
                onClear={handleClearCategories}
                hasSearchTerm={!!categorySearchTerm}
              />
            )}
            renderOption={(props, option, { selected }) => {
              const { key, ...otherProps } = props;
              return (
                <Box
                  component="li"
                  {...otherProps}
                  key={option}
                  sx={{
                    display: 'flex !important',
                    alignItems: 'center',
                    '& .MuiCheckbox-root': {
                      opacity: selected ? 1 : 0,
                      transition: 'opacity 0.2s'
                    },
                    '&:hover .MuiCheckbox-root': {
                      opacity: 1
                    }
                  }}
                >
                  <Checkbox
                    checked={selected}
                    sx={{ mr: 1 }}
                  />
                  {option}
                </Box>
              );
            }}
            isOptionEqualToValue={(option, value) => option === value}
          />
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
