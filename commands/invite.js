const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get the invite link to add TriviaRoyale to your server'),

  async execute(interaction) {
    try {
      const clientId = interaction.client.user.id;
      const perms = '277025392640';
      const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${perms}&scope=bot+applications.commands`;

      await interaction.reply({
        flags: MessageFlags.IsComponentsV2,
        components: [
          {
            type: 17,
            accent_color: 0x534ab7,
            components: [
              { type: 10, content: '# 📨 Invite TriviaRoyale' },
              { type: 10, content: 'Add TriviaRoyale to your server and start playing AI-powered elimination trivia with your friends!' },
              { type: 14, divider: true, spacing: 1 },
              { type: 10, content: '✅ **Permissions included:**\nSend Messages • Embed Links • Read Message History • Use Application Commands' },
              { type: 14, divider: false, spacing: 1 },
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 5,
                    label: 'Invite Bot',
                    emoji: { name: '🏆' },
                    url: inviteUrl,
                  },
                ],
              },
              { type: 14, divider: true, spacing: 1 },
              { type: 10, content: '-# TriviaRoyale • /help for all commands' },
            ],
          },
        ],
      });
    } catch (err) {
      console.error('[invite] error:', err);
      try {
        const payload = { content: '❌ Failed to generate invite link.', ephemeral: true };
        if (!interaction.replied && !interaction.deferred) await interaction.reply(payload);
      } catch (_) {}
    }
  },
};
