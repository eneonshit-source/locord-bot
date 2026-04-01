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

// ===== VIDEO =====
const videoPrices = {
  quality: { '360p': 0.12, '480p': 0.16, '720p': 0.21, '1080p': 0.28, '1440p': 0.39, '1660p': 0.52 },
  duration: { '4s': 0.06, '6s': 0.13, '8s': 0.19, '10s': 0.30, '14s': 0.52, '18s': 0.72 },
  steps: { '18': 0.12, '20': 0.16, '25': 0.24, '30': 0.42 }
};

// ===== IMAGE =====
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

// ===== CALC =====
const calcVideo = s =>
  ((videoPrices.quality[s.quality] || 0) +
   (videoPrices.duration[s.duration] || 0) +
   (videoPrices.steps[s.steps] || 0)) * (s.clips || 1);

const calcImage = s =>
  ((imagePrices.resolution[s.resolution] || 0) +
   (imagePrices.quality[s.quality] || 0)) * (s.amount || 1);

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== HANDLER =====
client.on(Events.InteractionCreate, async interaction => {
  const user = interaction.user.id;
  const now = Date.now();

  try {

    // ================= VIDEO =================
    if (interaction.isChatInputCommand() && interaction.commandName === 'request') {

      if (userCooldowns.has(user)) {
        const diff = now - userCooldowns.get(user);
        if (diff < 600000) {
          return interaction.reply({
            content: `⏱ Wait ${Math.ceil((600000 - diff) / 60000)} min`,
            ephemeral: true
          });
        }
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

      await interaction.editReply({
        content: '🎬 VIDEO SETUP\nMake your selections below:',
        components: [
          new ActionRowBuilder().addComponents(menu('quality', videoPrices.quality)),
          new ActionRowBuilder().addComponents(menu('duration', videoPrices.duration)),
          new ActionRowBuilder().addComponents(menu('steps', videoPrices.steps)),
          new ActionRowBuilder().addComponents(clips),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prompt').setLabel('Prompt').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('submit').setLabel('Submit').setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }

    // ================= IMAGE =================
    if (interaction.isChatInputCommand() && interaction.commandName === 'requesti') {

      if (userCooldowns.has(user)) {
        const diff = now - userCooldowns.get(user);
        if (diff < 300000) {
          return interaction.reply({
            content: `⏱ Wait ${Math.ceil((300000 - diff) / 60000)} min`,
            ephemeral: true
          });
        }
      }

      await interaction.deferReply({ ephemeral: true });

      userSelections.set(user, {
        type: 'image',
        resolution: null,
        quality: null,
        ratio: null,
        amount: '1',
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

      const ratioMenu = new StringSelectMenuBuilder()
        .setCustomId('ratio')
        .setPlaceholder('Aspect Ratio')
        .addOptions([
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '1:1', value: '1:1' },
          { label: '3:3', value: '3:3' }
        ]);

      const amountMenu = new StringSelectMenuBuilder()
        .setCustomId('amount')
        .setPlaceholder('Amount')
        .addOptions([1,2,3,4,5,6,7,8,9,10,12,14,16,20,24,28,32,36,40].map(v => ({
          label: `${v} images`,
          value: `${v}`
        })));

      await interaction.editReply({
        content: '🖼 IMAGE SETUP\nMake your selections below:',
        components: [
          new ActionRowBuilder().addComponents(menu('resolution', imagePrices.resolution)),
          new ActionRowBuilder().addComponents(menu('quality', imagePrices.quality)),
          new ActionRowBuilder().addComponents(ratioMenu),
          new ActionRowBuilder().addComponents(amountMenu),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prompt').setLabel('Prompt').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('submit').setLabel('Submit').setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }

    // ================= SELECT =================
    if (interaction.isStringSelectMenu()) {
      const s = userSelections.get(user);
      if (!s) return interaction.reply({ content: '❌ Session expired', ephemeral: true });

      s[interaction.customId] = interaction.values[0];

      let summary = '';
      let total = 0;

      if (s.type === 'video') {
        total = calcVideo(s);
        summary =
          `🎬 VIDEO SETUP\n\n` +
          `Quality: ${s.quality || '❌'}\n` +
          `Duration: ${s.duration || '❌'}\n` +
          `Steps: ${s.steps || '❌'}\n` +
          `Clips: ${s.clips}\n` +
          `Prompt: ${s.prompt || '❌'}\n` +
          `Confirmed: ${s.confirmed ? '✅' : '❌'}\n\n` +
          `💰 Total: $${total.toFixed(2)}`;
      }

      if (s.type === 'image') {
        total = calcImage(s);
        summary =
          `🖼 IMAGE SETUP\n\n` +
          `Resolution: ${s.resolution || '❌'}\n` +
          `Quality: ${s.quality || '❌'}\n` +
          `Ratio: ${s.ratio || '❌'}\n` +
          `Amount: ${s.amount}\n` +
          `Prompt: ${s.prompt || '❌'}\n` +
          `Confirmed: ${s.confirmed ? '✅' : '❌'}\n\n` +
          `💰 Total: $${total.toFixed(2)}`;
      }

      return interaction.update({
        content: summary,
        components: interaction.message.components
      });
    }

    // ================= BUTTONS =================
    if (interaction.isButton()) {
      const s = userSelections.get(user);
      if (!s) return interaction.reply({ content: '❌ Session expired', ephemeral: true });

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
        s.confirmed = true;
        return interaction.reply({ content: '✅ Confirmed!', ephemeral: true });
      }

      if (interaction.customId === 'submit') {
        if (!s.confirmed) {
          return interaction.reply({ content: '⚠️ Confirm first!', ephemeral: true });
        }

        const id = generateID();
        userCooldowns.set(user, now);

        return interaction.reply({
          content: `🧾 ID: **${id}**\nSave it!`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('proceed').setLabel('Proceed').setStyle(ButtonStyle.Success)
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

    // ================= MODAL =================
    if (interaction.isModalSubmit()) {
      const s = userSelections.get(user);
      if (!s) return;

      s.prompt = interaction.fields.getTextInputValue('prompt_input');

      return interaction.reply({
        content: `✅ Prompt saved!\n"${s.prompt}"`,
        ephemeral: true
      });
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      interaction.reply({ content: '❌ Error occurred', ephemeral: true });
    }
  }
});

client.login(process.env.BOT_TOKEN);