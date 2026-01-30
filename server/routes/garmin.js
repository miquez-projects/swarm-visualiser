const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const garminJsonParser = require('../services/garminJsonParser');
const GarminDailySteps = require('../models/garminDailySteps');
const GarminDailyHeartRate = require('../models/garminDailyHeartRate');
const GarminDailySleep = require('../models/garminDailySleep');
const GarminDailyCalories = require('../models/garminDailyCalories');

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50 // Max 50 files per upload
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

/**
 * POST /api/garmin/upload
 * Upload Garmin data dump JSON files
 * Accepts UDS files and sleep data files
 */
router.post('/upload', authenticateToken, upload.array('files', 50), async (req, res) => {
  try {
    const userId = req.user.id;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`[GARMIN ROUTE] Processing ${files.length} files for user ${userId}`);

    const results = {
      totalFiles: files.length,
      processed: 0,
      stepsRecords: 0,
      heartRateRecords: 0,
      sleepRecords: 0,
      caloriesRecords: 0,
      skippedRecords: 0,
      errors: []
    };

    // Process each file
    for (const file of files) {
      try {
        const content = file.buffer.toString('utf-8');
        const filename = file.originalname;

        console.log(`[GARMIN ROUTE] Processing file: ${filename}`);

        // Determine file type and parse accordingly
        if (filename.includes('sleepData')) {
          // Parse sleep data file
          const rawData = JSON.parse(content);
          const rawCount = rawData.length;
          const sleepData = await garminJsonParser.parseSleepFile(content);
          const validCount = sleepData.length;

          // Track skipped records (those with null/missing dates)
          const skipped = rawCount - validCount;
          if (skipped > 0) {
            results.skippedRecords += skipped;
            console.log(`[GARMIN ROUTE] Skipped ${skipped} sleep record(s) with null/missing dates in ${filename}`);
          }

          // Insert sleep records
          for (const record of sleepData) {
            await GarminDailySleep.upsert({ ...record, user_id: userId });
            results.sleepRecords++;
          }
        } else if (filename.startsWith('UDSFile')) {
          // Parse UDS file (contains steps, heart rate, and calories)
          const udsData = await garminJsonParser.parseUDSFile(content);

          // Insert steps records
          for (const record of udsData.steps) {
            await GarminDailySteps.upsert({ ...record, user_id: userId });
            results.stepsRecords++;
          }

          // Insert heart rate records
          for (const record of udsData.heartRate) {
            await GarminDailyHeartRate.upsert({ ...record, user_id: userId });
            results.heartRateRecords++;
          }

          // Insert calories records
          for (const record of udsData.calories) {
            await GarminDailyCalories.upsert({ ...record, user_id: userId });
            results.caloriesRecords++;
          }
        } else {
          console.log(`[GARMIN ROUTE] Skipping unknown file type: ${filename}`);
          results.errors.push(`Skipped unknown file type: ${filename}`);
          continue;
        }

        results.processed++;
      } catch (fileError) {
        console.error(`[GARMIN ROUTE] Error processing file ${file.originalname}:`, fileError);
        results.errors.push(`${file.originalname}: ${fileError.message}`);
      }
    }

    console.log(`[GARMIN ROUTE] Upload complete for user ${userId}:`, results);

    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('[GARMIN ROUTE] Upload error:', error);
    res.status(500).json({ error: 'Failed to process uploads' });
  }
});

module.exports = router;
