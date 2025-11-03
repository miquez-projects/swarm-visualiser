const STORAGE_KEYS = {
  MESSAGES: 'copilot_chat_history',
  STATE: 'copilot_state'
};

const MAX_MESSAGES = 50; // Keep last 50 messages

/**
 * Save messages to localStorage
 */
export const saveMessages = (messages) => {
  try {
    const recent = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(recent));
  } catch (error) {
    console.error('Failed to save messages:', error);
  }
};

/**
 * Load messages from localStorage
 */
export const loadMessages = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load messages:', error);
    return [];
  }
};

/**
 * Clear all messages
 */
export const clearMessages = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
  } catch (error) {
    console.error('Failed to clear messages:', error);
  }
};

/**
 * Save copilot UI state
 */
export const saveCopilotState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save copilot state:', error);
  }
};

/**
 * Load copilot UI state
 */
export const loadCopilotState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.STATE);
    return stored ? JSON.parse(stored) : { isOpen: false, isExpanded: false };
  } catch (error) {
    console.error('Failed to load copilot state:', error);
    return { isOpen: false, isExpanded: false };
  }
};
