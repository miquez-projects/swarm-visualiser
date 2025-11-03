const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const sessionManager = require('../services/geminiSessionManager');
const queryBuilder = require('../services/queryBuilder');

/**
 * POST /api/copilot/chat
 * Send a message to the AI copilot
 */
router.post(
  '/chat',
  authenticateToken,
  [
    body('message').isString().notEmpty().withMessage('Message is required'),
    body('conversationHistory').optional().isArray()
  ],
  async (req, res, next) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message, conversationHistory = [] } = req.body;
    const userId = String(req.user.id);

    try {
      // Get or create chat session
      const chat = sessionManager.getOrCreateSession(userId, conversationHistory);

      // Send user message
      let result = await chat.sendMessage(message);

      console.log('AI response candidates:', JSON.stringify(result.response.candidates, null, 2));

      // Extract function calls - try both old and new SDK methods
      let functionCalls = [];
      if (typeof result.response.functionCalls === 'function') {
        functionCalls = result.response.functionCalls() || [];
      } else if (Array.isArray(result.response.functionCalls)) {
        functionCalls = result.response.functionCalls;
      }

      console.log('Extracted function calls:', functionCalls.length);

      // Handle function calls
      while (functionCalls && functionCalls.length > 0) {
        const functionCall = functionCalls.shift();
        console.log('Processing function call:', JSON.stringify(functionCall, null, 2));

        if (functionCall.name === 'get_categories') {
          try {
            // Get list of categories
            const categories = await queryBuilder.getCategories(userId);

            console.log('Categories:', JSON.stringify(categories, null, 2));

            // Send results back to AI
            result = await chat.sendMessage([{
              functionResponse: {
                name: 'get_categories',
                response: { categories }
              }
            }]);

            // Re-extract function calls from new response
            if (typeof result.response.functionCalls === 'function') {
              functionCalls = result.response.functionCalls() || [];
            } else if (Array.isArray(result.response.functionCalls)) {
              functionCalls = result.response.functionCalls || [];
            } else {
              functionCalls = [];
            }
          } catch (categoryError) {
            console.error('Get categories error:', categoryError);

            // Send error to AI
            result = await chat.sendMessage([{
              functionResponse: {
                name: 'get_categories',
                response: {
                  error: 'Failed to fetch categories',
                  message: 'I had trouble getting the category list. Let me try to answer your question anyway.'
                }
              }
            }]);

            functionCalls = [];
          }
        } else if (functionCall.name === 'query_checkins') {
          try {
            // Execute query with user scoping
            const queryResults = await queryBuilder.executeQuery(
              functionCall.args,
              userId
            );

            console.log('Query results:', JSON.stringify(queryResults, null, 2));

            // Send results back to AI with metadata
            const response = {
              results: queryResults.data
            };

            // Add metadata message if results are limited
            if (queryResults.metadata && queryResults.metadata.limited) {
              response.note = queryResults.metadata.message;
            }

            result = await chat.sendMessage([{
              functionResponse: {
                name: 'query_checkins',
                response
              }
            }]);

            // Re-extract function calls from new response
            if (typeof result.response.functionCalls === 'function') {
              functionCalls = result.response.functionCalls() || [];
            } else if (Array.isArray(result.response.functionCalls)) {
              functionCalls = result.response.functionCalls || [];
            } else {
              functionCalls = [];
            }
          } catch (queryError) {
            console.error('Query execution error:', queryError);

            // Send error to AI so it can respond appropriately
            result = await chat.sendMessage([{
              functionResponse: {
                name: 'query_checkins',
                response: {
                  error: 'Query failed',
                  message: 'I encountered an issue accessing your check-in data. Please try rephrasing your question or ask something else.'
                }
              }
            }]);

            functionCalls = [];
          }
        }
      }

      console.log('Final AI response:', result.response.text());

      // Return final response
      res.json({
        response: result.response.text()
      });

    } catch (error) {
      console.error('Copilot error:', error);
      next(error);
    }
  }
);

module.exports = router;
