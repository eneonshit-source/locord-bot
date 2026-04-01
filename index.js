require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const userSelections = new Map();
const cooldowns = new Map();

// ===== ID =====
function generateID() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '#';
  for (let i = 0; i < 13; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ===== IMAGE PRICES =====
const imagePrices = {
  resolution: {
    '480p': 0.06, '720p': 0.09, '1080p': 0.15,
    '1440p': 0.18, '1660p': 0.24, '2080p': 0.30
  },
  quality: {
    'Normal': 0.05,
    'High': 0.12,
    'Ultra': 0.23,
    'Ultra Max': 0.34
  }
};

// ===== VIDEO PRICES =====
const videoPrices = {
  quality: {
    '360p': 0.12, '480p': 0.16, '720p': 0.21,
    '1080p': 0.28, '1440p': 0.39, '1660p': 0.52
  },
  duration: {
    '4s': 0.06, '6s': 0.13, '8s': 0.19,
    '10s': 0.30, '14s': 0.52, '18s': 0.72
  },
  detail: {
    '18': 0.12, '20': 0.16, '25': 0.24, '30': 0.42
  }
};

// ===== PRICE =====
function calcVideo(s) {
  return (
    (videoPrices.quality[s.quality] || 0) +
    (videoPrices.duration[s.duration] || 0) +
    (videoPrices.detail[s.detail] || 0)
  ) * (parseInt(s.clips) || 1);
}

function calcImage(s) {
  return (
    (imagePrices.resolution[s.resolution] || 0) +
    (imagePrices.quality[s.quality] || 0)
  ) * (parseInt(s.amount) || 1);
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  const user = interaction.user.id;
  const now = Date.now();

  // ===== COMMANDS =====
  if (interaction.isChatInputCommand()) {

    // ===== VIDEO =====
    if (interaction.commandName === 'request') {
      const cd = 10 * 60 * 1000;

      if (cooldowns.get(user) && now - cooldowns.get(user) < cd) {
        const left = Math.ceil((cd - (now - cooldowns.get(user))) / 60000);
        return interaction.reply({ content: `⏱ Wait ${left} min`, ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      userSelections.set(user, {
        type: 'video',
        quality: null,
        duration: null,
        detail: null,
        clips: '1',
        prompt: '',
        confirmed: false
      });

      const menu = (id, data) =>
        new StringSelectMenuBuilder()
          .setCustomId(id)
          .setPlaceholder(`Select ${id}`)
          .addOptions(Object.keys(data).map(k => ({
            label: `${k} ($${data[k]})`,
            value: k
          })));

      const clips = new StringSelectMenuBuilder()
        .setCustomId('clips')
        .setPlaceholder('Select clips')
        .addOptions([...Array(16).keys()].map(i => ({
          label: `${i + 1} clips`,
          value: `${i + 1}`
        })));

      return interaction.editReply({
        content: '🎬 Video Setup',
        components: [
          new ActionRowBuilder().addComponents(menu('quality', videoPrices.quality)),
          new ActionRowBuilder().addComponents(menu('duration', videoPrices.duration)),
          new ActionRowBuilder().addComponents(menu('detail', videoPrices.detail)),
          new ActionRowBuilder().addComponents(clips),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prompt').setLabel('Prompt').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('submit').setLabel('Submit').setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }

    // ===== IMAGE =====
    if (interaction.commandName === 'requesti') {
      const cd = 5 * 60 * 1000;

      if (cooldowns.get(user) && now - cooldowns.get(user) < cd) {
        const left = Math.ceil((cd - (now - cooldowns.get(user))) / 60000);
        return interaction.reply({ content: `⏱ Wait ${left} min`, ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      userSelections.set(user, {
        type: 'image',
        resolution: null,
        quality: null,
        amount: '1',
        ratio: null,
        prompt: '',
        confirmed: false
      });

      const menu = (id, data) =>
        new StringSelectMenuBuilder()
          .setCustomId(id)
          .setPlaceholder(`Select ${id}`)
          .addOptions(Object.keys(data).map(k => ({
            label: `${k} ($${data[k]})`,
            value: k
          })));

      const amount = new StringSelectMenuBuilder()
        .setCustomId('amount')
        .setPlaceholder('Select amount')
        .addOptions([...Array(40).keys()].map(i => ({
          label: `${i + 1} images`,
          value: `${i + 1}`
        })));

      const ratio = new StringSelectMenuBuilder()
        .setCustomId('ratio')
        .setPlaceholder('Select aspect ratio')
        .addOptions([
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '3:3', value: '3:3' },
          { label: '1:1', value: '1:1' }
        ]);

      return interaction.editReply({
        content: '🖼️ Image Setup',
        components: [
          new ActionRowBuilder().addComponents(menu('resolution', imagePrices.resolution)),
          new ActionRowBuilder().addComponents(menu('quality', imagePrices.quality)),
          new ActionRowBuilder().addComponents(amount),
          new ActionRowBuilder().addComponents(ratio),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prompt').setLabel('Prompt').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('submit').setLabel('Submit').setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }
  }

  // ===== SELECT =====
  if (interaction.isStringSelectMenu()) {
    const s = userSelections.get(user);
    if (!s) return interaction.reply({ content: 'Session expired', ephemeral: true });

    s[interaction.customId] = interaction.values[0];

    const price = s.type === 'video' ? calcVideo(s) : calcImage(s);

    return interaction.update({
      content: `⚙️ Updated\nPrompt: ${s.prompt || '❌'}\nRatio: ${s.ratio || '❌'}\nConfirmed: ${s.confirmed ? '✅' : '❌'}\n💰 $${price.toFixed(2)}`,
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
      if (!s.prompt) {
        return interaction.reply({ content: '⚠️ Add prompt first', ephemeral: true });
      }
      s.confirmed = true;
      return interaction.reply({ content: '✅ Confirmed', ephemeral: true });
    }

    if (interaction.customId === 'submit') {
      if (!s.confirmed) {
        return interaction.reply({ content: '⚠️ Confirm first', ephemeral: true });
      }

      cooldowns.set(user, Date.now());
      const id = generateID();

      return interaction.reply({
        content: `🧾 ID: **${id}**\nSave this!`,
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
        content: `✅ Continue:\nhttps://guns.lol/locordhq`,
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
      content: '✅ Prompt saved',
      ephemeral: true
    });
  }
});

client.login(process.env.BOT_TOKEN);