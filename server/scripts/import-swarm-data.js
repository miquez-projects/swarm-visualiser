require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Checkin = require('../models/checkin');

/**
 * Import Swarm check-in data from JSON export
 * Usage: node scripts/import-swarm-data.js <path-to-export.json>
 */

async function importSwarmData(filePath) {
  console.log('Starting Swarm data import...');
  console.log(`Reading file: ${filePath}`);

  // Read and parse JSON file
  const rawData = fs.readFileSync(filePath, 'utf8');
  const swarmData = JSON.parse(rawData);

  console.log(`Parsed ${swarmData.length} check-ins from file`);

  // Transform Swarm data to our schema
  const checkins = [];
  const skipped = [];

  for (const item of swarmData) {
    try {
      // Validate required fields
      if (!item.venue || !item.venue.name) {
        skipped.push({ reason: 'Missing venue name', item });
        continue;
      }

      if (!item.createdAt) {
        skipped.push({ reason: 'Missing checkin date', item });
        continue;
      }

      // Parse location
      const latitude = item.venue.location?.lat || null;
      const longitude = item.venue.location?.lng || null;

      // Validate coordinates if present
      if (latitude !== null && (latitude < -90 || latitude > 90)) {
        skipped.push({ reason: 'Invalid latitude', item });
        continue;
      }

      if (longitude !== null && (longitude < -180 || longitude > 180)) {
        skipped.push({ reason: 'Invalid longitude', item });
        continue;
      }

      // Parse date
      const checkinDate = new Date(item.createdAt * 1000); // Swarm uses Unix timestamp
      if (isNaN(checkinDate.getTime())) {
        skipped.push({ reason: 'Invalid date', item });
        continue;
      }

      checkins.push({
        venue_id: item.venue.id || null,
        venue_name: item.venue.name,
        venue_category: item.venue.categories?.[0]?.name || 'Unknown',
        latitude,
        longitude,
        checkin_date: checkinDate,
        city: item.venue.location?.city || 'Unknown',
        country: item.venue.location?.country || 'Unknown'
      });
    } catch (error) {
      skipped.push({ reason: error.message, item });
    }
  }

  console.log(`\nValidation complete:`);
  console.log(`  Valid check-ins: ${checkins.length}`);
  console.log(`  Skipped: ${skipped.length}`);

  if (skipped.length > 0) {
    console.log('\nSkipped records:');
    skipped.slice(0, 10).forEach(({ reason, item }, index) => {
      console.log(`  ${index + 1}. ${reason} - ${JSON.stringify(item).slice(0, 100)}...`);
    });
    if (skipped.length > 10) {
      console.log(`  ... and ${skipped.length - 10} more`);
    }
  }

  // Import in batches of 1000
  const batchSize = 1000;
  let totalInserted = 0;

  for (let i = 0; i < checkins.length; i += batchSize) {
    const batch = checkins.slice(i, i + batchSize);
    console.log(`\nInserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(checkins.length / batchSize)}...`);

    const inserted = await Checkin.bulkInsert(batch);
    totalInserted += inserted;
    console.log(`  Inserted ${inserted} records`);
  }

  console.log(`\n✅ Import complete!`);
  console.log(`  Total inserted: ${totalInserted}`);
  console.log(`  Total skipped: ${skipped.length}`);

  // Write skipped records to file for review
  if (skipped.length > 0) {
    const skippedFilePath = path.join(__dirname, 'import-skipped.json');
    fs.writeFileSync(skippedFilePath, JSON.stringify(skipped, null, 2));
    console.log(`  Skipped records saved to: ${skippedFilePath}`);
  }

  process.exit(0);
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/import-swarm-data.js <path-to-export.json>');
  console.error('\nExample:');
  console.error('  node scripts/import-swarm-data.js ~/Downloads/swarm-export.json');
  process.exit(1);
}

const filePath = path.resolve(args[0]);

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

importSwarmData(filePath).catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
});
