const Telegram = {
  _apiUrl: '',

  init() {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      this._apiUrl = '';
    } else {
      this._apiUrl = location.origin;
    }
  },

  async _post(endpoint, body) {
    const url = (this._apiUrl || '') + endpoint;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  },

  async saveSchedule(chatId, filmDays, hour, minute) {
    return this._post('/api/schedule', { chatId, filmDays, hour, minute });
  },

  async testConnection(chatId) {
    return this._post('/api/test', { chatId });
  },

  async sendReminder(chatId) {
    const msg = '🎬 Время снять новый Reels!\n\nОткройте Reels Planner и получите свежие идеи для контента.';
    return this._post('/api/test', { chatId, text: msg });
  }
};
