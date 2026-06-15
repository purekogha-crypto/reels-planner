const AI = {
  async generateIdeas(profile, provider, apiKey, count = 4) {
    const prompt = `Ты — креативный директор Instagram Reels. Пользователь описал себя так: "${profile}".
Сгенерируй ${count} идей для Reels. Каждая идея должна содержать:
1. Тему (конкретную, не общую)
2. Формат из списка: тренд, обучающий, сторителлинг, behind-the-scenes, POV, до/после, коллаборация, timelapse, обзор, челлендж
3. Краткое описание (1-2 предложения)

Ответ СТРОГО в JSON массиве:
[{"topic": "...", "format": "тренд", "description": "..."}]`;

    if (provider === 'gemini') return this._callGemini(prompt, apiKey);
    if (provider === 'openai') return this._callOpenAI(prompt, apiKey);
    if (provider === 'claude') return this._callClaude(prompt, apiKey);
    throw new Error('Unknown provider');
  },

  async _callGemini(prompt, apiKey) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
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
    return this._parseResponse(data.content[0].text);
  },

  _parseResponse(text) {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI response is not valid JSON');
    const ideas = JSON.parse(match[0]);
    return ideas.map((idea, i) => ({
      id: Date.now() + i,
      topic: idea.topic,
      format: { id: idea.format.toLowerCase(), name: idea.format, icon: '🤖', desc: idea.description || '' },
      source: 'ai',
      created: new Date().toISOString(),
      status: 'pending'
    }));
  }
};
