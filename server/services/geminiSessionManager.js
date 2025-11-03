const { createModel } = require('./geminiService');

// In-memory session storage: userId -> { chat, lastActivity }
const activeSessions = new Map();

// Session timeout: 30 minutes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

class GeminiSessionManager {
  /**
   * Get existing session or create new one with history
   */
  getOrCreateSession(userId, conversationHistory = []) {
    const existing = activeSessions.get(userId);

    // Reuse if session exists and is recent
    if (existing && Date.now() - existing.lastActivity < SESSION_TIMEOUT_MS) {
      existing.lastActivity = Date.now();
      return existing.chat;
    }

    // Create new session with history from localStorage
    const model = createModel();
    const chat = model.startChat({
      history: this.formatHistory(conversationHistory)
    });

    activeSessions.set(userId, {
      chat,
      lastActivity: Date.now()
    });

    return chat;
  }

  /**
   * Format conversation history for Gemini API
   */
  formatHistory(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return [];
    }

    return conversationHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
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
    setInterval(() => this.cleanup(), 10 * 60 * 1000); // Every 10 minutes
    console.log('Gemini session cleanup interval started');
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
