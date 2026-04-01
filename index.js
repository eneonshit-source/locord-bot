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

const userSelections = new Map();
const userCooldowns = new Map();

// ===== ID GENERATOR =====
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
  quality: { '360p': 0.12, '480p': 0.16, '720p': 0.21, '1080p': 0.28 },
  duration: { '4s': 0.06, '6s': 0.13, '8s': 0.19, '10s': 0.30, '14s': 0.52, '18s': 0.72 }, // FIXED
  steps: { '18': 0.12, '25': 0.24, '30': 0.42 },
  clips: [...Array(16).keys()].map(i => `${i + 1}`)
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
  detail: {
    'Low': 0.03,
    'Normal': 0.05,
    'High': 0.12,
    'Ultra': 0.23,
    'Ultra Max': 0.34
  },
  count: ['1','2','3','4','5','6','7','8','9','10','12','14','16','20','24','28','32','36','40']
};

// ===== PRICE CALCULATORS =====
function calcVideo(s) {
  return (
    (videoPrices.quality[s.quality] || 0) +
    (videoPrices.duration[s.duration] || 0) +
    (videoPrices.steps[s.steps] || 0)
  ) * (parseInt(s.clips) || 1);
}

function calcImage(s) {
  return (
    (imagePrices.resolution[s.resolution] || 0) +
    (imagePrices.detail[s.detail] || 0)
  ) * (parseInt(s.count) || 1);
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  const user = interaction.user.id;
  const now = Date.now();

  // ===== VIDEO REQUEST =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'request') {

    const cooldown = 10 * 60 * 1000;
    if (userCooldowns.has(user) && now - userCooldowns.get(user) < cooldown) {
      return interaction.reply({ content: '⏱ Wait before using again.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    userSelections.set(user, { type: 'video', prompt: '', confirmed: false });

    const menu = (id, data) =>
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
      .addOptions(videoPrices.clips.map(c => ({
        label: `${c} clips`,
        value: c
      })));

    await interaction.editReply({
      content: '🎬 Video Request Setup',
      components: [
        new ActionRowBuilder().addComponents(menu('quality', videoPrices.quality)),
        new ActionRowBuilder().addComponents(menu('duration', videoPrices.duration)),
        new ActionRowBuilder().addComponents(menu('steps', videoPrices.steps)),
        new ActionRowBuilder().addComponents(clipsMenu),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prompt').setLabel('Prompt').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('submit').setLabel('Submit').setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  // ===== IMAGE REQUEST =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'requesti') {

    const cooldown = 5 * 60 * 1000;
    if (userCooldowns.has(user) && now - userCooldowns.get(user) < cooldown) {
      return interaction.reply({ content: '⏱ Wait before using again.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    userSelections.set(user, { type: 'image', prompt: '', confirmed: false });

    const menu = (id, data) =>
      new StringSelectMenuBuilder()
        .setCustomId(id)
        .setPlaceholder(`Select ${id}`)
        .addOptions(Object.keys(data).map(k => ({
          label: `${k} ($${data[k]})`,
          value: k
        })));

    const countMenu = new StringSelectMenuBuilder()
      .setCustomId('count')
      .setPlaceholder('Select amount')
      .addOptions(imagePrices.count.map(c => ({
        label: `${c} images`,
        value: c
      })));

    await interaction.editReply({
      content: '🖼 Image Request Setup',
      components: [
        new ActionRowBuilder().addComponents(menu('resolution', imagePrices.resolution)),
        new ActionRowBuilder().addComponents(menu('detail', imagePrices.detail)),
        new ActionRowBuilder().addComponents(countMenu),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prompt').setLabel('Prompt').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('submit').setLabel('Submit').setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  // ===== PROMPT MODAL =====
  if (interaction.isButton() && interaction.customId === 'prompt') {
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

  if (interaction.isModalSubmit()) {
    const s = userSelections.get(user);
    if (!s) return;

    s.prompt = interaction.fields.getTextInputValue('prompt_input');

    return interaction.reply({
      content: '✅ Prompt saved!',
      ephemeral: true
    });
  }

  // ===== CONFIRM =====
  if (interaction.isButton() && interaction.customId === 'confirm') {
    const s = userSelections.get(user);
    if (!s.prompt) {
      return interaction.reply({ content: '⚠️ Add prompt first.', ephemeral: true });
    }
    s.confirmed = true;
    return interaction.reply({ content: '✅ Confirmed!', ephemeral: true });
  }

  // ===== SUBMIT =====
  if (interaction.isButton() && interaction.customId === 'submit') {
    const s = userSelections.get(user);
    if (!s || !s.confirmed) {
      return interaction.reply({ content: '⚠️ Confirm first.', ephemeral: true });
    }

    const id = generateID();
    userCooldowns.set(user, now);

    const price = s.type === 'video'
      ? calcVideo(s).toFixed(2)
      : calcImage(s).toFixed(2);

    return interaction.reply({
      content: `🧾 Requested ID: **${id}**\n💰 Price: $${price}\n⚠️ Save this ID!`,
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

  // ===== PROCEED =====
  if (interaction.isButton() && interaction.customId === 'proceed') {
    return interaction.reply({
      content: '✅ Proceed:\nhttps://guns.lol/locordhq',
      ephemeral: true
    });
  }
});

client.login(process.env.BOT_TOKEN);