const AI = {
  _proxyUrl: 'https://reels-planner.onrender.com',

  async generateIdeas(profile, provider, apiKey, count = 4, existingTopics = []) {
    const avoidList = existingTopics.length > 5 ? existingTopics.slice(0, 20).join(', ') : '';
    const prompt = `Ты — креативный директор Instagram Reels. Пользователь описал себя так: "${profile}".
Сгенерируй ${count} ОРИГИНАЛЬНЫХ идей для Reels.

Избегай этих тем (они уже были): ${avoidList}

Каждая идея должна содержать:
1. topic — конкретная тема (не общая, а конкретная ситуация/история)
2. format — один из: тренд, обучающий, сторителлинг, behind-the-scenes, POV, до/после, коллаборация, timelapse, обзор, челлендж
3. description — краткое описание 1-2 предложения
4. location — где снимать (конкретное место)
5. concept — концепция ролика (что показать, как подать, структура)

Ответ СТРОГО в JSON массиве, без дополнительного текста:
[{"topic":"...","format":"...","description":"...","location":"...","concept":"..."}]`;

    const raw = await this._proxyCall(provider, apiKey, prompt);
    return this._parseResponse(raw);
  },

  async generateTrends(profile, provider, apiKey) {
    const prompt = `Ты — аналитик Instagram Reels. Пользователь работает в нише: "${profile}".
Найди 3 актуальных тренда Instagram Reels на эту неделю (сейчас 2025 год).
Для каждого тренда укажи:
1. name — название тренда
2. description — что это за тренд и почему он популярный
3. location — где лучше снимать
4. how_to — как использовать этот тренд (конкретные шаги)

Ответ СТРОГО в JSON массиве:
[{"name":"...","description":"...","location":"...","how_to":"..."}]`;

    const raw = await this._proxyCall(provider, apiKey, prompt);
    return this._parseTrends(raw);
  },

  async _proxyCall(provider, apiKey, prompt) {
    const res = await fetch(`${this._proxyUrl}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey, prompt })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    if (provider === 'gemini') return data.candidates[0].content.parts[0].text;
    if (provider === 'openai') return data.choices[0].message.content;
    if (provider === 'claude') return data.content[0].text;
    return '';
  },

  _parseResponse(text) {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI response is not valid JSON');
    const ideas = JSON.parse(match[0]);
    const fmtMap = { 'тренд': 'trend', 'обучающий': 'tutorial', 'сторителлинг': 'storytelling',
      'behind-the-scenes': 'bts', 'pov': 'pov', 'до/после': 'before_after',
      'коллаборация': 'collab', 'timelapse': 'timelapse', 'обзор': 'review', 'челлендж': 'challenge' };
    const iconMap = { trend: '🔥', tutorial: '📚', storytelling: '📖', bts: '🎬', pov: '👀',
      before_after: '✨', collab: '🤝', timelapse: '⏱️', review: '⭐', challenge: '🏆' };

    return ideas.map((idea, i) => {
      const fmtId = fmtMap[idea.format?.toLowerCase()] || 'trend';
      return {
        id: Date.now() + i,
        topic: idea.topic,
        format: { id: fmtId, name: idea.format, icon: iconMap[fmtId] || '🤖', desc: idea.description || '' },
        location: idea.location || '',
        concept: idea.concept || '',
        source: 'ai',
        created: new Date().toISOString(),
        status: 'pending'
      };
    });
  },

  _parseTrends(text) {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try { return JSON.parse(match[0]); } catch { return []; }
  }
};
