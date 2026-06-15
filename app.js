const App = {
  state: {
    currentScreen: 'home',
    settings: {},
    ideas: [],
    history: [],
    showingIdeas: false,
    telegramChatId: '',
    telegramToken: ''
  },

  init() {
    this.loadLocal();
    this.loadConfig();
    this.setupNav();
    this.setupSettings();
    this.setupHome();
    this.initTimePicker();
    this.initDayPicker();
    this.showQuote();
    this.checkWeeklyTrends();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  },

  loadLocal() {
    try {
      this.state.settings = JSON.parse(localStorage.getItem('rp_settings') || '{}');
      this.state.history = JSON.parse(localStorage.getItem('rp_history') || '[]');
    } catch {
      this.state.settings = {};
      this.state.history = [];
    }
  },

  loadConfig() {
    if (typeof CONFIG !== 'undefined' && CONFIG.telegram) {
      this.state.telegramToken = CONFIG.telegram.token;
      this.state.telegramChatId = CONFIG.telegram.chatId;
    }
  },

  saveLocal() {
    localStorage.setItem('rp_settings', JSON.stringify(this.state.settings));
    localStorage.setItem('rp_history', JSON.stringify(this.state.history));
  },

  showQuote() {
    const el = document.getElementById('daily-quote');
    if (el) el.textContent = IDEAS_DB.getRandomQuote();
  },

  setupNav() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const screen = tab.dataset.screen;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('screen-' + screen).classList.add('active');
        document.getElementById('header-title').textContent =
          screen === 'home' ? 'Reels Planner' :
          screen === 'history' ? 'История' :
          screen === 'stats' ? 'Статистика' : 'Настройки';
        this.state.currentScreen = screen;
        if (screen === 'history') this.renderHistory();
        if (screen === 'stats') this.renderStats();
        if (screen === 'settings') this._scrollTimePickerToSaved();
      });
    });
  },

  setupHome() {
    document.getElementById('btn-generate').addEventListener('click', () => this.generateIdeas());
    document.getElementById('btn-refresh').addEventListener('click', () => this.generateIdeas());
    document.getElementById('btn-back-home').addEventListener('click', () => this.showHome());
  },

  showHome() {
    this.state.showingIdeas = false;
    document.getElementById('ideas-container').innerHTML = '';
    document.querySelector('.welcome-banner').style.display = '';
    document.getElementById('btn-generate').style.display = '';
    document.getElementById('btn-refresh').style.display = 'none';
    document.getElementById('btn-back-home').style.display = 'none';
    this.showQuote();
  },

  async generateIdeas() {
    const container = document.getElementById('ideas-container');
    const banner = document.querySelector('.welcome-banner');
    if (banner) banner.style.display = 'none';
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    const { settings } = this.state;
    let ideas = [];
    const customDb = JSON.parse(localStorage.getItem('rp_custom_ideas') || '[]');

    if (settings.aiProvider && settings.aiProvider !== 'none' && settings.apiKey && settings.profile) {
      try {
        const existingTopics = customDb.map(i => i.topic).concat(IDEAS_DB.topics.map(t => t.topic));
        ideas = await AI.generateIdeas(settings.profile, settings.aiProvider, settings.apiKey, 4, existingTopics);
        console.log('AI ideas generated:', ideas.length, ideas.map(i => i.source));
        ideas.forEach(idea => {
          if (!customDb.some(c => c.topic === idea.topic)) {
            customDb.push({ topic: idea.topic, format: idea.format.name, location: idea.location || '', concept: idea.concept || '' });
          }
        });
        localStorage.setItem('rp_custom_ideas', JSON.stringify(customDb));
      } catch (e) {
        console.error('AI error:', e);
        this._showToast('Ошибка AI: ' + e.message);
      }
    } else {
      console.log('AI not configured:', { provider: settings.aiProvider, hasKey: !!settings.apiKey, hasProfile: !!settings.profile });
    }

    if (ideas.length < 4) {
      const dbIdeas = IDEAS_DB.getRandomIdeas(4 - ideas.length);
      ideas = ideas.concat(dbIdeas);
    }

    this.state.ideas = ideas;
    this.state.showingIdeas = true;
    this.renderIdeas(ideas);
    document.getElementById('btn-generate').style.display = 'none';
    document.getElementById('btn-refresh').style.display = '';
    document.getElementById('btn-back-home').style.display = '';
  },

  renderIdeas(ideas) {
    const container = document.getElementById('ideas-container');
    container.innerHTML = ideas.map(idea => {
      const aiBadge = idea.source === 'ai' ? '<span class="ai-badge">🤖 AI</span>' : '';
      return `
      <div class="idea-card" data-id="${idea.id}">
        <div class="format-badge">${idea.format.icon} ${idea.format.name} ${aiBadge}</div>
        <div class="idea-title">${idea.topic}</div>
        ${idea.location ? `<div class="idea-desc">📍 ${idea.location}</div>` : ''}
        <div class="idea-actions">
          <button class="btn-save" onclick="App.saveIdea(${idea.id})">Снять!</button>
          <button class="btn-dismiss" onclick="App.dismissIdea(${idea.id})">Пропустить</button>
        </div>
      </div>`;
    }).join('');
  },

  saveIdea(id) {
    const idea = this.state.ideas.find(i => i.id === id);
    if (!idea) return;
    idea.status = 'planned';
    this.state.history.unshift(idea);
    this.saveLocal();
    this._syncToTelegram();
    this._removeCard(id);
  },

  dismissIdea(id) {
    const idea = this.state.ideas.find(i => i.id === id);
    if (!idea) return;
    idea.status = 'skipped';
    this.state.history.unshift(idea);
    this.saveLocal();
    this._removeCard(id);
  },

  _removeCard(id) {
    const card = document.querySelector(`.idea-card[data-id="${id}"]`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.9)';
      setTimeout(() => card.remove(), 200);
    }
  },

  _syncToTelegram() {
    if (this.state.telegramToken && this.state.telegramChatId) {
      Telegram.saveData(this.state.telegramToken, this.state.telegramChatId, 'history', this.state.history).catch(() => {});
    }
  },

  /* ===== HISTORY ===== */
  renderHistory() {
    const filter = document.querySelector('#history-filters .filter-btn.active')?.dataset.filter || 'planned';
    const items = this.state.history.filter(i => i.status === filter);

    const list = document.getElementById('history-list');
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><p>Пока пусто</p></div>';
      this._bindFilterButtons();
      return;
    }

    list.innerHTML = items.map(idea => {
      let actions = '';
      if (filter === 'planned') {
        actions = `<button class="hi-btn hi-btn-done" onclick="App.markDone(${idea.id})" title="Снял">✓</button>
                   <button class="hi-btn hi-btn-cancel" onclick="App.markSkipped(${idea.id})" title="Отменить">✕</button>`;
      } else if (filter === 'skipped') {
        actions = `<button class="hi-btn hi-btn-restore" onclick="App.markRestore(${idea.id})" title="Вернуть">↩</button>`;
      }

      return `
      <div class="history-item" data-id="${idea.id}">
        <div class="history-main">
          <div class="hi-info">
            <div class="hi-format">${idea.format.icon} ${idea.format.name}</div>
            <div class="hi-title">${idea.topic}</div>
            <div class="hi-date">${new Date(idea.created).toLocaleDateString('ru')}</div>
          </div>
          <div class="hi-actions">${actions}</div>
        </div>
        <div class="hi-expand" onclick="App.toggleDetails(${idea.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="hi-details">
          <div class="hi-details-inner">
            ${idea.concept ? `<div class="detail-section"><div class="detail-label">Концепция</div><div class="detail-text">${idea.concept}</div></div>` : ''}
            ${idea.location ? `<div class="detail-section"><div class="detail-label">Локация</div><div class="detail-text">📍 ${idea.location}</div></div>` : ''}
            ${idea.tips && idea.tips.length ? `<div class="detail-section"><div class="detail-label">Рекомендации</div><ul class="tip-list">${idea.tips.map(t => `<li>${t}</li>`).join('')}</ul></div>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    this._bindFilterButtons();
  },

  _bindFilterButtons() {
    document.querySelectorAll('#history-filters .filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#history-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderHistory();
      };
    });
  },

  markDone(id) {
    const idea = this.state.history.find(i => i.id === id);
    if (!idea) return;
    idea.status = 'completed';
    this.saveLocal();
    this._syncToTelegram();
    this.renderHistory();
    this._showToast('Отмечено как снятое ✓');
  },

  markSkipped(id) {
    const idea = this.state.history.find(i => i.id === id);
    if (!idea) return;
    idea.status = 'skipped';
    this.saveLocal();
    this.renderHistory();
    this._showToast('Перемещено в пропущенные');
  },

  markRestore(id) {
    const idea = this.state.history.find(i => i.id === id);
    if (!idea) return;
    idea.status = 'planned';
    this.saveLocal();
    this.renderHistory();
    this._showToast('Возвращено в запланированные');
  },

  toggleDetails(id) {
    const item = document.querySelector(`.history-item[data-id="${id}"]`);
    if (item) item.classList.toggle('expanded');
  },

  _scrollTimePickerToSaved() {
    const hoursWheel = document.getElementById('wheel-hours');
    const minutesWheel = document.getElementById('wheel-minutes');
    if (!hoursWheel || !minutesWheel) return;
    const savedH = this.state.settings.reminderHour ?? 10;
    const savedM = this.state.settings.reminderMinute ?? 0;
    setTimeout(() => {
      hoursWheel.style.scrollSnapType = 'none';
      minutesWheel.style.scrollSnapType = 'none';
      hoursWheel.scrollTop = (savedH + 24) * 40 - 30;
      minutesWheel.scrollTop = (savedM + 60) * 40 - 30;
      requestAnimationFrame(() => {
        hoursWheel.style.scrollSnapType = '';
        minutesWheel.style.scrollSnapType = '';
      });
    }, 100);
  },

  /* ===== TIME PICKER ===== */
  initTimePicker() {
    const hoursWheel = document.getElementById('wheel-hours');
    const minutesWheel = document.getElementById('wheel-minutes');
    if (!hoursWheel || !minutesWheel) return;

    const savedH = this.state.settings.reminderHour ?? 10;
    const savedM = this.state.settings.reminderMinute ?? 0;

    const pad = (n) => String(n).padStart(2, '0');

    for (let i = 0; i < 3; i++) {
      for (let h = 0; h < 24; h++) {
        const opt = document.createElement('div');
        opt.className = 'time-option' + (h === savedH && i === 1 ? ' selected' : '');
        opt.textContent = pad(h);
        opt.dataset.value = h;
        hoursWheel.appendChild(opt);
      }
    }

    for (let i = 0; i < 3; i++) {
      for (let m = 0; m < 60; m++) {
        const opt = document.createElement('div');
        opt.className = 'time-option' + (m === savedM && i === 1 ? ' selected' : '');
        opt.textContent = pad(m);
        opt.dataset.value = m;
        minutesWheel.appendChild(opt);
      }
    }

    const scrollToSaved = (wheel, value) => {
      setTimeout(() => {
        wheel.style.scrollSnapType = 'none';
        wheel.scrollTop = (value + 24) * 40 - 30;
        requestAnimationFrame(() => {
          wheel.style.scrollSnapType = '';
        });
      }, 100);
    };

    scrollToSaved(hoursWheel, savedH);
    scrollToSaved(minutesWheel, savedM);

    const onScroll = (wheel) => {
      const options = wheel.querySelectorAll('.time-option');
      const wheelRect = wheel.getBoundingClientRect();
      const centerY = wheelRect.top + wheelRect.height / 2;
      let closest = null;
      let minDist = Infinity;
      options.forEach(opt => {
        const rect = opt.getBoundingClientRect();
        const dist = Math.abs(rect.top + rect.height / 2 - centerY);
        if (dist < minDist) { minDist = dist; closest = opt; }
      });
      if (closest) {
        options.forEach(o => o.classList.remove('selected'));
        closest.classList.add('selected');
      }
    };

    const handleInfiniteScroll = (wheel) => {
      const options = wheel.querySelectorAll('.time-option');
      const third = options.length / 3;
      const scrollTop = wheel.scrollTop;
      const scrollHeight = wheel.scrollHeight;
      const clientHeight = wheel.clientHeight;

      if (scrollTop < clientHeight * 0.5) {
        wheel.scrollTop = scrollTop + third * 40;
      } else if (scrollTop > scrollHeight - clientHeight * 1.5) {
        wheel.scrollTop = scrollTop - third * 40;
      }
    };

    hoursWheel.addEventListener('click', (e) => {
      const opt = e.target.closest('.time-option');
      if (opt) opt.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    minutesWheel.addEventListener('click', (e) => {
      const opt = e.target.closest('.time-option');
      if (opt) opt.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    let scrollTimeout;
    hoursWheel.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { onScroll(hoursWheel); handleInfiniteScroll(hoursWheel); }, 80);
    });
    minutesWheel.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { onScroll(minutesWheel); handleInfiniteScroll(minutesWheel); }, 80);
    });
  },

  /* ===== DAY PICKER ===== */
  initDayPicker() {
    const picker = document.getElementById('day-picker');
    if (!picker) return;
    const savedDays = this.state.settings.filmDays || [];
    picker.querySelectorAll('.day-btn').forEach(btn => {
      const day = parseInt(btn.dataset.day);
      if (savedDays.includes(day)) btn.classList.add('active');
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
      });
    });
  },

  _getSelectedDays() {
    const days = [];
    document.querySelectorAll('#day-picker .day-btn.active').forEach(btn => {
      days.push(parseInt(btn.dataset.day));
    });
    return days;
  },

  _getSelectedTime() {
    const h = document.querySelector('#wheel-hours .selected');
    const m = document.querySelector('#wheel-minutes .selected');
    return {
      hour: h ? parseInt(h.dataset.value) : 10,
      minute: m ? parseInt(m.dataset.value) : 0
    };
  },

  /* ===== SETTINGS ===== */
  setupSettings() {
    const form = document.getElementById('settings-form');
    const provider = document.getElementById('setting-ai-provider');
    const apiKeyInput = document.getElementById('setting-api-key');

    provider.addEventListener('change', () => {
      apiKeyInput.classList.toggle('hidden', provider.value === 'none');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const time = this._getSelectedTime();
      const filmDays = this._getSelectedDays();
      this.state.settings = {
        profile: document.getElementById('setting-profile').value,
        filmDays,
        aiProvider: provider.value,
        apiKey: apiKeyInput.value,
        reminderHour: time.hour,
        reminderMinute: time.minute
      };
      this.saveLocal();

      if (this.state.telegramChatId) {
        await Telegram.saveSchedule(this.state.telegramChatId, filmDays, time.hour, time.minute);
      }

      this._showToast('Настройки сохранены!');
    });

    document.getElementById('btn-test-bot').addEventListener('click', async () => {
      if (!this.state.telegramChatId) {
        this._showToast('Chat ID не задан');
        return;
      }
      const result = await Telegram.testConnection(this.state.telegramChatId);
      if (result.ok) {
        this._showToast('Проверь Telegram!');
      } else {
        this._showToast('Ошибка: ' + (result.description || 'неизвестно'));
      }
    });

    this._populateSettings();
  },

  _populateSettings() {
    const s = this.state.settings;
    if (s.profile) document.getElementById('setting-profile').value = s.profile;
    if (s.aiProvider) document.getElementById('setting-ai-provider').value = s.aiProvider;
    if (s.apiKey) document.getElementById('setting-api-key').value = s.apiKey;
    if (s.aiProvider && s.aiProvider !== 'none') {
      document.getElementById('setting-api-key').classList.remove('hidden');
    }
  },

  setupReminders() {
    const { settings, telegramToken, telegramChatId } = this.state;
    Telegram.stopReminders();
    if (telegramToken && telegramChatId && settings.filmDays && settings.filmDays.length) {
      Telegram.startReminders(telegramToken, telegramChatId, settings.filmDays, settings.reminderHour ?? 10, settings.reminderMinute ?? 0);
    }
  },

  restoreReminder() {
    const filmDays = this.state.settings.filmDays;
    if (filmDays && filmDays.length && this.state.telegramToken && this.state.telegramChatId) {
      this.setupReminders();
    }
  },

  /* ===== STATS ===== */
  renderStats() {
    const planned = this.state.history.filter(i => i.status === 'planned').length;
    const completed = this.state.history.filter(i => i.status === 'completed').length;
    const skipped = this.state.history.filter(i => i.status === 'skipped').length;
    const total = this.state.history.length;

    let streak = 0;
    const today = new Date().toDateString();
    const dates = [...new Set(this.state.history.filter(i => i.status === 'completed').map(i => new Date(i.created).toDateString()))].sort().reverse();
    for (const d of dates) {
      const diff = (new Date(today) - new Date(d)) / 86400000;
      if (diff <= streak + 1) streak++;
      else break;
    }

    document.getElementById('stats-content').innerHTML = `
      <div class="stat-card"><div class="stat-number">${total}</div><div class="stat-label">Всего идей</div></div>
      <div class="stat-card"><div class="stat-number">${planned}</div><div class="stat-label">Запланировано</div></div>
      <div class="stat-card"><div class="stat-number">${completed}</div><div class="stat-label">Снято</div></div>
      <div class="stat-card"><div class="stat-number">${skipped}</div><div class="stat-label">Пропущено</div></div>
      <div class="stat-card"><div class="stat-number">${streak}</div><div class="stat-label">Дней подряд 🔥</div></div>
    `;
  },

  /* ===== WEEKLY TRENDS ===== */
  async checkWeeklyTrends() {
    const { settings } = this.state;
    const lastCheck = localStorage.getItem('rp_trends_last_check');
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    if (lastCheck && (now - parseInt(lastCheck)) < weekMs) {
      const cached = JSON.parse(localStorage.getItem('rp_weekly_trends') || '[]');
      if (cached.length) this.renderTrends(cached);
      return;
    }

    if (!settings.aiProvider || settings.aiProvider === 'none' || !settings.apiKey || !settings.profile) return;

    try {
      const trends = await AI.generateTrends(settings.profile, settings.aiProvider, settings.apiKey);
      localStorage.setItem('rp_weekly_trends', JSON.stringify(trends));
      localStorage.setItem('rp_trends_last_check', now.toString());
      this.renderTrends(trends);
    } catch (e) {
      console.error('Trends error:', e);
    }
  },

  renderTrends(trends) {
    const container = document.getElementById('trends-container');
    const list = document.getElementById('trends-list');
    if (!trends.length) { container.style.display = 'none'; return; }
    container.style.display = '';

    list.innerHTML = trends.map((t, i) => `
      <div class="trend-card" data-index="${i}">
        <div class="trend-tag">📈 Тренд</div>
        <div class="trend-name">${t.name}</div>
        <div class="trend-desc">${t.description}</div>
        <div class="idea-actions">
          <button class="btn-save" onclick="App.saveTrend(${i})">Снять!</button>
          <button class="btn-dismiss" onclick="App.dismissTrend(${i})">Пропустить</button>
        </div>
      </div>
    `).join('');
  },

  saveTrend(index) {
    const trends = JSON.parse(localStorage.getItem('rp_weekly_trends') || '[]');
    const trend = trends[index];
    if (!trend) return;
    const idea = {
      id: Date.now(),
      topic: trend.name,
      format: { id: 'trend', name: 'Тренд', icon: '📈', desc: trend.description },
      location: trend.location || '',
      concept: trend.how_to || '',
      source: 'ai_trend',
      created: new Date().toISOString(),
      status: 'planned'
    };
    this.state.history.unshift(idea);
    this.saveLocal();
    this._showToast('Тренд добавлен в запланированные');
  },

  dismissTrend(index) {
    const trends = JSON.parse(localStorage.getItem('rp_weekly_trends') || '[]');
    const trend = trends[index];
    if (!trend) return;
    const idea = {
      id: Date.now(),
      topic: trend.name,
      format: { id: 'trend', name: 'Тренд', icon: '📈', desc: trend.description },
      location: trend.location || '',
      concept: trend.how_to || '',
      source: 'ai_trend',
      created: new Date().toISOString(),
      status: 'skipped'
    };
    this.state.history.unshift(idea);
    this.saveLocal();
    this._showToast('Тренд пропущен');
  },

  _showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
