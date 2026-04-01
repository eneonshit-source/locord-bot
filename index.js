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
  duration: { '18s': 0.16 }, // fixed duration for video
  clips: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12, '13': 13, '14': 14, '15': 15, '16': 16 }
};

const imagePrices = {
  resolution: { '480p': 0.06, '720p': 0.09, '1080p': 0.15, '1440p': 0.18, '1660p': 0.24, '2080p': 0.30 },
  quality: { 'Normal': 0.05, 'High': 0.12, 'Ultra': 0.23, 'Ultra Max': 0.34 }, // Low removed
  amount: {
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    '12': 12, '14': 14, '16': 16, '20': 20, '24': 24, '28': 28, '32': 32, '36': 36, '40': 40
  },
  aspectRatio: { '16:9': 0, '9:16': 0, '1:1': 0, '3:3': 0 } // free
};

function calculatePriceVideo(s) {
  return ((videoPrices.quality[s.quality] || 0) +
    (videoPrices.duration['18s'] || 0)) * (parseInt(s.clips) || 1);
}

function calculatePriceImage(s) {
  return ((imagePrices.resolution[s.resolution] || 0) +
    (imagePrices.quality[s.quality] || 0)) * (parseInt(s.amount) || 1);
}

// ===== CLIENT READY =====
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async interaction => {
  const user = interaction.user.id;
  const now = Date.now();
  const cooldown = 5 * 60 * 1000; // 5 min cooldown

  // COOLDOWN
  if (userCooldowns.has(user) && now - userCooldowns.get(user) < cooldown) {
    const mins = Math.ceil((cooldown - (now - userCooldowns.get(user))) / 60000);
    if (interaction.isChatInputCommand()) {
      return interaction.reply({ content: `⏱ Wait ${mins} minute(s) before using again.`, ephemeral: true });
    }
  }

  // ===== PANEL COMMAND =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
    const videoBtn = new ButtonBuilder()
      .setCustomId('video_request')
      .setLabel('Request Video')
      .setStyle(ButtonStyle.Primary);

    const imageBtn = new ButtonBuilder()
      .setCustomId('image_request')
      .setLabel('Request Image')
      .setStyle(ButtonStyle.Success);

    return interaction.reply({
      content: '🎬 Choose what you want to request:',
      components: [new ActionRowBuilder().addComponents(videoBtn, imageBtn)],
      ephemeral: true
    });
  }

  // ===== START VIDEO REQUEST =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'request') {
    startVideoMenu(interaction);
  }

  // ===== START IMAGE REQUEST =====
  if (interaction.isChatInputCommand() && interaction.commandName === 'requesti') {
    startImageMenu(interaction);
  }

  // ===== BUTTONS FROM PANEL =====
  if (interaction.isButton()) {
    if (interaction.customId === 'video_request') return startVideoMenu(interaction);
    if (interaction.customId === 'image_request') return startImageMenu(interaction);
  }

  // ===== VIDEO MENU HANDLER =====
  async function startVideoMenu(interaction) {
    await interaction.deferReply({ ephemeral: true });

    userSelections.set(user, { quality: null, clips: '1', prompt: '', confirmed: false });

    const qualityMenu = new StringSelectMenuBuilder()
      .setCustomId('video_quality')
      .setPlaceholder('Select Video Resolution')
      .addOptions(Object.keys(videoPrices.quality).map(q => ({ label: `${q} ($${videoPrices.quality[q]})`, value: q })));

    const clipsMenu = new StringSelectMenuBuilder()
      .setCustomId('video_clips')
      .setPlaceholder('Select Number of Clips')
      .addOptions(Object.keys(videoPrices.clips).map(c => ({ label: `${c} clip(s)`, value: c })));

    const promptBtn = new ButtonBuilder().setCustomId('video_prompt').setLabel('Enter Prompt').setStyle(ButtonStyle.Secondary);
    const confirmBtn = new ButtonBuilder().setCustomId('video_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success);
    const submitBtn = new ButtonBuilder().setCustomId('video_submit').setLabel('Submit').setStyle(ButtonStyle.Primary);

    await interaction.editReply({
      content: '🎬 Configure your video request:',
      components: [
        new ActionRowBuilder().addComponents(qualityMenu),
        new ActionRowBuilder().addComponents(clipsMenu),
        new ActionRowBuilder().addComponents(promptBtn, confirmBtn, submitBtn)
      ]
    });
  }

  // ===== IMAGE MENU HANDLER =====
  async function startImageMenu(interaction) {
    await interaction.deferReply({ ephemeral: true });

    userSelections.set(user, { resolution: null, quality: null, amount: '1', aspectRatio: '16:9', prompt: '', confirmed: false });

    const resMenu = new StringSelectMenuBuilder()
      .setCustomId('image_resolution')
      .setPlaceholder('Select Resolution')
      .addOptions(Object.keys(imagePrices.resolution).map(r => ({ label: `${r} ($${imagePrices.resolution[r]})`, value: r })));

    const qualityMenu = new StringSelectMenuBuilder()
      .setCustomId('image_quality')
      .setPlaceholder('Select Quality')
      .addOptions(Object.keys(imagePrices.quality).map(q => ({ label: `${q} ($${imagePrices.quality[q]})`, value: q })));

    const amountMenu = new StringSelectMenuBuilder()
      .setCustomId('image_amount')
      .setPlaceholder('Select Amount')
      .addOptions(Object.keys(imagePrices.amount).map(a => ({ label: `${a} image(s)`, value: a })));

    const ratioMenu = new StringSelectMenuBuilder()
      .setCustomId('image_ratio')
      .setPlaceholder('Select Aspect Ratio')
      .addOptions(Object.keys(imagePrices.aspectRatio).map(r => ({ label: r, value: r })));

    const promptBtn = new ButtonBuilder().setCustomId('image_prompt').setLabel('Enter Prompt').setStyle(ButtonStyle.Secondary);
    const confirmBtn = new ButtonBuilder().setCustomId('image_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success);
    const submitBtn = new ButtonBuilder().setCustomId('image_submit').setLabel('Submit').setStyle(ButtonStyle.Primary);

    await interaction.editReply({
      content: '🖼 Configure your image request:',
      components: [
        new ActionRowBuilder().addComponents(resMenu),
        new ActionRowBuilder().addComponents(qualityMenu),
        new ActionRowBuilder().addComponents(amountMenu),
        new ActionRowBuilder().addComponents(ratioMenu),
        new ActionRowBuilder().addComponents(promptBtn, confirmBtn, submitBtn)
      ]
    });
  }

  // ===== MENU SELECTION HANDLER =====
  if (interaction.isStringSelectMenu()) {
    const s = userSelections.get(user);
    if (!s) return;

    switch (interaction.customId) {
      case 'video_quality': s.quality = interaction.values[0]; break;
      case 'video_clips': s.clips = interaction.values[0]; break;
      case 'image_resolution': s.resolution = interaction.values[0]; break;
      case 'image_quality': s.quality = interaction.values[0]; break;
      case 'image_amount': s.amount = interaction.values[0]; break;
      case 'image_ratio': s.aspectRatio = interaction.values[0]; break;
    }

    let content = '';
    if (s.quality && s.clips) {
      content = `🎬 Video Setup:\n- Quality: ${s.quality}\n- Clips: ${s.clips}\n- Prompt: ${s.prompt || '❌'}\n- Confirmed: ${s.confirmed ? '✅' : '❌'}\n💰 $${calculatePriceVideo(s).toFixed(2)}`;
    }
    if (s.resolution && s.quality && s.amount) {
      content = `🖼 Image Setup:\n- Resolution: ${s.resolution}\n- Quality: ${s.quality}\n- Amount: ${s.amount}\n- Aspect Ratio: ${s.aspectRatio}\n- Prompt: ${s.prompt || '❌'}\n- Confirmed: ${s.confirmed ? '✅' : '❌'}\n💰 $${calculatePriceImage(s).toFixed(2)}`;
    }

    await interaction.update({ content, components: interaction.message.components });
  }

  // ===== MODAL =====
  if (interaction.isModalSubmit()) {
    const s = userSelections.get(user);
    if (!s) return;

    if (interaction.customId === 'video_prompt' || interaction.customId === 'image_prompt') {
      s.prompt = interaction.fields.getTextInputValue('prompt_input');
      return interaction.reply({ content: `✅ Prompt saved!`, ephemeral: true });
    }
  }

  // ===== BUTTONS =====
  if (interaction.isButton()) {
    const s = userSelections.get(user);
    if (!s) return;

    // CONFIRM
    if (interaction.customId === 'video_confirm' || interaction.customId === 'image_confirm') {
      if ((s.quality && s.prompt) || (s.resolution && s.quality && s.amount && s.prompt)) {
        s.confirmed = true;
        return interaction.reply({ content: '✅ Confirmed!', ephemeral: true });
      } else {
        return interaction.reply({ content: '⚠️ Fill all options and prompt first.', ephemeral: true });
      }
    }

    // SUBMIT
    if (interaction.customId === 'video_submit' || interaction.customId === 'image_submit') {
      if (!s.confirmed) return interaction.reply({ content: '⚠️ Confirm first.', ephemeral: true });

      const id = generateID();
      userCooldowns.set(user, now);

      const totalPrice = s.clips ? calculatePriceVideo(s).toFixed(2) : calculatePriceImage(s).toFixed(2);

      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('📩 New Request')
          .addFields(
            { name: 'ID', value: id },
            { name: 'User', value: interaction.user.tag },
            { name: 'Prompt', value: s.prompt },
            { name: 'Total Price', value: `$${totalPrice}` }
          );
        await logChannel.send({ embeds: [embed] });
      }

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
});

client.login(process.env.BOT_TOKEN);