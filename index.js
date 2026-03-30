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

// ===== PRICES =====
const prices = {
  quality: { '360p': 0.12, '480p': 0.16, '720p': 0.21, '1080p': 0.28, '1440p': 0.39, '1660p': 0.52 },
  duration: { '4s': 0.06, '5s': 0.09, '6s': 0.13, '7s': 0.16, '8s': 0.19, '9s': 0.23, '10s': 0.30 },
  steps: { '18': 0.12, '20': 0.16, '25': 0.24, '30': 0.42 },
  clips: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 }
};

function calculatePrice(s) {
  return ((prices.quality[s.quality] || 0) +
    (prices.duration[s.duration] || 0) +
    (prices.steps[s.steps] || 0)) * (s.clips || 1);
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  const user = interaction.user.id;
  const now = Date.now();
  const cooldown = 10 * 60 * 1000;

  // ===== COMMAND =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'request') {

    // COOLDOWN ONLY HERE
    if (userCooldowns.has(user)) {
      const last = userCooldowns.get(user);
      if (now - last < cooldown) {
        const mins = Math.ceil((cooldown - (now - last)) / 60000);
        return interaction.reply({
          content: `⏱ Wait ${mins} minute(s) before using again.`,
          ephemeral: true
        });
      }
    }

    await interaction.deferReply({ ephemeral: true });

    userSelections.set(user, {
      quality: null,
      duration: null,
      steps: null,
      clips: '1',
      prompt: '',
      confirmed: false
    });

    const makeMenu = (id, data) =>
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
      .addOptions([...Array(5).keys()].map(i => ({
        label: `${i + 1} clips`,
        value: `${i + 1}`
      })));

    await interaction.editReply({
      content: '🎬 Setup your request:',
      components: [
        new ActionRowBuilder().addComponents(makeMenu('quality', prices.quality)),
        new ActionRowBuilder().addComponents(makeMenu('duration', prices.duration)),
        new ActionRowBuilder().addComponents(makeMenu('steps', prices.steps)),
        new ActionRowBuilder().addComponents(clipsMenu),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prompt').setLabel('Prompt').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('submit').setLabel('Submit').setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  // ===== SELECT =====
  if (interaction.isStringSelectMenu()) {
    const s = userSelections.get(user);
    if (!s) return;

    s[interaction.customId] = interaction.values[0];

    await interaction.update({
      content:
        `🎬 Setup:\n` +
        `Quality: ${s.quality || '❌'}\n` +
        `Duration: ${s.duration || '❌'}\n` +
        `Steps: ${s.steps || '❌'}\n` +
        `Clips: ${s.clips}\n` +
        `Prompt: ${s.prompt || '❌'}\n` +
        `Confirmed: ${s.confirmed ? '✅' : '❌'}\n\n` +
        `💰 $${calculatePrice(s).toFixed(2)}`,
      components: interaction.message.components
    });
  }

  // ===== BUTTONS =====
  if (interaction.isButton()) {
    const s = userSelections.get(user);
    if (!s) return;

    // PROMPT
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

    // CONFIRM
    if (interaction.customId === 'confirm') {
      if (!s.quality || !s.duration || !s.steps || !s.prompt) {
        return interaction.reply({ content: '⚠️ Fill everything first.', ephemeral: true });
      }

      s.confirmed = true;
      return interaction.reply({ content: '✅ Confirmed!', ephemeral: true });
    }

    // SUBMIT
    if (interaction.customId === 'submit') {
      if (!s.confirmed) {
        return interaction.reply({ content: '⚠️ Confirm first.', ephemeral: true });
      }

      const id = generateID();
      userCooldowns.set(user, now);

      // LOG
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
      if (logChannel) {
        await logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('📩 New Request')
              .addFields(
                { name: 'ID', value: id },
                { name: 'User', value: interaction.user.tag },
                { name: 'Prompt', value: s.prompt },
                { name: 'Price', value: `$${calculatePrice(s).toFixed(2)}` }
              )
          ]
        });
      }

      // STEP 1 → SHOW ID + PROCEED BUTTON
      return interaction.reply({
        content: `🧾 Requested ID: **${id}**\n⚠️ Please save this ID!`,
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

    // STEP 2 → SHOW LINK
    if (interaction.customId === 'proceed') {
      return interaction.reply({
        content: `✅ Proceed with your request:\nhttps://guns.lol/locordhq`,
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
});

client.login(process.env.BOT_TOKEN);