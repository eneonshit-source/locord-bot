require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Store user selections
const userSelections = new Map();

// Prices
const prices = {
  quality: { '360p': 0.12, '480p': 0.16, '720p': 0.21, '1080p': 0.28, '1440p': 0.39, '1660p': 0.52 },
  duration: { '4s': 0.06, '5s': 0.09, '6s': 0.13, '7s': 0.16, '8s': 0.19, '9s': 0.23, '10s': 0.30, '12s': 0.40, '14s': 0.52, '18s': 0.72 },
  steps: { '18': 0.12, '20': 0.16, '25': 0.24, '30': 0.42 },
  clips: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12, '13': 13, '14': 14 }
};

// Calculate total price
function calculatePrice(selection) {
  if (!selection) return 0;
  const q = prices.quality[selection.quality] || 0;
  const d = prices.duration[selection.duration] || 0;
  const s = prices.steps[selection.steps] || 0;
  const c = prices.clips[selection.clips] || 1;
  const total = (q + d + s) * c;
  return total.toFixed(2); // two decimals
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {

  // Slash command
  if (interaction.isChatInputCommand() && interaction.commandName === 'request') {

    // Quality menu
    const qualityMenu = new StringSelectMenuBuilder()
      .setCustomId('quality_select')
      .setPlaceholder('Select video quality')
      .addOptions([
        { label: '360p ($0.12)', value: '360p' },
        { label: '480p ($0.16)', value: '480p' },
        { label: '720p ($0.21)', value: '720p' },
        { label: '1080p ($0.28)', value: '1080p' },
        { label: '1440p ($0.39)', value: '1440p' },
        { label: '1660p ($0.52)', value: '1660p' }
      ]);

    // Duration menu
    const durationMenu = new StringSelectMenuBuilder()
      .setCustomId('duration_select')
      .setPlaceholder('Select video duration')
      .addOptions([
        { label: '4s ($0.06)', value: '4s' },
        { label: '5s ($0.09)', value: '5s' },
        { label: '6s ($0.13)', value: '6s' },
        { label: '7s ($0.16)', value: '7s' },
        { label: '8s ($0.19)', value: '8s' },
        { label: '9s ($0.23)', value: '9s' },
        { label: '10s ($0.30)', value: '10s' },
        { label: '12s ($0.40)', value: '12s' },
        { label: '14s ($0.52)', value: '14s' },
        { label: '18s ($0.72)', value: '18s' }
      ]);

    // Steps menu
    const stepsMenu = new StringSelectMenuBuilder()
      .setCustomId('steps_select')
      .setPlaceholder('Select steps / detail')
      .addOptions([
        { label: '18 - Normal Detail ($0.12)', value: '18' },
        { label: '20 - Better Detail ($0.16)', value: '20' },
        { label: '25 - High Detail ($0.24)', value: '25' },
        { label: '30 - Ultra Detail ($0.42)', value: '30' }
      ]);

    // Clips menu
    const clipsMenu = new StringSelectMenuBuilder()
      .setCustomId('clips_select')
      .setPlaceholder('Select number of clips')
      .addOptions([...Array(14).keys()].map(i => {
        const val = (i + 1).toString();
        return { label: `${val} clip(s)`, value: val };
      }));

    // Generate button
    const button = new ButtonBuilder()
      .setCustomId('generate')
      .setLabel('Generate Request')
      .setStyle(ButtonStyle.Primary);

    // Initialize user selection
    userSelections.set(interaction.user.id, { quality: null, duration: null, steps: null, clips: '1' });

    await interaction.reply({
      content: '🎬 Configure your video request:',
      components: [
        new ActionRowBuilder().addComponents(qualityMenu),
        new ActionRowBuilder().addComponents(durationMenu),
        new ActionRowBuilder().addComponents(stepsMenu),
        new ActionRowBuilder().addComponents(clipsMenu),
        new ActionRowBuilder().addComponents(button)
      ],
      ephemeral: true
    });
  }

  // Handle dropdown selections
  if (interaction.isStringSelectMenu()) {
    const user = interaction.user.id;
    const selection = userSelections.get(user) || { quality: null, duration: null, steps: null, clips: '1' };

    switch (interaction.customId) {
      case 'quality_select': selection.quality = interaction.values[0]; break;
      case 'duration_select': selection.duration = interaction.values[0]; break;
      case 'steps_select': selection.steps = interaction.values[0]; break;
      case 'clips_select': selection.clips = interaction.values[0]; break;
    }

    userSelections.set(user, selection);
    const totalPrice = calculatePrice(selection);

    await interaction.update({
      content: `🎬 Current selection:\n- Quality: **${selection.quality || 'Not selected'}**\n- Duration: **${selection.duration || 'Not selected'}**\n- Steps: **${selection.steps || 'Not selected'}**\n- Clips: **${selection.clips}**\n💰 Total Price: **$${totalPrice}**`,
      components: interaction.message.components,
      ephemeral: true
    });
  }

  // Handle generate button
  if (interaction.isButton() && interaction.customId === 'generate') {
    const user = interaction.user.id;
    const selection = userSelections.get(user);

    if (!selection || !selection.quality || !selection.duration || !selection.steps || !selection.clips) {
      return interaction.reply({ content: '⚠️ Please select all options before generating.', ephemeral: true });
    }

    const totalPrice = calculatePrice(selection);
    const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('📩 New Video Request')
        .addFields(
          { name: 'User', value: interaction.user.tag },
          { name: 'Quality', value: selection.quality },
          { name: 'Duration', value: selection.duration },
          { name: 'Steps', value: selection.steps },
          { name: 'Clips', value: selection.clips },
          { name: 'Total Price', value: `$${totalPrice}` }
        )
        .setColor(0x00FF00);

      await logChannel.send({ embeds: [embed] });
    }

    await interaction.reply({
      content: '🚀 Your request is ready! Click below to continue:',
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Continue')
            .setStyle(ButtonStyle.Link)
            .setURL('https://your-redirect-link.com')
        )
      ],
      ephemeral: true
    });

    userSelections.delete(user);
  }
});

client.login(process.env.BOT_TOKEN);