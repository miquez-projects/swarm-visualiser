# Searchable Category Filter - Design Document

**Date:** November 10, 2025
**Status:** Approved
**Author:** Claude Code (via brainstorming session)

## Problem Statement

Foursquare categorizes related venues under different category names (e.g., "Airport", "Airport Gate", "Airport Lounge", "Airport Terminal"). When users filter to a single category like "Airports", they miss all the related venues with different category labels. Users need an easy way to search for and select multiple related categories at once.

## Solution Overview

Enhance the category filter dropdown with search functionality, "Select All" and "Clear" actions. Users can search for keywords (e.g., "airport"), see all matching categories, and select all of them with one click.

## Requirements

### Functional Requirements
- Search field inside category dropdown filters categories by substring match (case-insensitive)
- "Select all" button selects all currently visible (filtered) categories
- "Clear" button deselects all selected categories while preserving search term
- Display count shows number of visible categories ("Displaying X")
- Manual checkbox selection still works alongside search and bulk actions
- Search and actions only apply to categories dropdown (country and city stay simple)

### Non-Functional Requirements
- Maintain existing UI patterns and Material-UI styling
- No new package dependencies required
- Minimal changes to existing filter logic
- Keyboard navigation support (Tab, Arrow keys, Space, Enter, Escape)

## Architecture

### Approach Selected: MUI Autocomplete Component

**Rationale:** Material-UI's Autocomplete component has built-in multi-select, chip display, and supports custom rendering. We'll use a custom ListboxComponent to add search field and action buttons.

**Trade-offs:**
- ✅ Built-in search and multi-select support
- ✅ Consistent with Material-UI design system
- ✅ Well-documented and tested component
- ✅ No new dependencies needed
- ⚠️ Different API from Select (requires component migration)

### Component Structure

**Replace existing Select with Autocomplete:**

```jsx
// Before (lines 214-235 in FilterPanel.jsx)
<Select
  multiple
  value={filters.categories}
  onChange={handleCategoryChange}
  MenuProps={MenuProps}
>
  {filterOptions.categories.map((category) => (
    <MenuItem key={category} value={category}>
      {category}
    </MenuItem>
  ))}
</Select>

// After
<Autocomplete
  multiple
  disableCloseOnSelect
  options={filteredCategories}
  value={filters.categories}
  onChange={handleCategoryChange}
  renderTags={(value, getTagProps) =>
    value.map((option, index) => (
      <Chip key={option} label={option} size="small" {...getTagProps({ index })} />
    ))
  }
  renderInput={(params) => (
    <TextField {...params} label="Select Categories" size="small" />
  )}
  ListboxComponent={CustomCategoryListbox}
/>
```

**Custom Listbox Component:**

New component that wraps the standard listbox with search field and actions.

```jsx
const CustomCategoryListbox = React.forwardRef(function CustomCategoryListbox(props, ref) {
  const { children, ...other } = props;

  return (
    <Box ref={ref}>
      {/* Header with actions and counter */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Link component="button" onClick={handleSelectAll}>Select all</Link>
          <Typography>·</Typography>
          <Link component="button" onClick={handleClear}>Clear</Link>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Displaying {filteredCount}
        </Typography>
      </Box>

      {/* Search field */}
      <Box sx={{ px: 2, pb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search categories..."
          value={categorySearchTerm}
          onChange={(e) => setCategorySearchTerm(e.target.value)}
          InputProps={{
            endAdornment: <SearchIcon />
          }}
        />
      </Box>

      {/* Option list */}
      <ul {...other}>{children}</ul>
    </Box>
  );
});
```

## Search and Filter Logic

### Search Implementation

**State Management:**
```javascript
const [categorySearchTerm, setCategorySearchTerm] = useState('');

// Filter categories based on search
const filteredCategories = filterOptions.categories.filter(cat =>
  cat.toLowerCase().includes(categorySearchTerm.toLowerCase())
);
```

**Search Behavior:**
- Case-insensitive substring matching
- Matches anywhere in category name
- Examples:
  - "airport" matches: "Airport", "Airport Gate", "Airport Lounge"
  - "gate" matches: "Airport Gate", "Water Gate Park"
  - "air" matches: "Airport", "Hair Salon", "Fairground"

### Action Buttons

**Select All:**
- Adds all categories from `filteredCategories` to `filters.categories`
- Merges with existing selections (no duplicates)
- Updates immediately without closing dropdown

```javascript
const handleSelectAll = () => {
  const newSelections = [...new Set([...filters.categories, ...filteredCategories])];
  setFilters(prev => ({ ...prev, categories: newSelections }));
};
```

**Clear:**
- Removes all selected categories
- Preserves search term (doesn't reset search field)
- Useful for starting over while keeping search context

```javascript
const handleClear = () => {
  setFilters(prev => ({ ...prev, categories: [] }));
};
```

## UI Layout and Styling

### Dropdown Structure

```
┌─────────────────────────────────────────┐
│ Select all · Clear          Displaying 6│
├─────────────────────────────────────────┤
│ [Search field with icon]                │
├─────────────────────────────────────────┤
│ ☑ Airport                               │
│ ☑ Airport Gate                          │
│ ☑ Airport Lounge                        │
│ ☐ Art Gallery                           │
│   ...                                   │
└─────────────────────────────────────────┘
```

### Visual Elements

**Header Row:**
- Left side: Action links ("Select all" and "Clear") separated by middle dot (·)
- Right side: Counter text "Displaying X" in secondary color
- Padding: 16px all sides
- Background: Matches dropdown paper background

**Search Field:**
- Full width with 16px horizontal padding
- Search icon on the right (endAdornment)
- Placeholder: "Search categories..."
- Size: small (consistent with other inputs)

**Option List:**
- Checkboxes with category labels
- Max height: 300px with vertical scroll
- Standard MUI list styling

### Styling Approach

- Use Material-UI components: `Box`, `Link`, `TextField`, `Typography`
- Consistent spacing with existing FilterPanel (16px padding)
- Colors match theme (primary for links, text.secondary for counter)
- Flexbox for header layout

## User Interactions and Edge Cases

### User Flow

1. User clicks category dropdown → Opens with all categories visible
2. User types "airport" in search → List filters to show only matching categories
3. User clicks "Select all" → All visible (filtered) categories get selected
4. User clicks "Clear" → All selections removed, search term stays
5. User can manually check/uncheck individual items at any time
6. Clicking outside or pressing Escape closes dropdown and applies selections

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| **No search results** | Show "No categories found" message when search has no matches |
| **All items already selected** | "Select all" button stays enabled (merges, no duplicates) |
| **Nothing selected** | "Clear" button could be disabled (optional enhancement) |
| **Empty category list** | Show "No categories available" if `filterOptions.categories` is empty |
| **Search while items selected** | Search filters the list but doesn't affect existing selections (selected items stay selected even if filtered out of view) |

### Keyboard Support

Built-in Autocomplete keyboard support:
- **Tab:** Navigate through search field and options
- **Arrow keys:** Navigate options
- **Space/Enter:** Toggle checkboxes
- **Escape:** Close dropdown

## Implementation Details

### Files to Modify

**Modified Files:**
- `client/src/components/FilterPanel.jsx` - Replace Select with Autocomplete for categories (lines 207-237)

**New Components:**
- `CustomCategoryListbox` - Inline component in FilterPanel.jsx (or separate file if preferred)

### Dependencies

**No new packages needed:**
- `Autocomplete` is part of `@mui/material` (already installed)
- `SearchIcon` is part of `@mui/icons-material` (already installed)

### State Changes

```javascript
// Add to FilterPanel component
const [categorySearchTerm, setCategorySearchTerm] = useState('');

// Computed value
const filteredCategories = filterOptions.categories.filter(cat =>
  cat.toLowerCase().includes(categorySearchTerm.toLowerCase())
);
```

### Handler Updates

**Category change handler:**
```javascript
// Update handleCategoryChange to work with Autocomplete
const handleCategoryChange = (event, newValue) => {
  setFilters(prev => ({
    ...prev,
    categories: newValue
  }));
};
```

**New handlers:**
```javascript
const handleSelectAllCategories = () => {
  const newSelections = [...new Set([...filters.categories, ...filteredCategories])];
  setFilters(prev => ({ ...prev, categories: newSelections }));
};

const handleClearCategories = () => {
  setFilters(prev => ({ ...prev, categories: [] }));
};
```

### Implementation Complexity

**Level:** Low-Medium

**Main Tasks:**
1. Replace Select with Autocomplete
2. Create CustomCategoryListbox component
3. Add search state and filtering logic
4. Wire up action button handlers
5. Test all interactions

**Estimated Effort:** 2-3 hours

## Testing Strategy

### Manual Browser Testing

**Basic Functionality:**
- [ ] Dropdown opens and shows all categories
- [ ] Search filters categories as you type
- [ ] "Select all" selects all visible categories
- [ ] "Clear" removes all selections
- [ ] Individual checkbox selection works
- [ ] Chips display selected categories correctly
- [ ] Dropdown closes on outside click/Escape

**Edge Cases:**
- [ ] Search with no results shows empty state
- [ ] Empty category list shows appropriate message
- [ ] Select all with existing selections merges correctly
- [ ] Clear with no selections works (or is disabled)
- [ ] Search while items selected preserves hidden selections

**Keyboard Navigation:**
- [ ] Tab navigates through search and options
- [ ] Arrow keys navigate option list
- [ ] Space/Enter toggles checkboxes
- [ ] Escape closes dropdown

**Integration:**
- [ ] Selected categories applied on "Apply Filters" button
- [ ] Category filter works with other filters (country, city, date)
- [ ] Map updates correctly with multi-category selection
- [ ] Clearing all filters resets categories

### No Unit Tests Required

Manual testing sufficient for this UI enhancement due to:
- Heavy reliance on Material-UI built-in behavior
- Visual/interactive nature of the feature
- Low complexity of custom logic

## Success Criteria

- ✅ Users can search for categories by keyword
- ✅ Users can select all matching categories with one click
- ✅ Users can clear selections while keeping search context
- ✅ UI matches provided design reference
- ✅ Works seamlessly with existing filter functionality
- ✅ No new dependencies required
- ✅ Keyboard navigation fully functional

## Future Enhancements

**Potential improvements (not in scope):**
- Save category search presets ("My Airports", "My Food Places")
- Make country and city searchable if needed
- Add category grouping/hierarchy (if Foursquare provides taxonomy data)
- Persist search term in component state across dropdown open/close
- Add "Deselect all" (separate from "Clear") to deselect only visible items

## References

- Material-UI Autocomplete: https://mui.com/material-ui/react-autocomplete/
- Design inspiration: Screenshot provided by user (searchable multi-select pattern)
