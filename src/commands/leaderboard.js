// src/commands/leaderboard.js

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

// Set your Pirate King role ID here (should be an ENV var ideally)
const PIRATE_KING_ROLE_ID = '717768828368715781';

// Emoji/label for Pirate King styling
const PIRATE_KING_EMOJI = '👑';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the Grand Line Bounty Board')
    .addStringOption(option =>
      option.setName('view')
        .setDescription('Leaderboard view')
        .addChoices(
          { name: 'Top 3', value: 'top3' },
          { name: 'Top 10', value: 'top10' },
          { name: 'Full Leaderboard', value: 'full' }
        )
        .setRequired(false)
    ),

  async execute(interaction, client, xpTracker) {
    // Fix: Only check customId if this is a button interaction
    if (interaction.isButton && interaction.customId && interaction.customId.startsWith('lb_view_')) {
      interaction.options = {
        getString: () => interaction.customId.replace('lb_view_', ''),
      };
    }

    // Get which view: top3 (default), top10, or full
    const view = interaction.options.getString('view') || 'top3';

    // Defer only if it's an initial command
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false });
    }

    // Fetch all members and XP
    const guild = interaction.guild;
    await guild.members.fetch(); // Make sure all members are cached

    // Get leaderboard data from xpTracker
    // Assumes xpTracker.getLeaderboard returns [{ userId, xp, level, rep }]
    let allUsers = await xpTracker.getLeaderboard(guild.id);

    // Find Pirate King (first user with the special role)
    let pirateKingUser = null;
    for (const member of guild.members.cache.values()) {
      if (member.roles.cache.has(PIRATE_KING_ROLE_ID)) {
        pirateKingUser = allUsers.find(u => u.userId === member.id);
        if (!pirateKingUser) {
          // If the Pirate King has no XP entry, add a blank one
          pirateKingUser = {
            userId: member.id,
            xp: 0,
            level: 1,
            rep: 0
          };
          allUsers.unshift(pirateKingUser);
        }
        break;
      }
    }

    // Remove Pirate King from the rest of the leaderboard
    const pirates = allUsers.filter(u => !pirateKingUser || u.userId !== pirateKingUser.userId);

    // Sort pirates by XP descending
    pirates.sort((a, b) => b.xp - a.xp);

    // Prepare view-specific output
    let embed, content;
    if (view === 'top3' || view === 'top10') {
      const n = view === 'top3' ? 3 : 10;
      const shownPirates = pirates.slice(0, n);

      // Fetch Discord users for display names
      const pirateKingMember = pirateKingUser
        ? await guild.members.fetch(pirateKingUser.userId).catch(() => null)
        : null;
      const pirateKingName = pirateKingMember
        ? pirateKingMember.displayName
        : '???';

      // Prepare leaderboard lines
      let leaderboard = '';

      // Pirate King special section
      if (pirateKingUser) {
        leaderboard +=
          `**${PIRATE_KING_EMOJI} PIRATE KING: ${pirateKingName.toUpperCase()} ${PIRATE_KING_EMOJI}**\n` +
          `BOUNTY: ฿${pirateKingUser.xp.toLocaleString()}\n` +
          `LEVEL: ${pirateKingUser.level} | ⭐${pirateKingUser.rep} Rep\n\n`;
      }

      // Top pirates
      let rank = 1;
      for (const pirate of shownPirates) {
        const member = await guild.members.fetch(pirate.userId).catch(() => null);
        const displayName = member ? member.displayName : '???';
        leaderboard +=
          `[**RANK ${rank}**] ${displayName}\n` +
          `BOUNTY: ฿${pirate.xp.toLocaleString()}\n` +
          `LEVEL: ${pirate.level} | ⭐${pirate.rep} Rep\n\n`;
        rank++;
      }

      // Themed headline and footer
      embed = new EmbedBuilder()
        .setColor(0xf7d560)
        .setTitle('📑 WORLD ECONOMIC NEWS PAPER 📑')
        .setDescription(
          '```\nURGENT BOUNTY BULLETIN\nTOP CRIMINALS IDENTIFIED\n```\n' +
          leaderboard +
          (view === 'top3'
            ? '... and more dangerous pirates below!\n\n' +
              '```\nUSE /leaderboard OR PRESS BUTTONS BELOW FOR FULL LIST\nSTAY VIGILANT, STAY SAFE\n```'
            : '```\nUse Full Leaderboard button to see every pirate!\n```')
        );
    } else if (view === 'full') {
      // Full Leaderboard as text, with pagination if needed
      let lines = [];

      // Pirate King first
      if (pirateKingUser) {
        const pirateKingMember = await guild.members.fetch(pirateKingUser.userId).catch(() => null);
        const pirateKingName = pirateKingMember ? pirateKingMember.displayName : '???';
        lines.push(
          `**${PIRATE_KING_EMOJI} PIRATE KING: ${pirateKingName.toUpperCase()} ${PIRATE_KING_EMOJI}** ` +
          `| ฿${pirateKingUser.xp.toLocaleString()} | LVL ${pirateKingUser.level} | ⭐${pirateKingUser.rep} Rep`
        );
      }

      // All other pirates, ranked
      let rank = 1;
      for (const pirate of pirates) {
        const member = await guild.members.fetch(pirate.userId).catch(() => null);
        const displayName = member ? member.displayName : '???';
        lines.push(
          `[${rank}] ${displayName} | ฿${pirate.xp.toLocaleString()} | LVL ${pirate.level} | ⭐${pirate.rep} Rep`
        );
        rank++;
      }

      // Discord message length limit: 2000 chars, so paginate if needed
      const chunkSize = 40; // ~40 pirates per message
      for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize).join('\n');
        if (i === 0) {
          content = '```markdown\n' + chunk + '\n```';
        } else {
          await interaction.followUp({ content: '```markdown\n' + chunk + '\n```', ephemeral: false });
        }
      }
    }

    // Buttons row
    const makeButton = (id, label, current) =>
      new ButtonBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(current ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(current);

    const buttons = new ActionRowBuilder().addComponents(
      makeButton('lb_view_top3', 'Top 3', view === 'top3'),
      makeButton('lb_view_top10', 'Top 10', view === 'top10'),
      makeButton('lb_view_full', 'Full Leaderboard', view === 'full')
    );

    // Send reply or edit
    if (view === 'full') {
      // For "full", use message content, not embed
      await interaction.editReply({
        content,
        embeds: [],
        components: [buttons]
      });
    } else {
      await interaction.editReply({
        embeds: [embed],
        components: [buttons]
      });
    }
  }
};
