// index.js
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
  TextInputStyle,
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== Store user selections and cooldowns =====
const userSelections = new Map();
const userCooldowns = new Map();

// ===== Prices configuration =====
const prices = {
  quality: { '360p': 0.12, '480p': 0.16, '720p': 0.21, '1080p': 0.28, '1440p': 0.39, '1660p': 0.52 },
  duration: { '4s': 0.06, '5s': 0.09, '6s': 0.13, '7s': 0.16, '8s': 0.19, '9s': 0.23, '10s': 0.30, '12s': 0.40, '14s': 0.52, '18s': 0.72 },
  steps: { '18': 0.12, '20': 0.16, '25': 0.24, '30': 0.42 },
  clips: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12, '13': 13, '14': 14 },
};

// ===== Calculate total price based on selection =====
function calculatePrice(selection) {
  if (!selection) return 0;
  const q = prices.quality[selection.quality] || 0;
  const d = prices.duration[selection.duration] || 0;
  const s = prices.steps[selection.steps] || 0;
  const c = selection.clips || 1;
  return ((q + d + s) * c).toFixed(2);
}

// ===== Ready event =====
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== Interaction handler =====
client.on(Events.InteractionCreate, async interaction => {
  const userId = interaction.user.id;
  const cooldownTime = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();

  // ===== Cooldown check =====
  if (userCooldowns.has(userId)) {
    const lastUse = userCooldowns.get(userId);
    if (now - lastUse < cooldownTime) {
      const remaining = Math.ceil((cooldownTime - (now - lastUse)) / 60000);
      return interaction.reply({
        content: `⏱ Please wait ${remaining} minute(s) to use LoCord again!`,
        ephemeral: true
      });
    }
  }

  // ===== Slash command: /request =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'request') {
    // ===== Quality Menu =====
    const qualityMenu = new StringSelectMenuBuilder()
      .setCustomId('quality_select')
      .setPlaceholder('Select video quality')
      .addOptions(Object.entries(prices.quality).map(([key, val]) => ({
        label: `${key} ($${val})`,
        value: key
      })));

    // ===== Duration Menu =====
    const durationMenu = new StringSelectMenuBuilder()
      .setCustomId('duration_select')
      .setPlaceholder('Select video duration')
      .addOptions(Object.entries(prices.duration).map(([key, val]) => ({
        label: `${key} ($${val})`,
        value: key
      })));

    // ===== Steps Menu =====
    const stepsMenu = new StringSelectMenuBuilder()
      .setCustomId('steps_select')
      .setPlaceholder('Select steps/detail')
      .addOptions(Object.entries(prices.steps).map(([key, val]) => ({
        label: `${key} - ${key <= 20 ? 'Normal/Better' : 'High/Ultra'} Detail ($${val})`,
        value: key
      })));

    // ===== Clips Menu =====
    const clipsMenu = new StringSelectMenuBuilder()
      .setCustomId('clips_select')
      .setPlaceholder('Select number of clips')
      .addOptions([...Array(14).keys()].map(i => ({
        label: `${i + 1} clip(s)`,
        value: `${i + 1}`
      })));

    // ===== Aspect Ratio Menu (No Cost) =====
    const aspectMenu = new StringSelectMenuBuilder()
      .setCustomId('aspect_select')
      .setPlaceholder('Select aspect ratio')
      .addOptions([
        { label: '16:9', value: '16:9' },
        { label: '9:16', value: '9:16' },
        { label: '3:2', value: '3:2' },
        { label: '1:1', value: '1:1' },
      ]);

    // ===== Buttons =====
    const promptButton = new ButtonBuilder()
      .setCustomId('prompt')
      .setLabel('Enter Prompt')
      .setStyle(ButtonStyle.Secondary);

    const generateButton = new ButtonBuilder()
      .setCustomId('generate')
      .setLabel('Generate Request')
      .setStyle(ButtonStyle.Primary);

    // ===== Initialize selection =====
    userSelections.set(userId, {
      quality: null,
      duration: null,
      steps: null,
      clips: '1',
      aspect: null,
      prompt: ''
    });

    // ===== Reply with rich UI (5 ActionRows max) =====
    return interaction.reply({
      content: '🎬 Configure your video request with LoCord:',
      components: [
        new ActionRowBuilder().addComponents(qualityMenu),
        new ActionRowBuilder().addComponents(durationMenu),
        new ActionRowBuilder().addComponents(stepsMenu),
        new ActionRowBuilder().addComponents(clipsMenu),
        new ActionRowBuilder().addComponents(aspectMenu),
        new ActionRowBuilder().addComponents(promptButton, generateButton),
      ],
      ephemeral: true
    });
  }

  // ===== Handle Dropdown Selections =====
  if (interaction.isStringSelectMenu()) {
    const selection = userSelections.get(userId) || {};
    switch (interaction.customId) {
      case 'quality_select': selection.quality = interaction.values[0]; break;
      case 'duration_select': selection.duration = interaction.values[0]; break;
      case 'steps_select': selection.steps = interaction.values[0]; break;
      case 'clips_select': selection.clips = interaction.values[0]; break;
      case 'aspect_select': selection.aspect = interaction.values[0]; break;
    }
    userSelections.set(userId, selection);
    const totalPrice = calculatePrice(selection);

    await interaction.update({
      content: `🎬 Current selection:\n- Quality: **${selection.quality || 'Not selected'}**\n- Duration: **${selection.duration || 'Not selected'}**\n- Steps: **${selection.steps || 'Not selected'}**\n- Clips: **${selection.clips}**\n- Aspect Ratio: **${selection.aspect || 'Not selected'}**\n- Prompt: **${selection.prompt || 'Not set'}**\n💰 Total Price: **$${totalPrice}**`,
      components: interaction.message.components,
      ephemeral: true
    });
  }

  // ===== Handle Button Interactions =====
  if (interaction.isButton()) {
    const selection = userSelections.get(userId);

    // ===== Prompt Modal =====
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
              .setPlaceholder('Describe your desired video content...')
              .setRequired(true)
          )
        );
      return interaction.showModal(modal);
    }

    // ===== Generate Request =====
    if (interaction.customId === 'generate') {
      if (!selection || !selection.quality || !selection.duration || !selection.steps || !selection.clips || !selection.aspect) {
        return interaction.reply({ content: '⚠️ Please complete all selections before generating.', ephemeral: true });
      }

      // Set cooldown
      userCooldowns.set(userId, now);
      const totalPrice = calculatePrice(selection);

      // Log to channel
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
            { name: 'Aspect Ratio', value: selection.aspect },
            { name: 'Prompt', value: selection.prompt || 'Not set' },
            { name: 'Total Price', value: `$${totalPrice}` }
          )
          .setColor(0x00FF00)
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
      }

      // Reply with final action
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

      userSelections.delete(userId);
    }
  }

  // ===== Handle Modal Submit =====
  if (interaction.isModalSubmit() && interaction.customId === 'prompt_modal') {
    const prompt = interaction.fields.getTextInputValue('prompt_input');
    const selection = userSelections.get(userId) || {};
    selection.prompt = prompt;
    userSelections.set(userId, selection);

    return interaction.reply({
      content: `✅ Your prompt has been saved:\n"${prompt}"`,
      ephemeral: true
    });
  }
});

// ===== Login Bot =====
client.login(process.env.BOT_TOKEN);