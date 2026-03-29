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

// Calculate total price
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
  const userId = interaction.user.id;
  const cooldown = 10 * 60 * 1000;
  const now = Date.now();

  // Cooldown check
  if (userCooldowns.has(userId)) {
    const last = userCooldowns.get(userId);
    if (now - last < cooldown) {
      const remaining = Math.ceil((cooldown - (now - last)) / 60000);
      return interaction.reply({ content: `⏱ Please wait ${remaining} minute(s) to use LoCord again!`, ephemeral: true });
    }
  }

  // Handle /request
  if (interaction.isChatInputCommand() && interaction.commandName === 'request') {
    // Initialize user selection
    userSelections.set(userId, { quality: null, duration: null, steps: null, clips: '1', prompt: '', aspect: '16:9' });

    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    // Build menus
    const qualityMenu = new StringSelectMenuBuilder()
      .setCustomId('quality_select')
      .setPlaceholder('Select Quality')
      .addOptions(Object.entries(prices.quality).map(([k, v]) => ({ label: `${k} ($${v})`, value: k })));

    const durationMenu = new StringSelectMenuBuilder()
      .setCustomId('duration_select')
      .setPlaceholder('Select Duration')
      .addOptions(Object.entries(prices.duration).map(([k, v]) => ({ label: `${k} ($${v})`, value: k })));

    const stepsMenu = new StringSelectMenuBuilder()
      .setCustomId('steps_select')
      .setPlaceholder('Select Detail')
      .addOptions(Object.entries(prices.steps).map(([k, v]) => ({ label: `${k} ($${v})`, value: k })));

    const clipsMenu = new StringSelectMenuBuilder()
      .setCustomId('clips_select')
      .setPlaceholder('Select Clips')
      .addOptions([...Array(14).keys()].map(i => ({ label: `${i + 1} clip(s)`, value: `${i + 1}` })));

    const aspectMenu = new StringSelectMenuBuilder()
      .setCustomId('aspect_select')
      .setPlaceholder('Select Aspect Ratio')
      .addOptions([
        { label: '16:9', value: '16:9' },
        { label: '9:16', value: '9:16' },
        { label: '3:2', value: '3:2' },
        { label: '1:1', value: '1:1' }
      ]);

    const promptButton = new ButtonBuilder().setCustomId('prompt').setLabel('Enter Prompt').setStyle(ButtonStyle.Secondary);
    const generateButton = new ButtonBuilder().setCustomId('generate').setLabel('Generate Request').setStyle(ButtonStyle.Primary);

    // Limit 5 action rows
    await interaction.editReply({
      content: '🎬 Configure your video request:',
      components: [
        new ActionRowBuilder().addComponents(qualityMenu),
        new ActionRowBuilder().addComponents(durationMenu),
        new ActionRowBuilder().addComponents(stepsMenu),
        new ActionRowBuilder().addComponents(clipsMenu),
        new ActionRowBuilder().addComponents(aspectMenu),
        new ActionRowBuilder().addComponents(promptButton, generateButton)
      ].slice(0, 5) // Discord max rows = 5
    });
  }

  // Dropdowns
  if (interaction.isStringSelectMenu()) {
    const sel = userSelections.get(userId) || {};
    switch (interaction.customId) {
      case 'quality_select': sel.quality = interaction.values[0]; break;
      case 'duration_select': sel.duration = interaction.values[0]; break;
      case 'steps_select': sel.steps = interaction.values[0]; break;
      case 'clips_select': sel.clips = interaction.values[0]; break;
      case 'aspect_select': sel.aspect = interaction.values[0]; break;
    }
    userSelections.set(userId, sel);
    await interaction.update({ content: `🎬 Selection updated:\n- Quality: ${sel.quality}\n- Duration: ${sel.duration}\n- Steps: ${sel.steps}\n- Clips: ${sel.clips}\n- Aspect: ${sel.aspect}\n- Prompt: ${sel.prompt || 'Not set'}\n💰 Total: $${calculatePrice(sel)}`, components: interaction.message.components });
  }

  // Buttons
  if (interaction.isButton()) {
    const sel = userSelections.get(userId) || {};
    if (interaction.customId === 'prompt') {
      const modal = new ModalBuilder()
        .setCustomId('prompt_modal')
        .setTitle('Enter Prompt')
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('prompt_input').setLabel('Prompt').setStyle(TextInputStyle.Paragraph).setPlaceholder('Describe your video...').setRequired(true)
        ));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'generate') {
      if (!sel.quality || !sel.duration || !sel.steps || !sel.clips) return interaction.reply({ content: '⚠️ Select all options first.', ephemeral: true });
      userCooldowns.set(userId, Date.now());

      const log = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
      if (log) {
        const embed = new EmbedBuilder()
          .setTitle('📩 New Request')
          .addFields(
            { name: 'User', value: interaction.user.tag },
            { name: 'Quality', value: sel.quality },
            { name: 'Duration', value: sel.duration },
            { name: 'Steps', value: sel.steps },
            { name: 'Clips', value: sel.clips },
            { name: 'Aspect', value: sel.aspect },
            { name: 'Prompt', value: sel.prompt || 'Not set' },
            { name: 'Total', value: `$${calculatePrice(sel)}` }
          )
          .setColor(0x00FF00);
        await log.send({ embeds: [embed] });
      }

      await interaction.reply({ content: '🚀 Your request is ready! Click below to continue:', components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Continue').setStyle(ButtonStyle.Link).setURL('https://your-redirect-link.com'))], ephemeral: true });
      userSelections.delete(userId);
    }
  }

  // Modal submit
  if (interaction.isModalSubmit() && interaction.customId === 'prompt_modal') {
    const sel = userSelections.get(userId) || {};
    sel.prompt = interaction.fields.getTextInputValue('prompt_input');
    userSelections.set(userId, sel);
    await interaction.reply({ content: `✅ Prompt saved: "${sel.prompt}"`, ephemeral: true });
  }
});

client.login(process.env.BOT_TOKEN);