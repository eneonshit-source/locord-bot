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
const videoPrices = {
  quality: { '360p': 0.12, '480p': 0.16, '720p': 0.21, '1080p': 0.28, '1440p': 0.39, '1660p': 0.52 },
  duration: { '4s': 0.06, '5s': 0.09, '6s': 0.13, '7s': 0.16, '8s': 0.19, '9s': 0.23, '10s': 0.30 },
  steps: { '18': 0.12, '20': 0.16, '25': 0.24, '30': 0.42 },
};

const imagePrices = {
  resolution: { '480p': 0.06, '720p': 0.09, '1080p': 0.15, '1440p': 0.18, '1660p': 0.24, '2080p': 0.30 },
  quality: { 'Low': 0.03, 'Normal': 0.05, 'High': 0.12, 'Ultra': 0.23, 'Ultra Max': 0.34 },
};

const imageAmountOptions = [1,2,3,4,5,6,7,8,9,10,12,14,16,20,24,28,32,36,40];

// ===== PRICE CALCULATORS =====
function calculateVideoPrice(s) {
  return ((videoPrices.quality[s.quality] || 0) +
    (videoPrices.duration[s.duration] || 0) +
    (videoPrices.steps[s.steps] || 0)) * (s.clips || 1);
}

function calculateImagePrice(s) {
  return ((imagePrices.resolution[s.resolution] || 0) +
    (imagePrices.quality[s.quality] || 0)) * (s.amount || 1);
}

// ===== READY =====
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async interaction => {
  const user = interaction.user.id;
  const now = Date.now();
  const cooldown = 5 * 60 * 1000; // 5 min cooldown

  // Initialize selection map
  if (!userSelections.has(user)) {
    userSelections.set(user, { confirmed: false });
  }
  const s = userSelections.get(user);

  // ===== COMMANDS =====
  if (interaction.isChatInputCommand()) {

    // Cooldown
    if (userCooldowns.has(user)) {
      const last = userCooldowns.get(user);
      if (now - last < cooldown) {
        const mins = Math.ceil((cooldown - (now - last)) / 60000);
        return interaction.reply({ content: `⏱ Wait ${mins} minute(s) before using again.`, ephemeral: true });
      }
    }

    await interaction.deferReply({ ephemeral: true });

    if (interaction.commandName === 'request') {
      // Video request
      Object.assign(s, { quality: null, duration: null, steps: null, clips: 1, prompt: '', type: 'video' });

      const makeMenu = (id, data) =>
        new StringSelectMenuBuilder()
          .setCustomId(id)
          .setPlaceholder(`Select ${id}`)
          .addOptions(Object.keys(data).map(k => ({ label: `${k} ($${data[k]})`, value: k })));

      const clipsMenu = new StringSelectMenuBuilder()
        .setCustomId('clips')
        .setPlaceholder('Select clips')
        .addOptions([...Array(16).keys()].map(i => ({ label: `${i + 1} clips`, value: `${i + 1}` })));

      await interaction.editReply({
        content: '🎬 Setup your VIDEO request:',
        components: [
          new ActionRowBuilder().addComponents(makeMenu('quality', videoPrices.quality)),
          new ActionRowBuilder().addComponents(makeMenu('duration', videoPrices.duration)),
          new ActionRowBuilder().addComponents(makeMenu('steps', videoPrices.steps)),
          new ActionRowBuilder().addComponents(clipsMenu),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prompt').setLabel('Prompt').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('submit').setLabel('Submit').setStyle(ButtonStyle.Primary)
          )
        ]
      });

    } else if (interaction.commandName === 'requesti') {
      // Image request
      Object.assign(s, { resolution: null, quality: null, amount: 1, prompt: '', type: 'image' });

      const makeMenu = (id, data) =>
        new StringSelectMenuBuilder()
          .setCustomId(id)
          .setPlaceholder(`Select ${id}`)
          .addOptions(Object.keys(data).map(k => ({ label: `${k} ($${data[k]})`, value: k })));

      const amountMenu = new StringSelectMenuBuilder()
        .setCustomId('amount')
        .setPlaceholder('Select amount')
        .addOptions(imageAmountOptions.map(a => ({ label: `${a} picture(s)`, value: `${a}` })));

      const aspectMenu = new StringSelectMenuBuilder()
        .setCustomId('aspect')
        .setPlaceholder('Aspect Ratio (optional)')
        .addOptions(['16:9','9:6','1:1','3:3'].map(a => ({ label: a, value: a })));

      await interaction.editReply({
        content: '🖼️ Setup your IMAGE request:',
        components: [
          new ActionRowBuilder().addComponents(makeMenu('resolution', imagePrices.resolution)),
          new ActionRowBuilder().addComponents(makeMenu('quality', imagePrices.quality)),
          new ActionRowBuilder().addComponents(amountMenu),
          new ActionRowBuilder().addComponents(aspectMenu),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prompt').setLabel('Prompt').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('submit').setLabel('Submit').setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }
  }

  // ===== SELECT HANDLER =====
  if (interaction.isStringSelectMenu()) {
    s[interaction.customId] = interaction.values[0];
    const price = s.type === 'video' ? calculateVideoPrice(s).toFixed(2) : calculateImagePrice(s).toFixed(2);

    await interaction.update({
      content:
        `${s.type === 'video' ? '🎬 Video Setup:' : '🖼️ Image Setup:'}\n` +
        Object.entries(s).filter(([k]) => !['confirmed','type'].includes(k)).map(([k,v]) => `${k}: ${v || '❌'}`).join('\n') +
        `\nConfirmed: ${s.confirmed ? '✅' : '❌'}\n\n💰 $${price}`,
      components: interaction.message.components
    });
  }

  // ===== BUTTON HANDLER =====
  if (interaction.isButton()) {

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
      if ((s.type === 'video' && (!s.quality || !s.duration || !s.steps || !s.prompt)) ||
          (s.type === 'image' && (!s.resolution || !s.quality || !s.amount || !s.prompt))) {
        return interaction.reply({ content: '⚠️ Fill all required fields first.', ephemeral: true });
      }
      s.confirmed = true;
      return interaction.reply({ content: '✅ Confirmed!', ephemeral: true });
    }

    // SUBMIT
    if (interaction.customId === 'submit') {
      if (!s.confirmed) return interaction.reply({ content: '⚠️ Confirm first.', ephemeral: true });

      const id = generateID();
      userCooldowns.set(user, now);

      // Log request
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('📩 New Request')
          .addFields(
            { name: 'ID', value: id },
            { name: 'User', value: interaction.user.tag },
            { name: 'Type', value: s.type },
            { name: 'Prompt', value: s.prompt },
            { name: 'Price', value: `$${s.type === 'video' ? calculateVideoPrice(s).toFixed(2) : calculateImagePrice(s).toFixed(2)}` }
          );
        await logChannel.send({ embeds: [embed] });
      }

      // Show ID
      return interaction.reply({
        content: `🧾 Requested ID: **${id}**\n⚠️ Please save this ID!`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('proceed').setLabel('Proceed').setStyle(ButtonStyle.Success)
          )
        ],
        ephemeral: true
      });
    }

    // PROCEED
    if (interaction.customId === 'proceed') {
      return interaction.reply({
        content: `✅ Proceed with your request:\nhttps://guns.lol/locordhq`,
        ephemeral: true
      });
    }
  }

  // ===== MODAL SUBMIT =====
  if (interaction.isModalSubmit() && interaction.customId === 'prompt_modal') {
    s.prompt = interaction.fields.getTextInputValue('prompt_input');
    return interaction.reply({ content: '✅ Prompt saved!', ephemeral: true });
  }

});

client.login(process.env.BOT_TOKEN);