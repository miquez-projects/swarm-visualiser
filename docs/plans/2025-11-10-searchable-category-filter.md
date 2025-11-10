# Searchable Category Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add search, "Select All", and "Clear" functionality to the category filter dropdown to help users easily select multiple related categories.

**Architecture:** Replace existing Material-UI Select component with Autocomplete component that has a custom ListboxComponent. The custom listbox adds a search field and action buttons at the top of the dropdown menu.

**Tech Stack:** React, Material-UI (Autocomplete, TextField, Link), existing FilterPanel component

---

## Task 1: Add Autocomplete Import and Search State

**Files:**
- Modify: `client/src/components/FilterPanel.jsx`

**Step 1: Add Autocomplete import**

Find the Material-UI imports at the top of the file (lines 2-18) and add `Autocomplete` to the import list:

```javascript
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
  Alert,
  IconButton,
  Tooltip,
  Autocomplete,
  Link
} from '@mui/material';
```

Also add SearchIcon to the icon imports (line 22):

```javascript
import { FilterList, Clear, Fullscreen, FullscreenExit, Search } from '@mui/icons-material';
```

**Step 2: Add search state**

Find the state declarations in the FilterPanel component (lines 37-53) and add the category search state after the `filters` state:

```javascript
const [filters, setFilters] = useState({
  startDate: initialFilters.startDate || null,
  endDate: initialFilters.endDate || null,
  categories: initialFilters.categories || [],
  country: initialFilters.country || '',
  city: initialFilters.city || '',
  search: initialFilters.search || ''
});

const [categorySearchTerm, setCategorySearchTerm] = useState('');
```

**Step 3: Add filtered categories computed value**

After the state declarations and before the useEffect (around line 54), add:

```javascript
// Filter categories based on search term
const filteredCategories = filterOptions.categories.filter(cat =>
  cat.toLowerCase().includes(categorySearchTerm.toLowerCase())
);
```

**Step 4: Verify changes**

Check that:
- Autocomplete and Link are imported from @mui/material
- Search icon is imported from @mui/icons-material
- categorySearchTerm state is added
- filteredCategories computed value is added

**Step 5: Commit**

```bash
git add client/src/components/FilterPanel.jsx
git commit -m "feat(filters): Add Autocomplete imports and category search state

Add state and imports needed for searchable category filter:
- Import Autocomplete and Link from MUI
- Import Search icon
- Add categorySearchTerm state for search functionality
- Add filteredCategories computed value

Part 1 of searchable category filter implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Create Custom Listbox Component

**Files:**
- Modify: `client/src/components/FilterPanel.jsx`

**Step 1: Create CustomCategoryListbox component**

Add this component before the FilterPanel component definition (around line 35, right after the MenuProps definition):

```javascript
// Custom listbox component for category dropdown with search and actions
const CustomCategoryListbox = React.forwardRef(function CustomCategoryListbox(props, ref) {
  const {
    categorySearchTerm,
    setCategorySearchTerm,
    filteredCategories,
    selectedCategories,
    onSelectAll,
    onClear,
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
            onClick={(e) => {
              e.preventDefault();
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
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
            sx={{ cursor: 'pointer' }}
          >
            Clear
          </Link>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Displaying {filteredCategories.length}
        </Typography>
      </Box>

      {/* Search field */}
      <Box sx={{ p: 2, pt: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search categories..."
          value={categorySearchTerm}
          onChange={(e) => setCategorySearchTerm(e.target.value)}
          InputProps={{
            endAdornment: <Search sx={{ color: 'text.secondary' }} />
          }}
        />
      </Box>

      {/* Options list */}
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
    </Box>
  );
});
```

**Step 2: Verify component structure**

Check that CustomCategoryListbox:
- Is a forwardRef component
- Accepts all required props
- Has header with actions and counter
- Has search field
- Renders options list with ref

**Step 3: Commit**

```bash
git add client/src/components/FilterPanel.jsx
git commit -m "feat(filters): Create CustomCategoryListbox component

Add custom listbox wrapper component for category Autocomplete:
- Header with 'Select all' and 'Clear' action links
- Display counter showing filtered category count
- Search field with search icon
- Options list container with scroll

Part 2 of searchable category filter implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add Action Handlers

**Files:**
- Modify: `client/src/components/FilterPanel.jsx`

**Step 1: Update handleCategoryChange for Autocomplete**

Find the existing `handleCategoryChange` function (around line 85) and replace it:

```javascript
// Before
const handleCategoryChange = (event) => {
  const value = event.target.value;
  setFilters(prev => ({
    ...prev,
    categories: typeof value === 'string' ? value.split(',') : value
  }));
};

// After
const handleCategoryChange = (event, newValue) => {
  setFilters(prev => ({
    ...prev,
    categories: newValue
  }));
};
```

**Step 2: Add Select All handler**

Add this function after `handleCategoryChange`:

```javascript
const handleSelectAllCategories = () => {
  // Merge filtered categories with existing selections (no duplicates)
  const newSelections = [...new Set([...filters.categories, ...filteredCategories])];
  setFilters(prev => ({
    ...prev,
    categories: newSelections
  }));
};
```

**Step 3: Add Clear handler**

Add this function after `handleSelectAllCategories`:

```javascript
const handleClearCategories = () => {
  setFilters(prev => ({
    ...prev,
    categories: []
  }));
};
```

**Step 4: Verify handlers**

Check that:
- handleCategoryChange accepts (event, newValue) signature
- handleSelectAllCategories merges selections correctly
- handleClearCategories clears categories array

**Step 5: Commit**

```bash
git add client/src/components/FilterPanel.jsx
git commit -m "feat(filters): Add category action handlers

Add handlers for category dropdown actions:
- Update handleCategoryChange for Autocomplete API (event, newValue)
- Add handleSelectAllCategories to select all filtered items
- Add handleClearCategories to clear all selections

Part 3 of searchable category filter implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Replace Select with Autocomplete

**Files:**
- Modify: `client/src/components/FilterPanel.jsx`

**Step 1: Replace the categories Select component**

Find the Categories section (lines 207-237) and replace the entire FormControl block:

```javascript
// Before (lines 207-237)
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

// After
<Box>
  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
    Categories
  </Typography>
  <Autocomplete
    multiple
    disableCloseOnSelect
    options={filteredCategories}
    value={filters.categories}
    onChange={handleCategoryChange}
    renderTags={(value, getTagProps) =>
      value.map((option, index) => (
        <Chip
          key={option}
          label={option}
          size="small"
          {...getTagProps({ index })}
        />
      ))
    }
    renderInput={(params) => (
      <TextField
        {...params}
        label="Select Categories"
        size="small"
        placeholder={filters.categories.length === 0 ? "Search and select..." : ""}
      />
    )}
    ListboxComponent={(listboxProps) => (
      <CustomCategoryListbox
        {...listboxProps}
        categorySearchTerm={categorySearchTerm}
        setCategorySearchTerm={setCategorySearchTerm}
        filteredCategories={filteredCategories}
        selectedCategories={filters.categories}
        onSelectAll={handleSelectAllCategories}
        onClear={handleClearCategories}
      />
    )}
    renderOption={(props, option) => (
      <li {...props} key={option}>
        {option}
      </li>
    )}
    isOptionEqualToValue={(option, value) => option === value}
  />
</Box>
```

**Step 2: Remove unused imports**

The FormControl, InputLabel, Select, MenuItem, and OutlinedInput imports are no longer needed for categories (still used by country/city). Keep them for now.

The MenuProps constant (lines 25-34) is also no longer needed. Remove it:

```javascript
// Remove these lines (25-34)
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
```

**Step 3: Verify replacement**

Check that:
- Select component is completely replaced with Autocomplete
- All props are correctly mapped
- CustomCategoryListbox is used as ListboxComponent
- All handlers are wired up correctly
- MenuProps is removed

**Step 4: Test in browser**

Start the dev server if not already running:
```bash
cd client
npm start
```

Navigate to the app and test:
1. Category dropdown opens
2. Search field appears at top
3. Action buttons are visible
4. Categories can be selected

**Step 5: Commit**

```bash
git add client/src/components/FilterPanel.jsx
git commit -m "feat(filters): Replace Select with Autocomplete for categories

Replace standard Select with Autocomplete component:
- Use CustomCategoryListbox as ListboxComponent
- Wire up all action handlers (select all, clear)
- Pass search term and filtered categories
- Remove unused MenuProps constant

Categories dropdown now has search, select all, and clear functionality.

Part 4 of searchable category filter implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Add Empty States

**Files:**
- Modify: `client/src/components/FilterPanel.jsx`

**Step 1: Update CustomCategoryListbox with empty states**

Find the CustomCategoryListbox component and update the options list section to handle empty states:

```javascript
// Replace the "Options list" section in CustomCategoryListbox
{/* Options list */}
{filteredCategories.length === 0 ? (
  <Box sx={{ p: 3, textAlign: 'center' }}>
    <Typography variant="body2" color="text.secondary">
      {categorySearchTerm ? 'No categories found' : 'No categories available'}
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
```

**Step 2: Test empty states**

In browser:
1. Search for a non-existent category (e.g., "zzzzz")
2. Verify "No categories found" message appears
3. Clear search and verify list returns

**Step 3: Commit**

```bash
git add client/src/components/FilterPanel.jsx
git commit -m "feat(filters): Add empty states to category dropdown

Add empty state handling to CustomCategoryListbox:
- Show 'No categories found' when search has no results
- Show 'No categories available' when category list is empty
- Center aligned with secondary text color

Part 5 of searchable category filter implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Final Testing and Polish

**Files:**
- Test: Manual browser testing

**Step 1: Test basic functionality**

Open the app in browser and test:
- [ ] Dropdown opens and shows all categories
- [ ] Search filters categories as you type (case-insensitive)
- [ ] "Select all" selects all visible/filtered categories
- [ ] "Clear" removes all selections
- [ ] Individual checkbox selection works
- [ ] Chips display selected categories correctly
- [ ] "Displaying X" counter updates correctly

**Step 2: Test search scenarios**

Test these searches:
- [ ] "airport" - should show Airport, Airport Gate, Airport Lounge, etc.
- [ ] "gate" - should show Airport Gate and any other gate categories
- [ ] "AIR" (uppercase) - should match same as "air" (case-insensitive)
- [ ] "zzzzz" - should show "No categories found"

**Step 3: Test edge cases**

- [ ] Search "airport", select all, then search "food" - airport selections should persist
- [ ] Select some categories, click "Clear", search term should stay
- [ ] Click "Select all" with some items already selected - should merge without duplicates
- [ ] Verify selected categories apply correctly when clicking "Apply Filters"
- [ ] Verify map updates with multi-category selection

**Step 4: Test keyboard navigation**

- [ ] Tab navigates through search and options
- [ ] Arrow keys navigate option list
- [ ] Space/Enter toggles checkboxes
- [ ] Escape closes dropdown

**Step 5: Test integration with other filters**

- [ ] Select categories + country filter - both should apply
- [ ] Select categories + date range - both should apply
- [ ] "Clear" button (main clear) should reset categories too

**Step 6: Document any issues**

If any issues found, create a list:
```markdown
## Issues Found
- [ ] Issue 1: Description
- [ ] Issue 2: Description
```

Fix each issue and commit separately.

**Step 7: Final commit (if needed)**

If you made any fixes during testing:

```bash
git add client/src/components/FilterPanel.jsx
git commit -m "fix(filters): Address issues from testing

- Fixed: [describe fix 1]
- Fixed: [describe fix 2]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Completion Checklist

- [ ] Autocomplete and Search icon imports added
- [ ] categorySearchTerm state added
- [ ] filteredCategories computed value added
- [ ] CustomCategoryListbox component created
- [ ] handleCategoryChange updated for Autocomplete API
- [ ] handleSelectAllCategories added
- [ ] handleClearCategories added
- [ ] Select replaced with Autocomplete for categories
- [ ] Empty states added
- [ ] All manual tests passing
- [ ] All commits made with descriptive messages

---

## Notes

**No Backend Changes:** All functionality is client-side filtering and selection.

**No New Dependencies:** Uses existing Material-UI components (Autocomplete is already installed).

**Testing Strategy:** Manual browser testing only - no unit tests needed for this UI enhancement.

**Country and City Filters:** Remain as simple Select dropdowns (not changed in this implementation).
