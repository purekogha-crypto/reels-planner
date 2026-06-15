const Telegram = {
  _apiUrl: 'https://reels-planner.onrender.com',

  async _post(endpoint, body) {
    const res = await fetch(this._apiUrl + endpoint, {
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
  }
};
