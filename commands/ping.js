const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency and connection status'),

  async execute(interaction) {
    try {
      const sent = await interaction.deferReply({ fetchReply: true });
      const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
      const ws = interaction.client.ws.ping;

      const getStatus = (ms) => {
        if (ms < 100) return { label: 'Excellent', emoji: '🟢' };
        if (ms < 200) return { label: 'Good', emoji: '🟡' };
        return { label: 'Poor', emoji: '🔴' };
      };

      const rt = getStatus(roundtrip);
      const wsStatus = getStatus(ws);

      await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [
          {
            type: 17,
            accent_color: 0x534ab7,
            components: [
              { type: 10, content: '# 🏓 Pong!' },
              { type: 14, divider: false, spacing: 1 },
              {
                type: 10,
                content: `${rt.emoji} **Roundtrip** — \`${roundtrip}ms\` — ${rt.label}\n${wsStatus.emoji} **WebSocket** — \`${ws}ms\` — ${wsStatus.label}`,
              },
              { type: 14, divider: true, spacing: 1 },
              { type: 10, content: `-# TriviaRoyale • ${new Date().toUTCString()}` },
            ],
          },
        ],
      });
    } catch (err) {
      console.error('[ping] error:', err);
      try {
        const payload = { content: '❌ Failed to fetch ping.', ephemeral: true };
        if (interaction.deferred) await interaction.editReply(payload);
        else if (!interaction.replied) await interaction.reply(payload);
      } catch (_) {}
    }
  },
};
