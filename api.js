const AI = {
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

    if (provider === 'gemini') return this._callGemini(prompt, apiKey);
    if (provider === 'openai') return this._callOpenAI(prompt, apiKey);
    if (provider === 'claude') return this._callClaude(prompt, apiKey);
    throw new Error('Unknown provider');
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

    if (provider === 'gemini') return this._parseTrends(await this._callGeminiRaw(prompt, apiKey));
    if (provider === 'openai') return this._parseTrends(await this._callOpenAIRaw(prompt, apiKey));
    if (provider === 'claude') return this._parseTrends(await this._callClaudeRaw(prompt, apiKey));
    return [];
  },

  async _callGeminiRaw(prompt, apiKey) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates[0].content.parts[0].text;
  },

  async _callOpenAIRaw(prompt, apiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.9 })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  },

  async _callClaudeRaw(prompt, apiKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content[0].text;
  },

  _parseTrends(text) {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try { return JSON.parse(match[0]); } catch { return []; }
  },

  async _callGemini(prompt, apiKey) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.candidates[0].content.parts[0].text;
    return this._parseResponse(text);
  },

  async _callOpenAI(prompt, apiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return this._parseResponse(data.choices[0].message.content);
  },

  async _callClaude(prompt, apiKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return this._parseResponse(data.content[0].text);
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
  }
};
