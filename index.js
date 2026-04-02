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

// ===== STORAGE =====
const userSelections = new Map();
const userCooldowns = new Map();

// ===== ID =====
function generateID() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '#';
  for (let i = 0; i < 13; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ===== VIDEO PRICES =====
const videoPrices = {
  quality: {
    '360p': 0.12,
    '480p': 0.16,
    '720p': 0.21,
    '1080p': 0.28,
    '1440p': 0.39,
    '1660p': 0.52
  },
  duration: {
    '4s': 0.06,
    '5s': 0.09,
    '6s': 0.13,
    '7s': 0.16,
    '8s': 0.19,
    '9s': 0.23,
    '10s': 0.30,
    '12s': 0.40,
    '14s': 0.52,
    '18s': 0.72
  },
  steps: {
    '18': 0.12,
    '20': 0.16,
    '25': 0.24,
    '30': 0.42
  }
};

// ===== IMAGE PRICES =====
const imagePrices = {
  resolution: {
    '480p': 0.06,
    '720p': 0.09,
    '1080p': 0.15,
    '1440p': 0.18,
    '1660p': 0.24,
    '2080p': 0.30
  },
  quality: {
    'Normal': 0.05,
    'High': 0.12,
    'Ultra': 0.23,
    'Ultra Max': 0.34
  }
};

// ===== PRICE CALCULATIONS =====
function calculateVideo(s) {
  const q = videoPrices.quality[s.quality] || 0;
  const d = videoPrices.duration[s.duration] || 0;
  const st = videoPrices.steps[s.steps] || 0;
  const c = parseInt(s.clips) || 1;
  return (q + d + st) * c;
}

function calculateImage(s) {
  const r = imagePrices.resolution[s.resolution] || 0;
  const q = imagePrices.quality[s.quality] || 0;
  const a = parseInt(s.amount) || 1;
  return (r + q) * a;
}

// ===== READY =====
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== MAIN HANDLER =====
client.on(Events.InteractionCreate, async interaction => {
  const user = interaction.user.id;
  const now = Date.now();

  try {

  // ===== PANEL =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
    return interaction.reply({
      content: '🎬 Select what you want:',
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('panel_video').setLabel('🎥 Video').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('panel_image').setLabel('🖼 Image').setStyle(ButtonStyle.Secondary)
        )
      ]
    });
  }

  // ===== VIDEO START =====
  if (
    (interaction.isChatInputCommand() && interaction.commandName === 'request') ||
    (interaction.isButton() && interaction.customId === 'panel_video')
  ) {

    if (userCooldowns.has(user) && now - userCooldowns.get(user) < 600000) {
      return interaction.reply({ content: '⏱ Wait 10 minutes.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    userSelections.set(user, {
      type: 'video',
      quality: null,
      duration: null,
      steps: null,
      clips: '1',
      prompt: '',
      confirmed: false
    });

    const createMenu = (id, data) =>
      new StringSelectMenuBuilder()
        .setCustomId(id)
        .setPlaceholder(`Select ${id}`)
        .addOptions(Object.keys(data).map(k => ({
          label: `${k} ($${data[k]})`,
          value: k
        })));

    const clipsMenu = new StringSelectMenuBuilder()
      .setCustomId('clips')
      .setPlaceholder('Select clips')
      .addOptions([...Array(16).keys()].map(i => ({
        label: `${i + 1}`,
        value: `${i + 1}`
      })));

    await interaction.editReply({
      content: '🎬 Video Setup:',
      components: [
        new ActionRowBuilder().addComponents(createMenu('quality', videoPrices.quality)),
        new ActionRowBuilder().addComponents(createMenu('duration', videoPrices.duration)),
        new ActionRowBuilder().addComponents(createMenu('steps', videoPrices.steps)),
        new ActionRowBuilder().addComponents(clipsMenu),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prompt').setLabel('Prompt').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('submit').setLabel('Submit').setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  // ===== IMAGE START =====
  if (
    (interaction.isChatInputCommand() && interaction.commandName === 'requesti') ||
    (interaction.isButton() && interaction.customId === 'panel_image')
  ) {

    if (userCooldowns.has(user) && now - userCooldowns.get(user) < 300000) {
      return interaction.reply({ content: '⏱ Wait 5 minutes.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    userSelections.set(user, {
      type: 'image',
      resolution: null,
      quality: null,
      amount: '1',
      aspectRatio: null,
      prompt: '',
      confirmed: false
    });

    await interaction.editReply({
      content: '🖼 Image Setup:',
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('resolution')
            .setPlaceholder('Resolution')
            .addOptions(Object.keys(imagePrices.resolution).map(k => ({
              label: `${k} ($${imagePrices.resolution[k]})`,
              value: k
            })))
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('quality')
            .setPlaceholder('Quality')
            .addOptions(Object.keys(imagePrices.quality).map(k => ({
              label: `${k} ($${imagePrices.quality[k]})`,
              value: k
            })))
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('amount')
            .setPlaceholder('Amount')
            .addOptions([1,2,3,4,5,6,7,8,9,10,12,14,16,20,24,28,32,36,40]
              .map(v => ({ label: `${v}`, value: `${v}` })))
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('aspectRatio')
            .setPlaceholder('Aspect Ratio')
            .addOptions(['16:9','9:16','1:1','3:3']
              .map(r => ({ label: r, value: r })))
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prompt').setLabel('Prompt').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('submit').setLabel('Submit').setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  // ===== SELECT HANDLER =====
  if (interaction.isStringSelectMenu()) {
    const s = userSelections.get(user);
    if (!s) return;

    s[interaction.customId] = interaction.values[0];

    let msg = '⚙️ Current Setup:\n\n';

    if (s.type === 'video') {
      msg += `🎬 Video\n`;
      msg += `Quality: ${s.quality || '❌'}\n`;
      msg += `Duration: ${s.duration || '❌'}\n`;
      msg += `Steps: ${s.steps || '❌'}\n`;
      msg += `Clips: ${s.clips}\n`;
      msg += `Prompt: ${s.prompt || '❌'}\n`;
      msg += `💰 $${calculateVideo(s).toFixed(2)}`;
    }

    if (s.type === 'image') {
      msg += `🖼 Image\n`;
      msg += `Resolution: ${s.resolution || '❌'}\n`;
      msg += `Quality: ${s.quality || '❌'}\n`;
      msg += `Amount: ${s.amount}\n`;
      msg += `Aspect Ratio: ${s.aspectRatio || '❌'}\n`;
      msg += `Prompt: ${s.prompt || '❌'}\n`;
      msg += `💰 $${calculateImage(s).toFixed(2)}`;
    }

    return interaction.update({
      content: msg,
      components: interaction.message.components
    });
  }

  // ===== BUTTONS =====
  if (interaction.isButton()) {
    const s = userSelections.get(user);
    if (!s) return;

    if (interaction.customId === 'prompt') {
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId('prompt_modal')
          .setTitle('Enter Prompt')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('prompt_input')
                .setLabel('Prompt')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
            )
          )
      );
    }

    if (interaction.customId === 'confirm') {
      if (!s.prompt) return interaction.reply({ content: '⚠️ Add prompt first', ephemeral: true });
      s.confirmed = true;
      return interaction.reply({ content: '✅ Confirmed', ephemeral: true });
    }

    if (interaction.customId === 'submit') {
      if (!s.confirmed) return interaction.reply({ content: '⚠️ Confirm first', ephemeral: true });

      const id = generateID();
      userCooldowns.set(user, now);

      return interaction.reply({
        content: `🧾 ID: ${id}\nSave this.`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('proceed')
              .setLabel('Proceed')
              .setStyle(ButtonStyle.Success)
          )
        ],
        ephemeral: true
      });
    }

    if (interaction.customId === 'proceed') {
      return interaction.reply({
        content: 'https://guns.lol/locordhq',
        ephemeral: true
      });
    }
  }

  // ===== MODAL =====
  if (interaction.isModalSubmit()) {
    const s = userSelections.get(user);
    if (!s) return;

    s.prompt = interaction.fields.getTextInputValue('prompt_input');

    return interaction.reply({
      content: '✅ Prompt saved!',
      ephemeral: true
    });
  }

  } catch (err) {
    console.error(err);
  }
});

client.login(process.env.BOT_TOKEN);