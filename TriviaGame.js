const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const DIFFICULTY_PROMPTS = {
  easy: 'easy (suitable for general audience, common knowledge)',
  medium: 'medium (requires some knowledge, not too obscure)',
  hard: 'hard (challenging, specific facts, expert-level)',
  mixed: 'random difficulty (vary between easy, medium, and hard)',
};

const POINTS_BY_TIME = (timeLeft) => {
  if (timeLeft >= 15) return 3;
  if (timeLeft >= 8) return 2;
  return 1;
};

class TriviaGame {
  constructor({ channelId, hostId, players, topics, rounds, difficulty }) {
    this.channelId = channelId;
    this.hostId = hostId;
    this.players = players;
    this.topics = topics;
    this.rounds = rounds;
    this.difficulty = difficulty;

    this.turnOrder = [...players.keys()];
    this.turnIndex = 0;
    this.turnsPlayed = 0;
    this.totalTurns = players.size * rounds;

    this.currentQuestion = null;
    this.answered = false;
    this.timerTimeout = null;
    this.timerStart = null;
    this.usedQuestions = [];

    this.onTimeout = null;
  }

  get currentPlayerId() {
    let id = this.turnOrder[this.turnIndex];
    let attempts = 0;
    while (this.players.get(id)?.eliminated && attempts < this.turnOrder.length) {
      this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
      id = this.turnOrder[this.turnIndex];
      attempts++;
    }
    return id;
  }

  get activePlayers() {
    return this.turnOrder.filter((id) => !this.players.get(id)?.eliminated);
  }

  get isOver() {
    return this.activePlayers.length <= 1 || this.turnsPlayed >= this.totalTurns;
  }

  getCurrentTopic() {
    return this.topics[this.turnsPlayed % this.topics.length];
  }

  getCurrentRound() {
    return Math.floor(this.turnsPlayed / this.turnOrder.length) + 1;
  }

  async fetchQuestion() {
    const topic = this.getCurrentTopic();
    const diff = DIFFICULTY_PROMPTS[this.difficulty] || DIFFICULTY_PROMPTS.mixed;
    const avoid =
      this.usedQuestions.length > 0
        ? `\nAvoid these already used questions: ${this.usedQuestions.slice(-10).join('; ')}`
        : '';

    const prompt = `Generate a trivia question about "${topic}". Difficulty: ${diff}.${avoid}

Respond ONLY with valid JSON, no markdown, no explanation:
{"question":"...","options":["A text","B text","C text","D text"],"answer":0,"explanation":"one sentence why"}

Rules: exactly 4 options, answer is index 0-3 of correct option, make distractors plausible.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 400,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = (data.choices?.[0]?.message?.content || '')
      .replace(/```json|```/g, '')
      .trim();

    const parsed = JSON.parse(text);
    if (
      !parsed.question ||
      !Array.isArray(parsed.options) ||
      parsed.options.length !== 4 ||
      typeof parsed.answer !== 'number'
    ) {
      throw new Error('Invalid question format from AI');
    }

    this.usedQuestions.push(parsed.question.substring(0, 50));
    this.currentQuestion = parsed;
    this.answered = false;
    this.timerStart = Date.now();
    return parsed;
  }

  submitAnswer(userId, answerIndex) {
    if (this.answered) return null;
    if (userId !== this.currentPlayerId) return null;

    this.answered = true;
    clearTimeout(this.timerTimeout);

    const q = this.currentQuestion;
    const correct = answerIndex === q.answer;
    const timeLeft = Math.max(0, 20 - Math.floor((Date.now() - this.timerStart) / 1000));
    const points = correct ? POINTS_BY_TIME(timeLeft) : 0;
    const player = this.players.get(userId);

    if (correct) {
      player.score += points;
    } else {
      if (this.activePlayers.length > 2) {
        player.eliminated = true;
      }
    }

    return {
      correct,
      points,
      timeLeft,
      eliminated: !correct && this.activePlayers.length > 2,
      correctOption: q.options[q.answer],
      explanation: q.explanation,
    };
  }

  handleTimeout() {
    if (this.answered) return;
    this.answered = true;

    const player = this.players.get(this.currentPlayerId);
    const eliminated = this.activePlayers.length > 2;
    if (eliminated) player.eliminated = true;

    return {
      timedOut: true,
      eliminated,
      correctOption: this.currentQuestion?.options[this.currentQuestion.answer],
    };
  }

  advance() {
    this.turnsPlayed++;
    this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
  }

  getResults() {
    const sorted = [...this.players.entries()].sort(([, a], [, b]) => b.score - a.score);
    return sorted.map(([id, data], i) => ({
      rank: i + 1,
      userId: id,
      tag: data.tag,
      score: data.score,
      eliminated: data.eliminated,
    }));
  }
}

module.exports = { TriviaGame, POINTS_BY_TIME };
