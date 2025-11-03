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
      console.log('Has function calls?', !!result.response.functionCalls);
      console.log('Function calls length:', result.response.functionCalls?.length || 0);

      // Handle function calls
      while (result.response.functionCalls && result.response.functionCalls.length > 0) {
        const functionCall = result.response.functionCalls[0];
        console.log('Function call:', JSON.stringify(functionCall, null, 2));

        if (functionCall.name === 'query_checkins') {
          try {
            // Execute query with user scoping
            const queryResults = await queryBuilder.executeQuery(
              functionCall.args,
              userId
            );

            console.log('Query results:', JSON.stringify(queryResults, null, 2));

            // Send results back to AI
            result = await chat.sendMessage([{
              functionResponse: {
                name: 'query_checkins',
                response: { results: queryResults }
              }
            }]);
          } catch (queryError) {
            console.error('Query execution error:', queryError);

            // Send error to AI so it can respond appropriately
            result = await chat.sendMessage([{
              functionResponse: {
                name: 'query_checkins',
                response: { error: queryError.message }
              }
            }]);
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
