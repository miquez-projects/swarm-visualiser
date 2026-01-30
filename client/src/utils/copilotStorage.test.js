import {
  saveMessages,
  loadMessages,
  clearMessages,
  saveCopilotState,
  loadCopilotState
} from './copilotStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('copilotStorage', () => {
  describe('messages', () => {
    it('round-trips messages through localStorage', () => {
      const messages = [{ role: 'user', text: 'hello' }, { role: 'bot', text: 'hi' }];
      saveMessages(messages);
      expect(loadMessages()).toEqual(messages);
    });

    it('returns empty array when no messages saved', () => {
      expect(loadMessages()).toEqual([]);
    });

    it('limits to 50 messages', () => {
      const messages = Array.from({ length: 60 }, (_, i) => ({ id: i }));
      saveMessages(messages);
      const loaded = loadMessages();
      expect(loaded).toHaveLength(50);
      expect(loaded[0].id).toBe(10);
    });

    it('clearMessages removes stored messages', () => {
      saveMessages([{ text: 'test' }]);
      clearMessages();
      expect(loadMessages()).toEqual([]);
    });

    it('returns empty array when localStorage contains malformed JSON', () => {
      localStorage.setItem('copilot_chat_history', '{not valid json!!!');
      expect(loadMessages()).toEqual([]);
    });
  });

  describe('copilot state', () => {
    it('round-trips copilot state', () => {
      const state = { isOpen: true, isExpanded: true };
      saveCopilotState(state);
      expect(loadCopilotState()).toEqual(state);
    });

    it('returns default state when nothing saved', () => {
      expect(loadCopilotState()).toEqual({ isOpen: false, isExpanded: false });
    });
  });
});
