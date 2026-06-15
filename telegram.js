const Telegram = {
  _proxyUrl: '',

  init() {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      this._proxyUrl = '/api/telegram';
    }
  },

  async sendMessage(token, chatId, text) {
    const body = { chat_id: chatId, text, parse_mode: 'HTML' };

    if (this._proxyUrl) {
      const res = await fetch(this._proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, method: 'sendMessage', body })
      });
      return res.json();
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  },

  async sendReminder(token, chatId) {
    const msg = '🎬 Время снять новый Reels!\n\nОткройте Reels Planner и получите свежие идеи для контента.';
    return this.sendMessage(token, chatId, msg);
  },

  async testConnection(token, chatId) {
    return this.sendMessage(token, chatId, '✅ Бот подключен! Напоминания будут приходить в выбранные дни.');
  },

  startReminders(token, chatId, filmDays, hour = 10, minute = 0) {
    this.stopReminders();

    const check = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const msk = new Date(utc + 3 * 60 * 60000);
      const day = msk.getDay();
      const h = msk.getHours();
      const m = msk.getMinutes();

      const lastSent = localStorage.getItem('rp_last_sent');
      const todayKey = `${msk.toDateString()}-${h}-${m}`;

      if (filmDays.includes(day) && h === hour && m === minute && lastSent !== todayKey) {
        localStorage.setItem('rp_last_sent', todayKey);
        this.sendReminder(token, chatId).then(r => {
          console.log('Reminder sent:', r);
        }).catch(e => {
          console.error('Reminder failed:', e);
        });
      }
    };

    this._reminderInterval = setInterval(check, 15000);
    console.log('Reminders started:', { filmDays, hour, minute });
  },

  stopReminders() {
    if (this._reminderInterval) {
      clearInterval(this._reminderInterval);
      this._reminderInterval = null;
    }
    localStorage.removeItem('rp_last_sent');
  }
};
