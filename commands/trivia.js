const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  bold,
  userMention,
} = require('discord.js');
const { TriviaGame } = require('../TriviaGame');

const activeGames = new Map();

const TOPICS = [
  { label: 'General Knowledge', value: 'General Knowledge', emoji: '🧠' },
  { label: 'Science & Nature', value: 'Science & Nature', emoji: '🔬' },
  { label: 'World History', value: 'World History', emoji: '📜' },
  { label: 'Pop Culture & Movies', value: 'Pop Culture & Movies', emoji: '🎬' },
  { label: 'Sports', value: 'Sports', emoji: '⚽' },
  { label: 'Geography', value: 'Geography', emoji: '🌍' },
  { label: 'Technology & Computers', value: 'Technology & Computers', emoji: '💻' },
  { label: 'Food & Cooking', value: 'Food & Cooking', emoji: '🍕' },
  { label: 'Music', value: 'Music', emoji: '🎵' },
  { label: 'Anime & Manga', value: 'Anime & Manga', emoji: '⛩️' },
  { label: 'Cricket', value: 'Cricket', emoji: '🏏' },
  { label: 'Mythology', value: 'Mythology', emoji: '⚡' },
];

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_EMOJIS = ['🇦', '🇧', '🇨', '🇩'];

const COLORS = {
  PURPLE: 0x534ab7,
  GREEN: 0x639922,
  RED: 0xa32d2d,
  AMBER: 0xef9f27,
};

function buildScoreField(game) {
  const lines = game.turnOrder.map((id) => {
    const p = game.players.get(id);
    const isCurrent = id === game.currentPlayerId && !game.answered;
    const prefix = p.eliminated ? '~~' : isCurrent ? '**▶ ' : '';
    const suffix = p.eliminated ? '~~' : isCurrent ? '**' : '';
    return `${prefix}${p.tag}: ${p.score} pts${suffix}${p.eliminated ? ' ☠️' : ''}`;
  });
  return lines.join('\n');
}

function buildAnswerButtons(disabled = false, correctIdx = null, wrongIdx = null) {
  const buttons = OPTION_LABELS.map((label, i) => {
    let style = ButtonStyle.Secondary;
    if (correctIdx !== null && i === correctIdx) style = ButtonStyle.Success;
    if (wrongIdx !== null && i === wrongIdx) style = ButtonStyle.Danger;
    return new ButtonBuilder()
      .setCustomId(`trivia_answer_${i}`)
      .setLabel(label)
      .setEmoji(OPTION_EMOJIS[i])
      .setStyle(style)
      .setDisabled(disabled);
  });
  return [
    new ActionRowBuilder().addComponents(buttons[0], buttons[1]),
    new ActionRowBuilder().addComponents(buttons[2], buttons[3]),
  ];
}

function buildQuestionEmbed(game) {
  const q = game.currentQuestion;
  const optionLines = q.options.map((o, i) => `${OPTION_EMOJIS[i]} **${OPTION_LABELS[i]}.** ${o}`);
  return new EmbedBuilder()
    .setColor(COLORS.PURPLE)
    .setTitle(`Round ${game.getCurrentRound()} of ${game.rounds} — ${game.getCurrentTopic()}`)
    .setDescription(
      `**${userMention(game.currentPlayerId)}'s turn!**\n\n${bold(q.question)}\n\n${optionLines.join('\n')}`
    )
    .addFields({ name: 'Scoreboard', value: buildScoreField(game), inline: false })
    .setFooter({ text: '⏱ You have 20 seconds • Faster = more points (max 3)' });
}

async function runNextQuestion(game, channel) {
  if (game.isOver) {
    await showResults(game, channel);
    activeGames.delete(game.channelId);
    return;
  }

  const loadingEmbed = new EmbedBuilder()
    .setColor(COLORS.PURPLE)
    .setDescription(`⏳ Generating question for **${game.players.get(game.currentPlayerId).tag}**...`);

  const msg = await channel.send({ embeds: [loadingEmbed] });

  let q;
  try {
    q = await game.fetchQuestion();
  } catch (err) {
    await msg.edit({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.RED)
          .setDescription('❌ Failed to generate question. Skipping turn...'),
      ],
    });
    game.advance();
    setTimeout(() => runNextQuestion(game, channel), 2000);
    return;
  }

  await msg.edit({ embeds: [buildQuestionEmbed(game)], components: buildAnswerButtons(false) });

  game.timerTimeout = setTimeout(async () => {
    const result = game.handleTimeout();
    if (!result) return;

    const timeoutEmbed = new EmbedBuilder()
      .setColor(COLORS.AMBER)
      .setTitle('⏰ Time\'s up!')
      .setDescription(
        result.eliminated
          ? `${userMention(game.currentPlayerId)} took too long and is **eliminated**! ☠️\nCorrect answer: **${result.correctOption}**`
          : `Time ran out! The correct answer was **${result.correctOption}**.`
      )
      .addFields({ name: 'Scoreboard', value: buildScoreField(game) });

    await msg.edit({ embeds: [timeoutEmbed], components: buildAnswerButtons(true, q.answer) });
    game.advance();
    setTimeout(() => runNextQuestion(game, channel), 3500);
  }, 20_000);

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) => i.customId.startsWith('trivia_answer_') && i.user.id === game.currentPlayerId,
    max: 1,
    time: 20_500,
  });

  collector.on('collect', async (interaction) => {
    clearTimeout(game.timerTimeout);
    const answerIdx = parseInt(interaction.customId.split('_')[2]);
    const result = game.submitAnswer(interaction.user.id, answerIdx);
    if (!result) { await interaction.deferUpdate(); return; }

    const revealedButtons = buildAnswerButtons(true, q.answer, !result.correct ? answerIdx : null);

    let resultEmbed;
    if (result.correct) {
      resultEmbed = new EmbedBuilder()
        .setColor(COLORS.GREEN)
        .setTitle(`✅ Correct! +${result.points} point${result.points !== 1 ? 's' : ''}`)
        .setDescription(
          `${userMention(interaction.user.id)} earned **${result.points} pts**!\n\n💡 ${q.explanation}`
        )
        .addFields({ name: 'Scoreboard', value: buildScoreField(game) });
    } else if (result.eliminated) {
      resultEmbed = new EmbedBuilder()
        .setColor(COLORS.RED)
        .setTitle(`☠️ ${game.players.get(interaction.user.id).tag} is eliminated!`)
        .setDescription(`Wrong answer.\nCorrect: **${result.correctOption}**\n\n💡 ${result.explanation}`)
        .addFields({ name: 'Scoreboard', value: buildScoreField(game) });
    } else {
      resultEmbed = new EmbedBuilder()
        .setColor(COLORS.AMBER)
        .setTitle('❌ Wrong answer!')
        .setDescription(`Correct: **${result.correctOption}**\n\n💡 ${result.explanation}`)
        .addFields({ name: 'Scoreboard', value: buildScoreField(game) });
    }

    await interaction.update({ embeds: [resultEmbed], components: revealedButtons });
    game.advance();
    setTimeout(() => runNextQuestion(game, channel), 3500);
  });
}

async function showResults(game, channel) {
  const results = game.getResults();
  const winner = results[0];

  const podium = results
    .slice(0, 3)
    .map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${r.tag} — **${r.score} pts**`)
    .join('\n');

  const fullBoard = results
    .map(
      (r) =>
        `\`#${r.rank}\` ${r.eliminated ? '~~' : ''}${r.tag}${r.eliminated ? '~~' : ''} — ${r.score} pts${r.eliminated ? ' ☠️' : ''}`
    )
    .join('\n');

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.PURPLE)
        .setTitle('🏆 TriviaRoyale — Game Over!')
        .setDescription(`**${winner.tag} wins the crown!** 👑`)
        .addFields(
          { name: '🏅 Podium', value: podium || 'No data', inline: false },
          { name: '📊 Full Results', value: fullBoard || 'No data', inline: false }
        )
        .setFooter({ text: 'Run /trivia to play again!' }),
    ],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Start a TriviaRoyale elimination game!')
    .addIntegerOption((opt) =>
      opt.setName('rounds').setDescription('Rounds per player (default: 5)').setMinValue(3).setMaxValue(10)
    )
    .addStringOption((opt) =>
      opt
        .setName('difficulty')
        .setDescription('Question difficulty (default: mixed)')
        .addChoices(
          { name: '🎲 Mixed', value: 'mixed' },
          { name: '🟢 Easy', value: 'easy' },
          { name: '🟡 Medium', value: 'medium' },
          { name: '🔴 Hard', value: 'hard' }
        )
    )
    .addStringOption((opt) =>
      opt.setName('custom_topic').setDescription('Add a custom topic (e.g. Bollywood, Minecraft)')
    ),

  async execute(interaction) {
    if (activeGames.has(interaction.channelId)) {
      return interaction.reply({
        content: '❌ A TriviaRoyale game is already running in this channel!',
        ephemeral: true,
      });
    }

    const rounds = interaction.options.getInteger('rounds') ?? 5;
    const difficulty = interaction.options.getString('difficulty') ?? 'mixed';
    const customTopic = interaction.options.getString('custom_topic');

    const topicOptions = TOPICS.map((t) =>
      new StringSelectMenuOptionBuilder().setLabel(t.label).setValue(t.value).setEmoji(t.emoji)
    );
    if (customTopic) {
      topicOptions.push(
        new StringSelectMenuOptionBuilder().setLabel(customTopic).setValue(customTopic).setEmoji('✨')
      );
    }

    const topicSelect = new StringSelectMenuBuilder()
      .setCustomId('trivia_topics')
      .setPlaceholder('Choose 1–3 topics...')
      .setMinValues(1)
      .setMaxValues(3)
      .addOptions(topicOptions);

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('trivia_join').setLabel('Join Game').setEmoji('✋').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('trivia_start').setLabel('Start Game').setEmoji('▶️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('trivia_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    const lobbyPlayers = new Map();
    lobbyPlayers.set(interaction.user.id, { tag: interaction.user.username, score: 0, eliminated: false });
    let selectedTopics = ['General Knowledge'];

    const buildLobbyEmbed = () =>
      new EmbedBuilder()
        .setColor(COLORS.PURPLE)
        .setTitle('🏆 TriviaRoyale — Lobby')
        .setDescription(`${bold(interaction.user.username)} is hosting a game!\n\nPress **Join Game** to join.`)
        .addFields(
          {
            name: '👥 Players',
            value: [...lobbyPlayers.values()].map((p) => `• ${p.tag}`).join('\n') || 'None',
            inline: true,
          },
          {
            name: '⚙️ Settings',
            value: `Topics: ${selectedTopics.join(', ')}\nRounds: ${rounds}\nDifficulty: ${difficulty}`,
            inline: true,
          }
        )
        .setFooter({ text: 'Min 2 players to start • Max 6 players' });

    await interaction.reply({
      embeds: [buildLobbyEmbed()],
      components: [new ActionRowBuilder().addComponents(topicSelect), buttonRow],
    });

    const lobbyMsg = await interaction.fetchReply();
    const lobbyCollector = lobbyMsg.createMessageComponentCollector({ time: 120_000 });

    lobbyCollector.on('collect', async (i) => {
      if (i.customId === 'trivia_topics') {
        if (i.user.id !== interaction.user.id)
          return i.reply({ content: 'Only the host can pick topics.', ephemeral: true });
        selectedTopics = i.values;
        return i.update({
          embeds: [buildLobbyEmbed()],
          components: [new ActionRowBuilder().addComponents(topicSelect), buttonRow],
        });
      }

      if (i.customId === 'trivia_join') {
        if (lobbyPlayers.has(i.user.id))
          return i.reply({ content: 'You\'re already in the lobby!', ephemeral: true });
        if (lobbyPlayers.size >= 6)
          return i.reply({ content: 'Lobby is full (max 6 players).', ephemeral: true });
        lobbyPlayers.set(i.user.id, { tag: i.user.username, score: 0, eliminated: false });
        return i.update({
          embeds: [buildLobbyEmbed()],
          components: [new ActionRowBuilder().addComponents(topicSelect), buttonRow],
        });
      }

      if (i.customId === 'trivia_cancel') {
        if (i.user.id !== interaction.user.id)
          return i.reply({ content: 'Only the host can cancel.', ephemeral: true });
        lobbyCollector.stop('cancelled');
        return i.update({
          embeds: [new EmbedBuilder().setColor(COLORS.RED).setDescription('❌ Game cancelled.')],
          components: [],
        });
      }

      if (i.customId === 'trivia_start') {
        if (i.user.id !== interaction.user.id)
          return i.reply({ content: 'Only the host can start.', ephemeral: true });
        if (lobbyPlayers.size < 2)
          return i.reply({ content: 'Need at least 2 players to start!', ephemeral: true });

        lobbyCollector.stop('started');

        const game = new TriviaGame({
          channelId: interaction.channelId,
          hostId: interaction.user.id,
          players: lobbyPlayers,
          topics: selectedTopics,
          rounds,
          difficulty,
        });
        activeGames.set(interaction.channelId, game);

        await i.update({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.PURPLE)
              .setTitle('🏆 TriviaRoyale — Starting!')
              .setDescription(
                `**${lobbyPlayers.size} players** locked in!\nTopics: ${selectedTopics.join(', ')}\nRounds: ${rounds} | Difficulty: ${difficulty}\n\nFirst question incoming...`
              ),
          ],
          components: [],
        });

        setTimeout(() => runNextQuestion(game, interaction.channel), 2000);
      }
    });

    lobbyCollector.on('end', (_, reason) => {
      if (reason === 'time') {
        interaction.editReply({
          embeds: [new EmbedBuilder().setColor(COLORS.RED).setDescription('⏰ Lobby timed out.')],
          components: [],
        });
      }
    });
  },
};
