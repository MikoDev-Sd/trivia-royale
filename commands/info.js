const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Bot info, stats, and technical details'),

  async execute(interaction) {
    try {
      const client = interaction.client;
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;
      const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      const guildCount = client.guilds.cache.size;
      const ping = client.ws.ping;

      await interaction.reply({
        flags: MessageFlags.IsComponentsV2,
        components: [
          {
            type: 17,
            accent_color: 0x534ab7,
            components: [
              { type: 10, content: '# 🏆 TriviaRoyale' },
              { type: 10, content: 'AI-powered multiplayer elimination trivia bot. Powered by **Groq** (llama-3.3-70b) for lightning-fast question generation.' },
              { type: 14, divider: true, spacing: 1 },
              { type: 10, content: '## 📊 Stats' },
              { type: 10, content: `🌐 **Servers** — \`${guildCount}\`\n⏱️ **Uptime** — \`${uptimeStr}\`\n🏓 **Ping** — \`${ping}ms\`\n💾 **Memory** — \`${memUsage} MB\`` },
              { type: 14, divider: true, spacing: 1 },
              { type: 10, content: '## ⚙️ Technical' },
              { type: 10, content: `📦 **discord.js** — \`v${require('discord.js').version}\`\n🟢 **Node.js** — \`${process.version}\`\n🤖 **AI Model** — \`llama-3.3-70b-versatile\`\n⚡ **API** — \`Groq (free tier)\`` },
              { type: 14, divider: true, spacing: 1 },
              { type: 10, content: '## 🎮 Features' },
              { type: 10, content: '• 12 built-in topic packs + custom topics\n• 2–6 players per game\n• Elimination rounds with speed scoring\n• AI-generated unique questions every game\n• 20 second timer per question' },
              { type: 14, divider: true, spacing: 1 },
              { type: 10, content: '-# TriviaRoyale • /help for all commands' },
            ],
          },
        ],
      });
    } catch (err) {
      console.error('[info] error:', err);
      try {
        const payload = { content: '❌ Failed to fetch info.', ephemeral: true };
        if (!interaction.replied && !interaction.deferred) await interaction.reply(payload);
      } catch (_) {}
    }
  },
};
