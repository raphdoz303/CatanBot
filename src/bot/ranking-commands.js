import { SlashCommandBuilder } from 'discord.js';
import { SheetsManager } from '../storage/sheets.js';

// Define ranking slash commands
const myRankCommand = new SlashCommandBuilder()
  .setName('myrank')
  .setDescription('Check your current ranking and stats');

const ladderCommand = new SlashCommandBuilder()
  .setName('ladder')
  .setDescription('View the top 5 players on the leaderboard');

// Register ranking commands
export async function registerRankingCommands(client) {
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      console.log('❌ Bot not in specified guild');
      return;
    }
    
    await guild.commands.create(myRankCommand);
    await guild.commands.create(ladderCommand);
    console.log('📝 Ranking commands registered to guild');
  } catch (error) {
    console.error('❌ Error registering ranking commands:', error);
  }
}

// Handle ranking command interactions
export async function handleRankingCommand(interaction) {
  if (interaction.commandName === 'myrank') {
    await handleMyRank(interaction);
  } else if (interaction.commandName === 'ladder') {
    await handleLadder(interaction);
  }
}

// Handle /myrank command
async function handleMyRank(interaction) {
  await interaction.reply({
    content: '⏳ Looking up your ranking...',
    ephemeral: true
  });

  try {
    const sheetsManager = new SheetsManager();
    
    if (await sheetsManager.initialize()) {
      const playerRank = await sheetsManager.getPlayerRank(interaction.user.username);
      
      if (playerRank && playerRank.rank) {
        const embed = {
          color: 0x0099ff, // Blue color
          title: '🏆 Your Catan Ranking',
          fields: [
            {
              name: '👤 Player',
              value: playerRank.player,
              inline: false
            },
            {
              name: '🏆 Rank',
              value: `#${playerRank.rank}`,
              inline: false
            },
            {
              name: '⭐ Points',
              value: `${playerRank.points}`,
              inline: false
            },
            {
              name: '🎲 Games Played',
              value: `${playerRank.games}`,
              inline: false
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Catan League Rankings'
          }
        };

        await interaction.editReply({
          content: '',
          embeds: [embed]
        });
      } else {
        await interaction.editReply({
          content: `❌ Could not find ranking for "${interaction.user.username}". Make sure you've played at least one game!`
        });
      }
    } else {
      await interaction.editReply({
        content: '❌ Unable to connect to rankings database. Please try again later.'
      });
    }
  } catch (error) {
    console.error('❌ Error in myrank command:', error);
    await interaction.editReply({
      content: '❌ Error retrieving your ranking. Please try again later.'
    });
  }
}

// Handle /ladder command
async function handleLadder(interaction) {
  console.log('🔍 Ladder command started');
  
  await interaction.reply({
    content: '⏳ Loading leaderboard...',
    ephemeral: false
  });
  
  console.log('🔍 Initial reply sent');

  try {
    console.log('🔍 Creating SheetsManager...');
    const sheetsManager = new SheetsManager();
    
    console.log('🔍 Initializing SheetsManager...');
    const initialized = await sheetsManager.initialize();
    console.log(`🔍 Sheets initialization result: ${initialized}`);
    
    if (initialized) {
      console.log('🔍 Getting ladder data...');
      const ladderData = await sheetsManager.getLadderData();
      console.log(`🔍 Ladder data result:`, ladderData);
      
      if (ladderData && ladderData.length > 0) {
        console.log(`🔍 Processing ${ladderData.length} players`);
        const top5 = ladderData.slice(0, 5);
        
        let leaderboard = '🏆 **Catan League Leaderboard - Top 5**\n\n';
        
        top5.forEach((player, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎯';
          leaderboard += `${medal} **#${player.rank} ${player.player}**\n`;
          leaderboard += `   ⭐ ${player.points} points • 🎲 ${player.games} games\n\n`;
        });
        
        console.log('🔍 About to edit reply with leaderboard');
        await interaction.editReply({
          content: leaderboard
        });
        console.log('🔍 Reply edited successfully');
      } else {
        console.log('🔍 No ladder data found');
        await interaction.editReply({
          content: '❌ No ranking data available yet. Play some games first!'
        });
      }
    } else {
      console.log('🔍 Sheets initialization failed');
      await interaction.editReply({
        content: '❌ Unable to connect to rankings database. Please try again later.'
      });
    }
  } catch (error) {
    console.error('❌ Error in ladder command:', error);
    console.error('❌ Error stack:', error.stack);
    
    try {
      await interaction.editReply({
        content: `❌ Error loading leaderboard: ${error.message}`
      });
    } catch (editError) {
      console.error('❌ Failed to edit reply:', editError);
    }
  }
}