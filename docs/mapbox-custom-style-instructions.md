# Creating a Custom Mapbox Studio Style

This guide walks you through creating a custom dark cartographic style in Mapbox Studio that matches our dynamic map styling.

## Why a Custom Style?

The Mapbox Static API only accepts pre-built styles (like `dark-v11`). To get consistent styling between our dynamic maps (which use `mapStyle.js`) and static maps (Day in Life page), we need to create a custom style in Mapbox Studio.

## Step-by-Step Instructions

### 1. Open Mapbox Studio

Go to [https://studio.mapbox.com/](https://studio.mapbox.com/) and sign in with your Mapbox account.

### 2. Create a New Style

1. Click **"New style"**
2. Choose **"Dark"** as the template (this gives us the best starting point)
3. Click **"Customize Dark"**

### 3. Rename Your Style

1. Click the style name at the top (it will say "Dark" or similar)
2. Rename it to: **"Life Visualizer Cartographic"**

### 4. Update Colors

Using the Mapbox Studio interface, update these layer colors:

#### Background / Land
- Find the **"Background"** layer
- Change color to: `#1a2124` (dark teal-gray)

#### Water
- Find **"Water"** layer
- Change fill color to: `#0c1518` (deep teal-navy)

#### Land Use / Parks
- Find **"Landuse"** layers (park, grass, etc.)
- Change fill color to: `#162822` (muted teal-green)

#### Buildings
- Find **"Building"** layer
- Change fill color to: `#232a2a` (teal-tinted gray)

#### Roads
Update road layers with these colors:
- **Motorway/Trunk**: `#2d3535`
- **Primary**: `#283030`
- **Secondary/Tertiary**: `#283030`
- **Street**: `#222a2a`
- **Path**: `#1e2626`

#### Boundaries
- **Country boundaries**: `rgba(45, 154, 140, 0.45)` or `#2d9a8c` at 45% opacity
- **State/Province boundaries**: `rgba(45, 154, 140, 0.28)` or `#2d9a8c` at 28% opacity

#### Labels
Update text colors for place labels:
- **Country labels**: `#6a8585`
- **State labels**: `#5c7575`
- **City labels**: `#7a9595`
- **Town labels**: `#6a8585`
- **Street labels**: `#4d6565`

For all labels, set the **text halo color** to: `rgba(18, 24, 24, 0.85)`

### 5. Publish the Style

1. Click **"Publish"** in the top right
2. Confirm the publish

### 6. Get the Style URL

1. Click **"Share"** in the top right
2. Copy the **Style URL** - it will look like:
   ```
   mapbox://styles/yourusername/abc123xyz
   ```

### 7. Update the Code

See `docs/mapbox-custom-style-integration-plan.md` for the code changes needed.

## Color Reference Table

| Element | Hex Color | Notes |
|---------|-----------|-------|
| Land/Background | `#1a2124` | Teal undertone |
| Water | `#0c1518` | Darker than land |
| Parks | `#162822` | Muted teal-green |
| Buildings | `#232a2a` | Teal-gray |
| Highway | `#2d3535` | Visible roads |
| Major roads | `#283030` | |
| Minor roads | `#222a2a` | |
| Paths | `#1e2626` | |
| Country border | `#2d9a8c` @ 45% | Teal accent |
| State border | `#2d9a8c` @ 28% | Teal accent |
| Country label | `#6a8585` | Teal-gray |
| City label | `#7a9595` | Lighter teal-gray |
| Street label | `#4d6565` | Subtle |
| Label halo | `#181818` @ 85% | Dark teal |

## Tips

- Use the **search** in Mapbox Studio to find layers quickly (e.g., search "water")
- You can **bulk select** similar layers and edit them together
- The **"Components"** panel groups related layers for easier editing
- Preview your changes at different zoom levels before publishing

## Estimated Time

This should take about 15-20 minutes to complete.
