import { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  UserSelectMenuBuilder
} from 'discord.js';
import { SheetsManager } from '../storage/sheets.js';

// Define our slash command
const endGameCommand = new SlashCommandBuilder()
  .setName('endgame')
  .setDescription('Record Catan game scores');

// Register slash commands with Discord
export async function registerCommands(client) {
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      console.log('❌ Bot not in specified guild');
      return;
    }
    
    await guild.commands.create(endGameCommand);
    console.log('📝 /endgame command registered to guild');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

// Handle all bot interactions (commands, buttons, modals, select menus)
export async function handleInteraction(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isUserSelectMenu()) {
      await handleMemberSelect(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (error) {
    console.error('❌ Interaction error:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: 'Something went wrong!', ephemeral: true });
    }
  }
}

// Handle /endgame command
async function handleSlashCommand(interaction) {
  if (interaction.commandName === 'endgame') {
    // Restrict to scoring channel only
    if (interaction.channelId !== process.env.SCORING_CHANNEL_ID) {
      await interaction.reply({
        content: '🎲 Please use `/endgame` in the <#1415741638684315719> channel!',
        ephemeral: true
      });
      return;
    }

    // Create buttons for player count (2-6 players)
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('players_2')
          .setLabel('2 Players')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('players_3')
          .setLabel('3 Players')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('players_4')
          .setLabel('4 Players')
          .setStyle(ButtonStyle.Primary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('players_5')
          .setLabel('5 Players')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('players_6')
          .setLabel('6 Players')
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.reply({
      content: '🎲 **End Game Score Entry**\nHow many players were in this game?',
      components: [row1, row2],
      ephemeral: true
    });
  }
}

// Handle button clicks
async function handleButton(interaction) {
  if (interaction.customId.startsWith('players_')) {
    const playerCount = parseInt(interaction.customId.split('_')[1]);
    
    // Create user select menu for member picking
    const memberSelect = new UserSelectMenuBuilder()
      .setCustomId(`select_members_${playerCount}`)
      .setPlaceholder(`Select ${playerCount} players for this game`)
      .setMinValues(playerCount)
      .setMaxValues(playerCount);

    const selectRow = new ActionRowBuilder()
      .addComponents(memberSelect);

    await interaction.reply({
      content: `🎲 **Select ${playerCount} players** who played in this Catan game:`,
      components: [selectRow],
      ephemeral: true
    });
  }
  
  // Handle winner selection
  else if (interaction.customId.startsWith('winner_')) {
    const parts = interaction.customId.split('_');
    const winner = parts[1];
    const allPlayers = parts.slice(2).join('_').split(',');
    
    console.log(`🏆 Winner: ${winner}, All players: ${allPlayers}`);

    // Modal 2: Collect winner's score
    const modal = new ModalBuilder()
      .setCustomId(`winner_score_${winner}_${allPlayers.join(',')}`)
      .setTitle(`🏆 ${winner} Won!`);

    const scoreRow = new ActionRowBuilder()
      .addComponents(
        new TextInputBuilder()
          .setCustomId('winner_score')
          .setLabel(`${winner}'s winning score`)
          .setPlaceholder('12')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      );

    modal.addComponents(scoreRow);
    await interaction.showModal(modal);
  }

  
  // Handle continue to remaining scores button
  else if (interaction.customId.startsWith('continue_scores_')) {
    const parts = interaction.customId.split('_');
    const winner = parts[2];
    const winnerScore = parts[3];
    const allPlayers = parts.slice(4).join('_').split(',');
    
    const remainingPlayers = allPlayers.filter(player => player !== winner);
    
    console.log(`📝 Creating final modal for: ${remainingPlayers}`);

    // Modal 3: Collect remaining players' scores
    const modal = new ModalBuilder()
      .setCustomId(`remaining_scores_${winner}_${winnerScore}_${allPlayers.join(',')}`)
      .setTitle('Enter Remaining Scores');

    // Add score fields for each remaining player
    for (const player of remainingPlayers) {
      const scoreRow = new ActionRowBuilder()
        .addComponents(
          new TextInputBuilder()
            .setCustomId(`score_${player}`)
            .setLabel(`${player}'s score`)
            .setPlaceholder('8')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        );
      modal.addComponents(scoreRow);
    }

    await interaction.showModal(modal);
  }  


}

// Handle member selection
async function handleMemberSelect(interaction) {
  const selectedUsers = interaction.users;
  const playerNames = selectedUsers.map(u => u.username);
  
  console.log('👥 Selected players:', playerNames);

  // Create winner selection buttons (max 5 per row)
  const winnerButtons = [];
  for (let i = 0; i < playerNames.length; i += 5) {
    const row = new ActionRowBuilder();
    const chunk = playerNames.slice(i, i + 5);
    
    for (const player of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`winner_${player}_${playerNames.join(',')}`)
          .setLabel(`🏆 ${player}`)
          .setStyle(ButtonStyle.Success)
      );
    }
    winnerButtons.push(row);
  }

  await interaction.reply({
    content: `🎲 **Players confirmed:** ${playerNames.join(', ')}\n\n🏆 **Who won this game?**`,
    components: winnerButtons,
    ephemeral: true
  });
}

// Handle modal submissions
async function handleModal(interaction) {
  if (interaction.customId.startsWith('winner_score_')) {
    const parts = interaction.customId.split('_');
    const winner = parts[2];
    const allPlayers = parts.slice(3).join('_').split(',');
    const winnerScore = interaction.fields.getTextInputValue('winner_score');
    
    const remainingPlayers = allPlayers.filter(player => player !== winner);
    
    console.log(`🏆 ${winner}: ${winnerScore} points`);
    console.log(`📝 Still need scores for: ${remainingPlayers}`);

    // Show button to continue to remaining scores
    const continueButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`continue_scores_${winner}_${winnerScore}_${allPlayers.join(',')}`)
          .setLabel('📝 Enter Other Scores')
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.reply({
      content: `🏆 **${winner}** won with **${winnerScore} points!**\n\nNow let's collect scores for: ${remainingPlayers.join(', ')}`,
      components: [continueButton],
      ephemeral: true
    });
  }
  
  else if (interaction.customId.startsWith('remaining_scores_')) {
    const parts = interaction.customId.split('_');
    const winner = parts[2];
    const winnerScore = parseInt(parts[3]);
    const allPlayers = parts.slice(4).join('_').split(',');
    
    // Collect all remaining scores
    const remainingPlayers = allPlayers.filter(player => player !== winner);
    const allScores = [{ player: winner, score: winnerScore }];
    
    // Parse remaining player scores from modal
    for (const player of remainingPlayers) {
      const score = parseInt(interaction.fields.getTextInputValue(`score_${player}`));
      allScores.push({ player, score });
    }
    
    // Sort by score (highest first)
    allScores.sort((a, b) => b.score - a.score);
    
    console.log('📊 Final scores:', allScores);
    
    // Save to Google Sheets
    const sheetsManager = new SheetsManager(); // Changed: no dynamic import
    
    if (await sheetsManager.initialize()) {
      await sheetsManager.addGameScores(allScores);
    }
    
    // Post game summary to channel
    await postGameSummary(interaction.client, allScores);
    
    await interaction.reply({
      content: '✅ **Game recorded!** Summary posted to channel and saved to Google Sheets.',
      ephemeral: true
    });
  }
}

// Post game summary to endgame_scores channel
async function postGameSummary(client, scores) {
  const channelId = process.env.LEADERBOARD_CHANNEL_ID;
  const channel = client.channels.cache.get(channelId);
  
  if (!channel) {
    console.error('❌ Could not find leaderboard channel:', channelId);
    return;
  }
  
  // Format current date
  const gameDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Create ranking text
  let rankingText = '';
  scores.forEach((entry, index) => {
    const medal = index === 0 ? '    🥇' : index === 1 ? '    🥈' : index === 2 ? '    🥉' : '    🐑';
    rankingText += `${medal} **${entry.player}**: ${entry.score} points\n`;
  });
  
  const summaryMessage = `🎲 **Catan Game Summary**\n\n` +
    `📅 **Date**: ${gameDate}\n` +
    `👥 **Players**: ${scores.length}\n\n` +
    `**Final Rankings**:\n${rankingText}\n` +
    `Congratulations ${scores[0].player}! 🎉`;
  
  try {
    await channel.send(summaryMessage);
    console.log('✅ Game summary posted to leaderboard channel');
  } catch (error) {
    console.error('❌ Failed to post summary:', error);
  }
}