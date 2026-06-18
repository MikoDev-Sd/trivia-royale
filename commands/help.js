const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('All TriviaRoyale commands and how to play'),

  async execute(interaction) {
    try {
      await interaction.reply({
        flags: MessageFlags.IsComponentsV2,
        components: [
          {
            type: 17,
            accent_color: 0x534ab7,
            components: [
              { type: 10, content: '# 🏆 TriviaRoyale — Help' },
              { type: 10, content: 'AI-powered multiplayer elimination trivia. Answer questions, outlast opponents, claim the crown.' },
              { type: 14, divider: true, spacing: 1 },
              { type: 10, content: '## 🎮 Game Commands' },
              { type: 10, content: '`/trivia` — Start a new game\n`/trivia rounds:7` — Set rounds per player *(3–10)*\n`/trivia difficulty:hard` — Set difficulty *(easy / medium / hard / mixed)*\n`/trivia custom_topic:Bollywood` — Add a custom topic' },
              { type: 14, divider: true, spacing: 1 },
              { type: 10, content: '## 🛠️ Utility Commands' },
              { type: 10, content: '`/help` — Show this menu\n`/ping` — Check bot latency\n`/info` — Bot info and stats\n`/invite` — Invite TriviaRoyale to your server' },
              { type: 14, divider: true, spacing: 1 },
              { type: 10, content: '## 📖 How to Play' },
              { type: 10, content: '**1.** Host runs `/trivia` and picks topics\n**2.** Others press **Join Game** *(up to 6 players)*\n**3.** Host presses **Start Game**\n**4.** Each player gets a turn — answer A/B/C/D in 20 seconds\n**5.** Wrong answer = **eliminated** ☠️ *(when 3+ players alive)*\n**6.** Faster answers = more points *(3 / 2 / 1)*\n**7.** Last one standing wins 👑' },
              { type: 14, divider: true, spacing: 1 },
              { type: 10, content: '-# TriviaRoyale • Use /trivia to start a game!' },
            ],
          },
        ],
      });
    } catch (err) {
      console.error('[help] error:', err);
      try {
        const payload = { content: '❌ Failed to show help.', ephemeral: true };
        if (!interaction.replied && !interaction.deferred) await interaction.reply(payload);
      } catch (_) {}
    }
  },
};
