const { createModel } = require('./geminiService');

// In-memory session storage: userId -> { chat, lastActivity }
const activeSessions = new Map();

// Session timeout: 30 minutes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Maximum number of concurrent sessions to prevent memory leaks
const MAX_SESSIONS = 1000;

class GeminiSessionManager {
  constructor() {
    this.cleanupIntervalId = null;
  }
  /**
   * Validate user ID format
   */
  validateUserId(userId) {
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('Invalid userId: must be a non-empty string');
    }
    if (userId.length > 255) {
      throw new Error('Invalid userId: exceeds maximum length of 255 characters');
    }
  }

  /**
   * Evict least recently used session when MAX_SESSIONS is reached
   */
  evictLRUSession() {
    let oldestUserId = null;
    let oldestActivity = Infinity;

    for (const [userId, session] of activeSessions.entries()) {
      if (session.lastActivity < oldestActivity) {
        oldestActivity = session.lastActivity;
        oldestUserId = userId;
      }
    }

    if (oldestUserId) {
      activeSessions.delete(oldestUserId);
      console.log(`Evicted LRU session for user ${oldestUserId} (last activity: ${new Date(oldestActivity).toISOString()})`);
    }
  }

  /**
   * Get existing session or create new one with history
   */
  getOrCreateSession(userId, conversationHistory = []) {
    // Validate user ID
    this.validateUserId(userId);

    const existing = activeSessions.get(userId);

    // Reuse if session exists and is recent
    if (existing && Date.now() - existing.lastActivity < SESSION_TIMEOUT_MS) {
      existing.lastActivity = Date.now();
      return existing;
    }

    // Check if we need to evict a session before creating a new one
    if (activeSessions.size >= MAX_SESSIONS) {
      this.evictLRUSession();
    }

    // Create new session with history from localStorage
    try {
      const model = createModel();
      const chat = model.startChat({
        history: this.formatHistory(conversationHistory)
      });

      const session = {
        chat,
        historyPosition: 0,  // Track where we are in the Gemini history
        lastActivity: Date.now()
      };

      activeSessions.set(userId, session);

      return session;
    } catch (error) {
      console.error('Failed to create Gemini chat session:', error);
      throw new Error(`Failed to create chat session: ${error.message}`);
    }
  }

  /**
   * Format conversation history for Gemini API
   * Preserves complete content structure including thought signatures
   */
  formatHistory(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return [];
    }

    // Validate conversation history structure
    if (!Array.isArray(conversationHistory)) {
      throw new Error('conversationHistory must be an array');
    }

    return conversationHistory
      .filter((msg, index) => {
        // Skip invalid messages instead of throwing
        if (!msg || typeof msg !== 'object') {
          console.warn(`Skipping invalid message at index ${index}: not an object`);
          return false;
        }
        if (!msg.role || typeof msg.role !== 'string') {
          console.warn(`Skipping invalid message at index ${index}: invalid role`);
          return false;
        }
        if (!['user', 'assistant', 'model'].includes(msg.role)) {
          console.warn(`Skipping invalid message at index ${index}: invalid role value`);
          return false;
        }
        return true;
      })
      .map((msg) => {
        // For assistant messages with complete content, use it directly
        if ((msg.role === 'assistant' || msg.role === 'model') &&
            msg.content &&
            typeof msg.content === 'object' &&
            msg.content.parts) {
          // msg.content is the complete candidates[0].content from Gemini
          // It already has the correct structure with parts and thought signatures
          return {
            role: 'model',
            parts: msg.content.parts
          };
        }

        // For user messages or assistant messages without complete content
        const messageText = typeof msg.content === 'string' ? msg.content :
                           (msg.text || '');

        if (!messageText || messageText.trim().length === 0) {
          console.warn(`Skipping empty message content`);
          return null;
        }

        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: messageText }]
        };
      })
      .filter(msg => msg !== null);
  }

  /**
   * Clear expired sessions (cleanup)
   */
  cleanup() {
    const now = Date.now();
    for (const [userId, session] of activeSessions.entries()) {
      if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
        activeSessions.delete(userId);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  startCleanupInterval() {
    if (this.cleanupIntervalId) {
      console.warn('Cleanup interval already running');
      return;
    }
    this.cleanupIntervalId = setInterval(() => this.cleanup(), 10 * 60 * 1000); // Every 10 minutes
    console.log('Gemini session cleanup interval started');
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanupInterval() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      console.log('Gemini session cleanup interval stopped');
    }
  }

  /**
   * Clear all sessions (for testing)
   */
  clearAllSessions() {
    activeSessions.clear();
  }

  /**
   * Get session count (for monitoring)
   */
  getActiveSessionCount() {
    return activeSessions.size;
  }
}

// Export singleton instance
module.exports = new GeminiSessionManager();
