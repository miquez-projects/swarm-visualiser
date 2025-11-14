# Life visualizer

Let’s start brainstorming a major new feature set for this app. We’ll do it in parts.

# Part 1: Splash screen with optional token input

The app should have a splash screen on first load with an attractive background colour in keeping with Swarm’s orange colour scheme and old logo: https://searchengineland.com/wp-content/seloads/2014/07/swarm-1920-800x450.png

If no token was provided, a token input field should appear after 1 second, with a blinking cursor, and a secondary option to set up a new user (which redirects currently to Foursquare import screen).

If a token was provided, then just the splash screen, and it should automatically disappear with a fadeout after a best practice amount of time (maybe consult Nielsen Norman for the best practice).

# Part 2: Context menu in top nav

We’re adding more and more features in the top nav, so we should move them all under a context menu - maybe a burger menu in the top right.

# Part 3: Swarm check-in photos

I’d like to explore pulling in check-in photos. Check-in photos will appear as a second tab when opening up the details of a venue (first tab being the github-style check-ins grid), with a date and time for each photo.

Think about how the data model and the database needs to change to support this.

# Part 4: Garmin integration

I’d like to pull in Garmin data:

- Activities
    - Duration
    - Calories
    - If the activity is mapped
        - Distance
        - Activity tracklog
- Daily steps
- Daily minimum and maximum heart rate

For Garmin integration, I was looking at these two solutions, but you can suggest others as well - I can’t register into the official Garmin developer programme though:

- https://github.com/santoshyadavdev/garmin-api
- https://github.com/cyberjunky/python-garminconnect

Think about how the data model and the database needs to change to support this.

Mapped Garmin activities should appear as a tracklog on the main globe map as well.

# Part 5: “Day in the life of” feature

We should introduce a new feature accessible from the new context menu in the top nav.

This would allow for the selection of a day from a calendar. 

For each day, it will show a full-page view (similar to the Year in review page in size) with a summary of that day.

Each day has:

- Properties
    - Number of checkins
    - Number of venues
    - Weather at the locations of the check-ins on the given day (country-level is enough, so if all check-ins are in one country , just one weather icon with an indication of the country, the temperature, and whether it was sunny/cloudy) - for larger countries like the US, we can consider region or state level granularity to pull in the weather data
    - There should be a scalable model for pulling in future properties from other data sources (e.g. number of steps)
    - Each property should have a display specification and a location on the screen, ask me for these when it’s relevant
- Events
    - To begin with, checkins
    - There should be a scalable model for future event types, eg. activities from Garmin or Strava
    - Each event type will have a display specification and a location on the screen, ask me for these when it’s relevant

## Day in the life of page anatomy

Top left: Date

Top right: Weather property tile

Below: Additional property tiles

Below: Event tiles

## Property tile

Each property is presented as a tile.

Initial properties to support:

- Weather (pls suggest a data source)
- Daily steps (from Garmin)
- Number of checkins
- Number of activities (from Garmin)
- Heart rate range (min, max) (from Garmin)
- Calories burned (total for the day)

## Event tile

Each event or event group (see below) has its own full width tile on the page.

Events or event groups are ordered chronologically on page.

### Event tile: check-in(s)

A check-in or a group of contiguous check-ins are presented on a map as circles.

Check-ins are connected by a line on the map. Clicking each check-in takes you to the main globe map.

Below the map, a timeline is shown with check-ins from earliest to last left to right.

Under the timeline, under each check-in node, we show the name of the check-in venue and the time.

Only contiguous check-ins (not interrupted by another event type) are presented in a single tile.

If the check-ins presented in the given tile have photos, an icon should indicate this on the check-in node in the timeline. When clicked, a gallery lightbox is shown with the photos.

### Event tile: Garmin mapped activity

A garmin mapped activity should be presented as a tracklog on a map tile.

Above the map, show the activity type and title.

Below the map, in a single row, show distance, time, and calories.

The map should have an icon to take you to the relevant location on the main global map.

Activities should be mapped on the main global map as well.

### Event tile: unmapped Garmin activity

Unmapped Garmin activities should be presented as a data tile, with the following data:

- Activity type
- Activity title
- Calories
- Time