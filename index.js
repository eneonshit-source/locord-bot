require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Store selections & cooldowns
const userSelections = new Map();
const userCooldowns = new Map();

// Prices
const prices = {
  quality: { '360p': 0.12, '480p': 0.16, '720p': 0.21, '1080p': 0.28, '1440p': 0.39, '1660p': 0.52 },
  duration: { '4s': 0.06, '5s': 0.09, '6s': 0.13, '7s': 0.16, '8s': 0.19, '9s': 0.23, '10s': 0.30, '12s': 0.40, '14s': 0.52, '18s': 0.72 },
  steps: { '18': 0.12, '20': 0.16, '25': 0.24, '30': 0.42 },
  clips: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12, '13': 13, '14': 14 }
};

function calculatePrice(selection) {
  if (!selection) return 0;
  const q = prices.quality[selection.quality] || 0;
  const d = prices.duration[selection.duration] || 0;
  const s = prices.steps[selection.steps] || 0;
  const c = selection.clips || 1;
  return ((q + d + s) * c).toFixed(2);
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  const user = interaction.user.id;
  const cooldown = 10 * 60 * 1000;
  const now = Date.now();

  // Cooldown check
  if (userCooldowns.has(user)) {
    const lastUse = userCooldowns.get(user);
    if (now - lastUse < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastUse)) / 60000);
      return interaction.reply({ content: `⏱ Please wait ${remaining} minute(s) to use LoCord again!`, ephemeral: true });
    }
  }

  // /request command
  if (interaction.isChatInputCommand() && interaction.commandName === 'request') {
    await interaction.deferReply({ ephemeral: true });

    // Menus
    const qualityMenu = new StringSelectMenuBuilder()
      .setCustomId('quality_select')
      .setPlaceholder('Select Quality')
      .addOptions(Object.keys(prices.quality).map(q => ({ label: `${q} ($${prices.quality[q]})`, value: q })));

    const durationMenu = new StringSelectMenuBuilder()
      .setCustomId('duration_select')
      .setPlaceholder('Select Duration')
      .addOptions(Object.keys(prices.duration).map(d => ({ label: `${d} ($${prices.duration[d]})`, value: d })));

    const stepsMenu = new StringSelectMenuBuilder()
      .setCustomId('steps_select')
      .setPlaceholder('Select Steps/Detail')
      .addOptions(Object.keys(prices.steps).map(s => ({ label: `${s} - Detail ($${prices.steps[s]})`, value: s })));

    const clipsMenu = new StringSelectMenuBuilder()
      .setCustomId('clips_select')
      .setPlaceholder('Select Number of Clips')
      .addOptions([...Array(14).keys()].map(i => ({ label: `${i+1} clip(s)`, value: `${i+1}` })));

    const aspectMenu = new StringSelectMenuBuilder()
      .setCustomId('aspect_select')
      .setPlaceholder('Select Aspect Ratio')
      .addOptions([
        { label: '16:9', value: '16:9' },
        { label: '9:16', value: '9:16' },
        { label: '3:2', value: '3:2' },
        { label: '1:1', value: '1:1' }
      ]);

    const promptButton = new ButtonBuilder()
      .setCustomId('prompt')
      .setLabel('Enter Prompt')
      .setStyle(ButtonStyle.Secondary);

    const confirmButton = new ButtonBuilder()
      .setCustomId('generate')
      .setLabel('Confirm & Generate')
      .setStyle(ButtonStyle.Primary);

    // Initialize
    userSelections.set(user, { quality: null, duration: null, steps: null, clips: '1', aspect: '16:9', prompt: '' });

    // Reply with max 5 rows
    await interaction.editReply({
      content: '🎬 Configure your video request:',
      components: [
        new ActionRowBuilder().addComponents(qualityMenu),
        new ActionRowBuilder().addComponents(durationMenu),
        new ActionRowBuilder().addComponents(stepsMenu),
        new ActionRowBuilder().addComponents(clipsMenu),
        new ActionRowBuilder().addComponents(aspectMenu),
        new ActionRowBuilder().addComponents(promptButton, confirmButton)
      ].slice(0,5)
    });
  }

  // Dropdown handlers
  if (interaction.isStringSelectMenu()) {
    const selection = userSelections.get(user);
    switch (interaction.customId) {
      case 'quality_select': selection.quality = interaction.values[0]; break;
      case 'duration_select': selection.duration = interaction.values[0]; break;
      case 'steps_select': selection.steps = interaction.values[0]; break;
      case 'clips_select': selection.clips = interaction.values[0]; break;
      case 'aspect_select': selection.aspect = interaction.values[0]; break;
    }
    userSelections.set(user, selection);

    await interaction.update({
      content: `🎬 Current selection:\n- Quality: **${selection.quality || 'Not set'}**\n- Duration: **${selection.duration || 'Not set'}**\n- Steps: **${selection.steps || 'Not set'}**\n- Clips: **${selection.clips}**\n- Aspect: **${selection.aspect}**\n- Prompt: **${selection.prompt || 'Not set'}**\n💰 Total Price: **$${calculatePrice(selection)}**`,
      components: interaction.message.components
    });
  }

  // Button handlers
  if (interaction.isButton()) {
    const selection = userSelections.get(user);

    // Prompt modal
    if (interaction.customId === 'prompt') {
      const modal = new ModalBuilder()
        .setCustomId('prompt_modal')
        .setTitle('Enter your Prompt')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('prompt_input')
              .setLabel('Prompt')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Describe your video request...')
              .setRequired(true)
          )
        );
      return interaction.showModal(modal);
    }

    // Generate / Confirm
    if (interaction.customId === 'generate') {
      if (!selection || !selection.quality || !selection.duration || !selection.steps || !selection.clips) {
        return interaction.reply({ content: '⚠️ Please select all options before generating.', ephemeral: true });
      }

      userCooldowns.set(user, now);

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
            { name: 'Aspect', value: selection.aspect },
            { name: 'Prompt', value: selection.prompt || 'Not set' },
            { name: 'Total Price', value: `$${totalPrice}` }
          )
          .setColor(0x00FF00);
        await logChannel.send({ embeds: [embed] });
      }

      await interaction.reply({
        content: '🚀 Your request has been generated! Click below to continue:',
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

  // Modal submit
  if (interaction.isModalSubmit() && interaction.customId === 'prompt_modal') {
    const selection = userSelections.get(user);
    const prompt = interaction.fields.getTextInputValue('prompt_input');
    selection.prompt = prompt;
    userSelections.set(user, selection);
    await interaction.reply({ content: `✅ Prompt saved:\n"${prompt}"`, ephemeral: true });
  }
});

client.login(process.env.BOT_TOKEN);