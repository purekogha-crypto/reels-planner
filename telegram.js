const Telegram = {
  baseUrl(token) { return `https://api.telegram.org/bot${token}`; },

  async sendMessage(token, chatId, text) {
    const res = await fetch(`${this.baseUrl(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
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
