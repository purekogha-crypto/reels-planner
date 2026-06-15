const Telegram = {
  baseUrl(token) { return `https://api.telegram.org/bot${token}`; },

  async sendMessage(token, chatId, text) {
    await fetch(`${this.baseUrl(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
  },

  async saveData(token, chatId, key, data) {
    const payload = JSON.stringify({ _rp_key: key, data });
    await this.sendMessage(token, chatId, `📦 DATA:${btoa(payload)}`);
  },

  async sendReminder(token, chatId) {
    const msg = '🎬 Время снять новый Reels!\n\nОткройте Reels Planner и получите свежие идеи для контента.';
    await this.sendMessage(token, chatId, msg);
  },

  startReminders(token, chatId, filmDays, hour = 10, minute = 0) {
    this.stopReminders();
    const check = () => {
      const now = new Date();
      const mskOffset = 3 * 60;
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const msk = new Date(utc + mskOffset * 60000);
      const dayOfWeek = msk.getDay();
      const h = msk.getHours();
      const m = msk.getMinutes();

      if (filmDays.includes(dayOfWeek) && h === hour && m === minute) {
        this.sendReminder(token, chatId);
      }
    };
    const intervalId = setInterval(check, 60000);
    localStorage.setItem('rp_reminder_interval', intervalId);
  },

  stopReminders() {
    const id = localStorage.getItem('rp_reminder_interval');
    if (id) clearInterval(parseInt(id));
    localStorage.removeItem('rp_reminder_interval');
  }
};
