import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { registerCommands, handleInteraction as handleGameCommands } from './bot/commands.js';
import { registerRankingCommands, handleRankingCommand } from './bot/ranking-commands.js';
import { registerTeasingCommands, handleTeasingCommand } from './bot/teasing-commands.js';

// Load environment variables
dotenv.config();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Bot ready event
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} is online!`);
  
  // Register all command types
  await registerCommands(client);
  await registerRankingCommands(client);
  await registerTeasingCommands(client);
  console.log('🎯 All commands registered!');
});

// Handle all interactions
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    // Route to appropriate handler based on command
    if (interaction.commandName === 'endgame') {
      await handleGameCommands(interaction);
    } else if (['myrank', 'ladder'].includes(interaction.commandName)) {
      await handleRankingCommand(interaction);
    } else if (interaction.commandName === 'roast') {
      await handleTeasingCommand(interaction);
    }
  } else {
    // Non-slash command interactions go to game commands
    await handleGameCommands(interaction);
  }
});

// Start the bot
client.login(process.env.DISCORD_TOKEN);