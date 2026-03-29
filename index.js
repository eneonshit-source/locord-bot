require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
  EmbedBuilder
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// User selections and cooldowns
const userSelections = new Map();
const userCooldowns = new Map();

// Prices
const prices = {
  quality: { '360p': 0.12, '480p': 0.16, '720p': 0.21, '1080p': 0.28, '1440p': 0.39, '1660p': 0.52 },
  duration: { '4s': 0.06, '5s': 0.09, '6s': 0.13, '7s': 0.16, '8s': 0.19, '9s': 0.23, '10s': 0.30, '12s': 0.40, '14s': 0.52, '18s': 0.72 },
  steps: { '18': 0.12, '20': 0.16, '25': 0.24, '30': 0.42 },
  clips: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12, '13': 13, '14': 14 },
  aspect: { '16:9': 0, '9:16': 0, '3:2': 0, '1:1': 0 }
};

function calculatePrice(sel) {
  if (!sel) return 0;
  const q = prices.quality[sel.quality] || 0;
  const d = prices.duration[sel.duration] || 0;
  const s = prices.steps[sel.steps] || 0;
  const c = sel.clips || 1;
  return ((q + d + s) * c).toFixed(2);
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  const user = interaction.user.id;
  const cooldown = 10 * 60 * 1000; // 10 min
  const now = Date.now();

  // Cooldown check
  if (userCooldowns.has(user)) {
    const lastUse = userCooldowns.get(user);
    if (now - lastUse < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastUse)) / 60000);
      return interaction.reply({ content: `⏱ Please wait ${remaining} minute(s) to use LoCord again!`, ephemeral: true });
    }
  }

  // Slash /request
  if (interaction.isChatInputCommand() && interaction.commandName === 'request') {
    userSelections.set(user, { quality: null, duration: null, steps: null, clips: '1', aspect: '16:9', prompt: '' });

    const qualityMenu = new StringSelectMenuBuilder()
      .setCustomId('quality_select')
      .setPlaceholder('Select Quality')
      .addOptions(Object.keys(prices.quality).map(q => ({ label: q, value: q })));

    const durationMenu = new StringSelectMenuBuilder()
      .setCustomId('duration_select')
      .setPlaceholder('Select Duration')
      .addOptions(Object.keys(prices.duration).map(d => ({ label: d, value: d })));

    const stepsMenu = new StringSelectMenuBuilder()
      .setCustomId('steps_select')
      .setPlaceholder('Select Detail/Steps')
      .addOptions(Object.keys(prices.steps).map(s => ({ label: s, value: s })));

    const clipsMenu = new StringSelectMenuBuilder()
      .setCustomId('clips_select')
      .setPlaceholder('Select Clips')
      .addOptions([...Array(14).keys()].map(i => ({ label: `${i + 1} clip(s)`, value: `${i + 1}` })));

    const aspectMenu = new StringSelectMenuBuilder()
      .setCustomId('aspect_select')
      .setPlaceholder('Select Aspect Ratio')
      .addOptions(Object.keys(prices.aspect).map(a => ({ label: a, value: a })));

    const promptButton = new ButtonBuilder()
      .setCustomId('prompt')
      .setLabel('Enter Prompt')
      .setStyle(ButtonStyle.Secondary);

    const confirmButton = new ButtonBuilder()
      .setCustomId('generate')
      .setLabel('Confirm & Generate')
      .setStyle(ButtonStyle.Primary);

    await interaction.reply({
      content: '🎬 Configure your video request:',
      components: [
        new ActionRowBuilder().addComponents(qualityMenu),
        new ActionRowBuilder().addComponents(durationMenu),
        new ActionRowBuilder().addComponents(stepsMenu),
        new ActionRowBuilder().addComponents(clipsMenu),
        new ActionRowBuilder().addComponents(aspectMenu),
        new ActionRowBuilder().addComponents(promptButton, confirmButton) // max 5 rows: merge last row
      ],
      ephemeral: true
    });
  }

  // Dropdown selection
  if (interaction.isStringSelectMenu()) {
    const sel = userSelections.get(user) || {};
    switch (interaction.customId) {
      case 'quality_select': sel.quality = interaction.values[0]; break;
      case 'duration_select': sel.duration = interaction.values[0]; break;
      case 'steps_select': sel.steps = interaction.values[0]; break;
      case 'clips_select': sel.clips = interaction.values[0]; break;
      case 'aspect_select': sel.aspect = interaction.values[0]; break;
    }
    userSelections.set(user, sel);

    const price = calculatePrice(sel);
    await interaction.update({
      content: `🎬 Current selection:\n- Quality: **${sel.quality || 'N/A'}**\n- Duration: **${sel.duration || 'N/A'}**\n- Steps: **${sel.steps || 'N/A'}**\n- Clips: **${sel.clips}**\n- Aspect Ratio: **${sel.aspect || 'N/A'}**\n- Prompt: **${sel.prompt || 'Not set'}**\n💰 Total Price: $${price}`,
      components: interaction.message.components,
      ephemeral: true
    });
  }

  // Button interactions
  if (interaction.isButton()) {
    const sel = userSelections.get(user);

    if (interaction.customId === 'prompt') {
      const modal = new ModalBuilder()
        .setCustomId('prompt_modal')
        .setTitle('Enter your prompt')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('prompt_input')
              .setLabel('Prompt')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Describe your video...')
              .setRequired(true)
          )
        );
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'generate') {
      if (!sel || !sel.quality || !sel.duration || !sel.steps || !sel.clips) {
        return interaction.reply({ content: '⚠️ Please complete all selections!', ephemeral: true });
      }

      userCooldowns.set(user, Date.now());

      const price = calculatePrice(sel);
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('📩 New Video Request')
          .addFields(
            { name: 'User', value: interaction.user.tag },
            { name: 'Quality', value: sel.quality },
            { name: 'Duration', value: sel.duration },
            { name: 'Steps', value: sel.steps },
            { name: 'Clips', value: sel.clips },
            { name: 'Aspect Ratio', value: sel.aspect },
            { name: 'Prompt', value: sel.prompt || 'Not set' },
            { name: 'Total Price', value: `$${price}` }
          )
          .setColor(0x00FF00);
        await logChannel.send({ embeds: [embed] });
      }

      await interaction.reply({
        content: '🚀 Your request has been logged! Click below to continue:',
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
  }

  // Prompt modal submit
  if (interaction.isModalSubmit() && interaction.customId === 'prompt_modal') {
    const sel = userSelections.get(user) || {};
    sel.prompt = interaction.fields.getTextInputValue('prompt_input');
    userSelections.set(user, sel);
    await interaction.reply({ content: `✅ Prompt saved:\n"${sel.prompt}"`, ephemeral: true });
  }
});

client.login(process.env.BOT_TOKEN);