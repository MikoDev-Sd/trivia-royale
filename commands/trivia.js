const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  MessageFlags,
} = require('discord.js');
const { TriviaGame } = require('../TriviaGame');

const activeGames = new Map();

const TOPICS = [
  { label: 'General Knowledge', value: 'General Knowledge', emoji: '🧠' },
  { label: 'Science & Nature',  value: 'Science & Nature',  emoji: '🔬' },
  { label: 'World History',     value: 'World History',     emoji: '📜' },
  { label: 'Pop Culture',       value: 'Pop Culture & Movies', emoji: '🎬' },
  { label: 'Sports',            value: 'Sports',            emoji: '⚽' },
  { label: 'Geography',         value: 'Geography',         emoji: '🌍' },
  { label: 'Technology',        value: 'Technology & Computers', emoji: '💻' },
  { label: 'Food & Cooking',    value: 'Food & Cooking',    emoji: '🍕' },
  { label: 'Music',             value: 'Music',             emoji: '🎵' },
  { label: 'Anime & Manga',     value: 'Anime & Manga',     emoji: '⛩️' },
  { label: 'Cricket',           value: 'Cricket',           emoji: '🏏' },
  { label: 'Mythology',         value: 'Mythology',         emoji: '⚡' },
];

const DIFF_EMOJI = { mixed: '🎲', easy: '🟢', medium: '🟡', hard: '🔴' };
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const OPTION_FLAGS   = ['🇦', '🇧', '🇨', '🇩'];

const ACCENT = {
  PURPLE : 0x534AB7,
  GREEN  : 0x57A639,
  RED    : 0xA32D2D,
  AMBER  : 0xE49D2A,
  DARK   : 0x1E1E2E,
};

async function safeReply(i, payload) {
  try {
    if (i.replied || i.deferred) return await i.followUp({ ...payload, ephemeral: true });
    return await i.reply({ ...payload, ephemeral: true });
  } catch (_) {}
}

async function safeUpdate(i, payload) {
  try {
    if (!i.replied && !i.deferred) return await i.update(payload);
    return await i.editReply(payload);
  } catch (_) {}
}

async function safeDeferUpdate(i) {
  try { if (!i.replied && !i.deferred) await i.deferUpdate(); } catch (_) {}
}

async function safeEdit(msg, payload) {
  try { await msg.edit(payload); } catch (_) {}
}

function scoreboardText(game) {
  return game.turnOrder.map((id) => {
    const p   = game.players.get(id);
    const cur = id === game.currentPlayerId && !game.answered;
    if (p.eliminated) return `~~${p.tag}~~ — ☠️`;
    if (cur)          return `**▶ ${p.tag}** — **${p.score} pts** 🎯`;
    return `${p.tag} — ${p.score} pts`;
  }).join('\n');
}

function buildAnswerButtons(disabled, correctIdx = null, wrongIdx = null) {
  const makeBtn = (i) => {
    let style = ButtonStyle.Secondary;
    if (correctIdx !== null && i === correctIdx) style = ButtonStyle.Success;
    if (wrongIdx   !== null && i === wrongIdx)   style = ButtonStyle.Danger;
    return new ButtonBuilder()
      .setCustomId(`trivia_ans_${i}`)
      .setLabel(OPTION_LETTERS[i])
      .setEmoji(OPTION_FLAGS[i])
      .setStyle(style)
      .setDisabled(disabled);
  };
  return [
    new ActionRowBuilder().addComponents(makeBtn(0), makeBtn(1)),
    new ActionRowBuilder().addComponents(makeBtn(2), makeBtn(3)),
  ];
}

function cvLobby(hostName, players, topics, rounds, diff) {
  const playerList = [...players.values()].map((p, i) =>
    i === 0 ? `👑 **${p.tag}** *(host)*` : `• ${p.tag}`
  ).join('\n');

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      accent_color: ACCENT.PURPLE,
      components: [
        { type: 10, content: '# 🏆 TriviaRoyale' },
        { type: 10, content: `**${hostName}** opened a lobby — join before the game starts!` },
        { type: 14, divider: true,  spacing: 1 },
        { type: 10, content: `## 👥 Players (${players.size}/6)\n${playerList}` },
        { type: 14, divider: false, spacing: 1 },
        {
          type: 10,
          content: `## ⚙️ Settings\n📚 **Topics** — ${topics.join(', ')}\n🔁 **Rounds** — ${rounds} per player\n${DIFF_EMOJI[diff]} **Difficulty** — ${diff.charAt(0).toUpperCase() + diff.slice(1)}`,
        },
        { type: 14, divider: true,  spacing: 1 },
        { type: 10, content: `-# Min 2 players to start • Max 6 players • Lobby expires in 2 minutes` },
      ],
    }],
  };
}

function cvStarting(playerCount, topics, rounds, diff) {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      accent_color: ACCENT.PURPLE,
      components: [
        { type: 10, content: '# 🏆 TriviaRoyale — Starting!' },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `**${playerCount} players** locked and loaded.\nTopics: **${topics.join(', ')}**\nRounds: **${rounds}** | Difficulty: **${diff}**` },
        { type: 14, divider: true,  spacing: 1 },
        { type: 10, content: `⚡ First question incoming...` },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `-# Wrong answer = elimination (3+ players) • Speed = bonus points` },
      ],
    }],
  };
}

function cvLoading(playerTag) {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      accent_color: ACCENT.PURPLE,
      components: [
        { type: 10, content: `# ⏳ Generating Question` },
        { type: 10, content: `Cooking up a question for **${playerTag}**...` },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `-# Powered by Groq • llama-3.3-70b` },
      ],
    }],
  };
}

function cvQuestion(game) {
  const q    = game.currentQuestion;
  const pid  = game.currentPlayerId;
  const p    = game.players.get(pid);
  const opts = q.options.map((o, i) => `${OPTION_FLAGS[i]} **${OPTION_LETTERS[i]}.** ${o}`).join('\n');

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      accent_color: ACCENT.PURPLE,
      components: [
        {
          type: 10,
          content: `# Round ${game.getCurrentRound()}/${game.rounds} — ${game.getCurrentTopic()}`,
        },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `## 🎯 ${p?.tag ?? 'Player'}'s Turn\n> ${q.question}` },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: opts },
        { type: 14, divider: true,  spacing: 1 },
        { type: 10, content: `📊 **Scoreboard**\n${scoreboardText(game)}` },
        { type: 14, divider: true,  spacing: 1 },
        { type: 10, content: `-# ⏱ 20 seconds • 🏃 Fast answer = 3pts • 🚶 Slow = 1pt` },
      ],
    }],
  };
}

function cvCorrect(game, playerTag, pts, explanation) {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      accent_color: ACCENT.GREEN,
      components: [
        { type: 10, content: `# ✅ Correct!` },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `**${playerTag}** nailed it and earned **+${pts} point${pts !== 1 ? 's' : ''}**!` },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `💡 **Explanation**\n${explanation}` },
        { type: 14, divider: true,  spacing: 1 },
        { type: 10, content: `📊 **Scoreboard**\n${scoreboardText(game)}` },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `-# Next question loading...` },
      ],
    }],
  };
}

function cvWrong(game, playerTag, correctOption, explanation, eliminated) {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      accent_color: eliminated ? ACCENT.RED : ACCENT.AMBER,
      components: [
        {
          type: 10,
          content: eliminated ? `# ☠️ ${playerTag} Eliminated!` : `# ❌ Wrong Answer!`,
        },
        { type: 14, divider: false, spacing: 1 },
        {
          type: 10,
          content: eliminated
            ? `**${playerTag}** answered wrong and has been **eliminated**!\n✅ Correct answer: **${correctOption}**`
            : `The correct answer was **${correctOption}**.`,
        },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `💡 **Explanation**\n${explanation}` },
        { type: 14, divider: true,  spacing: 1 },
        { type: 10, content: `📊 **Scoreboard**\n${scoreboardText(game)}` },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `-# Next question loading...` },
      ],
    }],
  };
}

function cvTimeout(game, playerTag, correctOption, eliminated) {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      accent_color: eliminated ? ACCENT.RED : ACCENT.AMBER,
      components: [
        { type: 10, content: eliminated ? `# ⏰ Time's Up — ${playerTag} Eliminated!` : `# ⏰ Time's Up!` },
        { type: 14, divider: false, spacing: 1 },
        {
          type: 10,
          content: eliminated
            ? `**${playerTag}** ran out of time and is **eliminated**! ☠️\n✅ Correct answer: **${correctOption}**`
            : `**${playerTag}** ran out of time.\n✅ Correct answer: **${correctOption}**`,
        },
        { type: 14, divider: true,  spacing: 1 },
        { type: 10, content: `📊 **Scoreboard**\n${scoreboardText(game)}` },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `-# Next question loading...` },
      ],
    }],
  };
}

function cvError(msg) {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      accent_color: ACCENT.RED,
      components: [
        { type: 10, content: `# ❌ Error` },
        { type: 10, content: msg },
        { type: 10, content: `-# Skipping turn...` },
      ],
    }],
  };
}

function cvResults(results) {
  const medals  = ['🥇', '🥈', '🥉'];
  const podium  = results.slice(0, 3).map((r, i) =>
    `${medals[i]} **${r.tag}** — ${r.score} pts`
  ).join('\n');

  const board = results.map((r) =>
    `\`#${r.rank}\` ${r.eliminated ? `~~${r.tag}~~` : r.tag} — ${r.score} pts${r.eliminated ? ' ☠️' : ''}`
  ).join('\n');

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      accent_color: ACCENT.PURPLE,
      components: [
        { type: 10, content: `# 🏆 Game Over!` },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: `**${results[0]?.tag ?? 'Nobody'}** wins the crown! 👑` },
        { type: 14, divider: true,  spacing: 1 },
        { type: 10, content: `## 🏅 Podium\n${podium || 'No data'}` },
        { type: 14, divider: true,  spacing: 1 },
        { type: 10, content: `## 📊 Final Scoreboard\n${board || 'No data'}` },
        { type: 14, divider: true,  spacing: 1 },
        { type: 10, content: `-# Run /trivia to play again!` },
      ],
    }],
  };
}

function cvCancelled() {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      accent_color: ACCENT.RED,
      components: [
        { type: 10, content: `# ❌ Game Cancelled` },
        { type: 10, content: `The host cancelled the game.` },
        { type: 10, content: `-# Run /trivia to start a new game.` },
      ],
    }],
  };
}

function cvTimeout_lobby() {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [{
      type: 17,
      accent_color: ACCENT.AMBER,
      components: [
        { type: 10, content: `# ⏰ Lobby Expired` },
        { type: 10, content: `No one started the game in time.` },
        { type: 10, content: `-# Run /trivia to start a new game.` },
      ],
    }],
  };
}

async function runNextQuestion(game, channel) {
  if (game.isOver) {
    try { await showResults(game, channel); } catch (e) { console.error('[TR] showResults:', e); }
    finally { activeGames.delete(game.channelId); }
    return;
  }

  let msg;
  const playerTag = game.players.get(game.currentPlayerId)?.tag ?? 'Player';

  try {
    msg = await channel.send(cvLoading(playerTag));
  } catch (e) {
    console.error('[TR] send loading:', e);
    activeGames.delete(game.channelId);
    return;
  }

  let q;
  try {
    q = await game.fetchQuestion();
  } catch (e) {
    console.error('[TR] fetchQuestion:', e);
    await safeEdit(msg, { ...cvError('Failed to generate question.'), components: cvError('Failed to generate question.').components });
    game.advance();
    setTimeout(() => runNextQuestion(game, channel), 2500);
    return;
  }

  try {
    await msg.edit({ ...cvQuestion(game), components: [...cvQuestion(game).components, ...buildAnswerButtons(false)] });
  } catch (e) {
    console.error('[TR] edit question:', e);
    game.advance();
    setTimeout(() => runNextQuestion(game, channel), 2000);
    return;
  }

  let timedOut = false;

  game.timerTimeout = setTimeout(async () => {
    if (game.answered) return;
    timedOut = true;
    const result = game.handleTimeout();
    if (!result) return;
    const curTag = game.players.get(game.currentPlayerId)?.tag ?? 'Player';
    const payload = cvTimeout(game, curTag, result.correctOption, result.eliminated);
    await safeEdit(msg, { ...payload, components: [...payload.components, ...buildAnswerButtons(true, q.answer)] });
    game.advance();
    setTimeout(() => runNextQuestion(game, channel), 3500);
  }, 20_000);

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 21_000,
  });

  collector.on('collect', async (i) => {
    try {
      if (timedOut || game.answered) { await safeDeferUpdate(i); return; }
      if (!i.customId.startsWith('trivia_ans_')) { await safeDeferUpdate(i); return; }

      if (i.user.id !== game.currentPlayerId) {
        return await safeReply(i, {
          flags: MessageFlags.IsComponentsV2,
          components: [{
            type: 17, accent_color: ACCENT.AMBER,
            components: [{ type: 10, content: `❌ It's not your turn!` }],
          }],
        });
      }

      clearTimeout(game.timerTimeout);

      const idx = parseInt(i.customId.split('_')[2]);
      if (isNaN(idx) || idx < 0 || idx > 3) { await safeDeferUpdate(i); return; }

      const result = game.submitAnswer(i.user.id, idx);
      if (!result) { await safeDeferUpdate(i); return; }

      const pTag = game.players.get(i.user.id)?.tag ?? 'Player';
      let payload;

      if (result.correct) {
        payload = cvCorrect(game, pTag, result.points, q.explanation ?? '—');
      } else if (result.eliminated) {
        payload = cvWrong(game, pTag, result.correctOption, q.explanation ?? '—', true);
      } else {
        payload = cvWrong(game, pTag, result.correctOption, q.explanation ?? '—', false);
      }

      const revealBtns = buildAnswerButtons(true, q.answer, !result.correct ? idx : null);
      await safeUpdate(i, { ...payload, components: [...payload.components, ...revealBtns] });

      game.advance();
      collector.stop('answered');
      setTimeout(() => runNextQuestion(game, channel), 3500);
    } catch (e) {
      console.error('[TR] collector collect:', e);
      try { await safeDeferUpdate(i); } catch (_) {}
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time' && !timedOut && !game.answered) {
      clearTimeout(game.timerTimeout);
      const result = game.handleTimeout();
      if (!result) return;
      const curTag = game.players.get(game.currentPlayerId)?.tag ?? 'Player';
      const payload = cvTimeout(game, curTag, result.correctOption, result.eliminated);
      await safeEdit(msg, { ...payload, components: [...payload.components, ...buildAnswerButtons(true, q.answer)] });
      game.advance();
      setTimeout(() => runNextQuestion(game, channel), 3500);
    }
  });
}

async function showResults(game, channel) {
  const results = game.getResults();
  if (!results.length) return;
  await channel.send(cvResults(results));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Start a TriviaRoyale elimination game!')
    .addIntegerOption(o =>
      o.setName('rounds').setDescription('Rounds per player (3–10, default 5)').setMinValue(3).setMaxValue(10)
    )
    .addStringOption(o =>
      o.setName('difficulty').setDescription('Question difficulty (default: mixed)')
        .addChoices(
          { name: '🎲 Mixed',  value: 'mixed'  },
          { name: '🟢 Easy',   value: 'easy'   },
          { name: '🟡 Medium', value: 'medium' },
          { name: '🔴 Hard',   value: 'hard'   },
        )
    )
    .addStringOption(o =>
      o.setName('custom_topic').setDescription('Add a custom topic (e.g. Bollywood, Minecraft)')
    ),

  async execute(interaction) {
    try {
      if (activeGames.has(interaction.channelId)) {
        return await safeReply(interaction, {
          flags: MessageFlags.IsComponentsV2,
          components: [{
            type: 17, accent_color: ACCENT.AMBER,
            components: [{ type: 10, content: `⚠️ A game is already running in this channel!` }],
          }],
        });
      }

      const rounds     = interaction.options.getInteger('rounds')     ?? 5;
      const difficulty = interaction.options.getString('difficulty')  ?? 'mixed';
      const customTopic = interaction.options.getString('custom_topic');

      const topicOpts = TOPICS.map(t =>
        new StringSelectMenuOptionBuilder().setLabel(t.label).setValue(t.value).setEmoji(t.emoji)
      );
      if (customTopic) {
        topicOpts.push(new StringSelectMenuOptionBuilder().setLabel(customTopic).setValue(customTopic).setEmoji('✨'));
      }

      const topicSelect = new StringSelectMenuBuilder()
        .setCustomId('tr_topics')
        .setPlaceholder('📚 Choose 1–3 topics...')
        .setMinValues(1).setMaxValues(3)
        .addOptions(topicOpts);

      const lobbyBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tr_join')  .setLabel('Join Game') .setEmoji('✋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('tr_start') .setLabel('Start Game').setEmoji('▶️').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('tr_cancel').setLabel('Cancel')    .setStyle(ButtonStyle.Danger),
      );

      const lobbyPlayers = new Map();
      lobbyPlayers.set(interaction.user.id, { tag: interaction.user.username, score: 0, eliminated: false });
      let selectedTopics = ['General Knowledge'];

      const getLobby = () => ({
        ...cvLobby(interaction.user.username, lobbyPlayers, selectedTopics, rounds, difficulty),
        components: [
          ...cvLobby(interaction.user.username, lobbyPlayers, selectedTopics, rounds, difficulty).components,
          new ActionRowBuilder().addComponents(topicSelect),
          lobbyBtns,
        ],
      });

      await interaction.reply(getLobby());

      const lobbyMsg = await interaction.fetchReply();
      const lc = lobbyMsg.createMessageComponentCollector({ time: 120_000 });

      lc.on('collect', async (i) => {
        try {
          if (i.customId === 'tr_topics') {
            if (i.user.id !== interaction.user.id)
              return await safeReply(i, { content: '❌ Only the host can pick topics.', ephemeral: true });
            selectedTopics = i.values;
            return await safeUpdate(i, getLobby());
          }

          if (i.customId === 'tr_join') {
            if (lobbyPlayers.has(i.user.id))
              return await safeReply(i, { content: '❌ You\'re already in the lobby!', ephemeral: true });
            if (lobbyPlayers.size >= 6)
              return await safeReply(i, { content: '❌ Lobby is full (max 6 players).', ephemeral: true });
            lobbyPlayers.set(i.user.id, { tag: i.user.username, score: 0, eliminated: false });
            return await safeUpdate(i, getLobby());
          }

          if (i.customId === 'tr_cancel') {
            if (i.user.id !== interaction.user.id)
              return await safeReply(i, { content: '❌ Only the host can cancel.', ephemeral: true });
            lc.stop('cancelled');
            return await safeUpdate(i, { ...cvCancelled(), components: cvCancelled().components });
          }

          if (i.customId === 'tr_start') {
            if (i.user.id !== interaction.user.id)
              return await safeReply(i, { content: '❌ Only the host can start.', ephemeral: true });
            if (lobbyPlayers.size < 2)
              return await safeReply(i, { content: '❌ Need at least 2 players to start!', ephemeral: true });

            lc.stop('started');

            const game = new TriviaGame({
              channelId : interaction.channelId,
              hostId    : interaction.user.id,
              players   : lobbyPlayers,
              topics    : selectedTopics,
              rounds,
              difficulty,
            });
            activeGames.set(interaction.channelId, game);

            const startPayload = cvStarting(lobbyPlayers.size, selectedTopics, rounds, difficulty);
            await safeUpdate(i, { ...startPayload, components: startPayload.components });
            setTimeout(() => runNextQuestion(game, interaction.channel), 2000);
          }
        } catch (e) {
          console.error('[TR] lobby collect:', e);
          try { await safeDeferUpdate(i); } catch (_) {}
        }
      });

      lc.on('end', async (_, reason) => {
        if (reason === 'time') {
          try {
            const p = cvTimeout_lobby();
            await interaction.editReply({ ...p, components: p.components });
          } catch (_) {}
        }
      });
    } catch (e) {
      console.error('[TR] execute:', e);
      try { await safeReply(interaction, { content: '❌ Failed to start. Try again!', ephemeral: true }); } catch (_) {}
    }
  },
};
