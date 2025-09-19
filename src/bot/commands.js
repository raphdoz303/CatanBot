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

// Track active game sessions
const activeGameSessions = new Map(); // gameId -> {timestamp, completed, userId, username, players}

// Clean up old game sessions every 30 minutes
setInterval(() => {
  const thirtyMinutesAgo = Date.now() - 1800000;
  for (const [gameId, session] of activeGameSessions.entries()) {
    if (session.timestamp < thirtyMinutesAgo) {
      activeGameSessions.delete(gameId);
    }
  }
  if (activeGameSessions.size > 0) {
    console.log(`🧹 Cleaned up old game sessions. Active sessions: ${activeGameSessions.size}`);
  }
}, 1800000);

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
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ content: 'Something went wrong!', ephemeral: true });
      } catch (replyError) {
        console.error('❌ Failed to send error reply:', replyError);
      }
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

    // Generate unique game session ID
    const gameSessionId = Date.now();
    
    // Store the game session
    activeGameSessions.set(gameSessionId, {
      timestamp: Date.now(),
      completed: false,
      userId: interaction.user.id,
      username: interaction.user.username,
      players: []
    });
    
    console.log(`🎮 New game session started: ${gameSessionId} by ${interaction.user.username}`);

    // Create buttons for player count (2-6 players) with game ID
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`players_2_${gameSessionId}`)
          .setLabel('2 Players')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`players_3_${gameSessionId}`)
          .setLabel('3 Players')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`players_4_${gameSessionId}`)
          .setLabel('4 Players')
          .setStyle(ButtonStyle.Primary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`players_5_${gameSessionId}`)
          .setLabel('5 Players')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`players_6_${gameSessionId}`)
          .setLabel('6 Players')
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.reply({
      content: `🎲 **End Game Score Entry** (Game ID: ${gameSessionId})\nHow many players were in this game?`,
      components: [row1, row2],
      ephemeral: true
    });
  }
}

// Validate game session
function validateGameSession(gameSessionId, interaction) {
  const session = activeGameSessions.get(gameSessionId);
  if (!session) {
    return { valid: false, message: '❌ Invalid game session. Please start a new game with `/endgame`.' };
  }
  if (session.completed) {
    return { valid: false, message: '🚫 This game has already been completed and recorded!' };
  }
  if (session.userId !== interaction.user.id) {
    return { valid: false, message: '❌ You can only interact with games you started.' };
  }
  return { valid: true };
}

// Handle button clicks
async function handleButton(interaction) {
  if (interaction.customId.startsWith('players_')) {
    const parts = interaction.customId.split('_');
    const playerCount = parseInt(parts[1]);
    const gameSessionId = parseInt(parts[2]);
    
    const validation = validateGameSession(gameSessionId, interaction);
    if (!validation.valid) {
      await interaction.reply({ content: validation.message, ephemeral: true });
      return;
    }
    
    // Create user select menu for member picking
    const memberSelect = new UserSelectMenuBuilder()
      .setCustomId(`select_members_${playerCount}_${gameSessionId}`)
      .setPlaceholder(`Select ${playerCount} players for this game`)
      .setMinValues(playerCount)
      .setMaxValues(playerCount);

    const selectRow = new ActionRowBuilder()
      .addComponents(memberSelect);

    await interaction.update({
      content: `🎲 **Select ${playerCount} players** who played in this Catan game (Game ID: ${gameSessionId}):`,
      components: [selectRow]
    });
  }
  
  // Handle winner selection
  else if (interaction.customId.startsWith('winner|')) {
    const parts = interaction.customId.split('|');
    const winnerIndex = parseInt(parts[1]);
    const gameSessionId = parseInt(parts[2]);
    
    const validation = validateGameSession(gameSessionId, interaction);
    if (!validation.valid) {
      await interaction.reply({ content: validation.message, ephemeral: true });
      return;
    }

    // Get player names from session
    const session = activeGameSessions.get(gameSessionId);
    const allPlayers = session.players;
    const winner = allPlayers[winnerIndex];

    console.log(`🏆 Winner: ${winner}, Game: ${gameSessionId}`);

    // Modal 2: Collect winner's score
    const modal = new ModalBuilder()
      .setCustomId(`winner_score|${winnerIndex}|${gameSessionId}`)
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
  else if (interaction.customId.startsWith('continue|')) {
    const parts = interaction.customId.split('|');
    const winnerIndex = parseInt(parts[1]);
    const winnerScore = parseInt(parts[2]);
    const gameSessionId = parseInt(parts[3]);
    
    const validation = validateGameSession(gameSessionId, interaction);
    if (!validation.valid) {
      await interaction.reply({ content: validation.message, ephemeral: true });
      return;
    }
    
    // Get player names from session
    const session = activeGameSessions.get(gameSessionId);
    const allPlayers = session.players;
    const winner = allPlayers[winnerIndex];
    const remainingPlayers = allPlayers.filter(player => player !== winner);
    
    console.log(`📝 Creating final modal for: ${remainingPlayers}, Game: ${gameSessionId}`);

    // Modal 3: Collect remaining players' scores
    const modal = new ModalBuilder()
      .setCustomId(`remaining_scores|${winnerIndex}|${winnerScore}|${gameSessionId}`)
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
  const parts = interaction.customId.split('_');
  const playerCount = parseInt(parts[2]);
  const gameSessionId = parseInt(parts[3]);
  
  const validation = validateGameSession(gameSessionId, interaction);
  if (!validation.valid) {
    await interaction.reply({ content: validation.message, ephemeral: true });
    return;
  }
  
  const selectedUsers = interaction.users;
  const playerNames = selectedUsers.map(u => u.username);
  
  console.log(`👥 Selected players for game ${gameSessionId}:`, playerNames);

  // Store player names in the game session for later lookup
  const session = activeGameSessions.get(gameSessionId);
  session.players = playerNames;
  activeGameSessions.set(gameSessionId, session);

  // Create winner selection buttons using player indices instead of names
  const winnerButtons = [];
  for (let i = 0; i < playerNames.length; i += 5) {
    const row = new ActionRowBuilder();
    const chunk = playerNames.slice(i, i + 5);
    
    chunk.forEach((player, chunkIndex) => {
      const playerIndex = i + chunkIndex;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`winner|${playerIndex}|${gameSessionId}`)
          .setLabel(`🏆 ${player}`)
          .setStyle(ButtonStyle.Success)
      );
    });
    winnerButtons.push(row);
  }

  await interaction.update({
    content: `🎲 **Players confirmed:** ${playerNames.join(', ')} (Game ID: ${gameSessionId})\n\n🏆 **Who won this game?**`,
    components: winnerButtons
  });
}

// Handle modal submissions
async function handleModal(interaction) {
  if (interaction.customId.startsWith('winner_score|')) {
    const parts = interaction.customId.split('|');
    const winnerIndex = parseInt(parts[1]);
    const gameSessionId = parseInt(parts[2]);
    const winnerScore = interaction.fields.getTextInputValue('winner_score');
    
    const validation = validateGameSession(gameSessionId, interaction);
    if (!validation.valid) {
      await interaction.reply({ content: validation.message, ephemeral: true });
      return;
    }
    
    // Get player names from session
    const session = activeGameSessions.get(gameSessionId);
    const allPlayers = session.players;
    const winner = allPlayers[winnerIndex];
    const remainingPlayers = allPlayers.filter(player => player !== winner);
    
    console.log(`🏆 ${winner}: ${winnerScore} points (Game: ${gameSessionId})`);
    console.log(`📝 Still need scores for: ${remainingPlayers}`);

    // Show button to continue to remaining scores
    const continueButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`continue|${winnerIndex}|${winnerScore}|${gameSessionId}`)
          .setLabel('📝 Enter Other Scores')
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.reply({
      content: `🏆 **${winner}** won with **${winnerScore} points!** (Game ID: ${gameSessionId})\n\nNow let's collect scores for: ${remainingPlayers.join(', ')}`,
      components: [continueButton],
      ephemeral: true
    });
  }
  
  else if (interaction.customId.startsWith('remaining_scores|')) {
    const parts = interaction.customId.split('|');
    const winnerIndex = parseInt(parts[1]);
    const winnerScore = parseInt(parts[2]);
    const gameSessionId = parseInt(parts[3]);
    
    const validation = validateGameSession(gameSessionId, interaction);
    if (!validation.valid) {
      await interaction.reply({ content: validation.message, ephemeral: true });
      return;
    }
    
    // Get player names from session
    const session = activeGameSessions.get(gameSessionId);
    const allPlayers = session.players;
    const winner = allPlayers[winnerIndex];
    
    // Mark this game as completed to prevent reuse
    session.completed = true;
    activeGameSessions.set(gameSessionId, session);
    
    console.log(`🔒 Game session completed: ${gameSessionId}`);
    
    // RESPOND IMMEDIATELY to prevent timeout
    await interaction.reply({
      content: `⏳ **Processing scores for Game ${gameSessionId}...** This may take a moment.`,
      ephemeral: true
    });
    
    try {
      // Collect all remaining scores
      const remainingPlayers = allPlayers.filter(player => player !== winner);
      const allScores = [{ player: winner, score: winnerScore }];
      
      console.log(`🔍 Processing remaining players for Game ${gameSessionId}:`, remainingPlayers);
      
      // Parse remaining player scores from modal
      for (const player of remainingPlayers) {
        console.log(`🔍 Getting score for player: ${player}`);
        const score = parseInt(interaction.fields.getTextInputValue(`score_${player}`));
        allScores.push({ player, score });
        console.log(`✅ Added ${player}: ${score}`);
      }
      
      // Sort by score (highest first)
      allScores.sort((a, b) => b.score - a.score);
      console.log(`📊 Final scores for Game ${gameSessionId}:`, allScores);
      
      // Save to Google Sheets with the same game ID and logging user
      console.log(`🔍 Initializing Google Sheets for Game ${gameSessionId}...`);
      const sheetsManager = new SheetsManager();
      
      const initialized = await sheetsManager.initialize();
      console.log(`🔍 Sheets initialization result: ${initialized}`);
      
      if (initialized) {
        console.log(`🔍 Adding scores to sheets for Game ${gameSessionId}...`);
        const addResult = await sheetsManager.addGameScores(allScores, gameSessionId, interaction.user.username);
        console.log(`🔍 Add scores result: ${addResult}`);
      } else {
        console.error(`❌ Failed to initialize Google Sheets for Game ${gameSessionId}`);
      }
      
      // Post game summary to channel
      console.log(`🔍 Posting game summary for Game ${gameSessionId}...`);
      await postGameSummary(interaction.client, allScores, gameSessionId);
      
      // UPDATE the user with success message
      await interaction.editReply({
        content: `✅ **Game ${gameSessionId} recorded!** Summary posted to channel and saved to Google Sheets.`,
        components: []
      });

      console.log(`✅ Game ${gameSessionId} completed successfully`);

    } catch (error) {
      console.error(`❌ Error processing Game ${gameSessionId}:`, error);
      console.error(`❌ Error stack:`, error.stack);
      
      try {
        await interaction.editReply({
          content: `❌ **Error recording Game ${gameSessionId}.** Error: ${error.message}`,
          components: []
        });
      } catch (replyError) {
        console.error('❌ Failed to send error reply:', replyError);
      }
    }
  }
}

// Post game summary to endgame_scores channel
async function postGameSummary(client, scores, gameId) {
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
    const medal = index === 0 ? '       🥇' : index === 1 ? '      🥈' : index === 2 ? '       🥉' : '          🐑';
    rankingText += `${medal} **${entry.player}**: ${entry.score} points\n`;
  });
  
  const summaryMessage = `🎲 **Catan Game Summary** (ID: ${gameId})\n\n` +
    `📅 **Date**: ${gameDate}\n` +
    `👥 **Players**: ${scores.length}\n\n` +
    `🏆 **Final Ranking**:\n${rankingText}\n` +
    `Congratulations ${scores[0].player}! 🎉`;
  
  try {
    await channel.send(summaryMessage);
    console.log(`✅ Game summary posted to leaderboard channel for Game ${gameId}`);
  } catch (error) {
    console.error(`❌ Failed to post summary for Game ${gameId}:`, error);
  }
}