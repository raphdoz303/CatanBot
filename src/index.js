import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { registerCommands } from './bot/commands.js';
import http from 'http';

// Load environment variables
dotenv.config();

// Create simple HTTP server for Render
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Catan Bot is running!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

// Create Discord client with required permissions
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers // Added for member selection
  ]
});

// Bot ready event
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} is online!`);
  
  // Register our slash commands
  await registerCommands(client);
  console.log('🎯 Commands registered!');
});

// Handle ALL interactions (slash commands, buttons, modals, select menus)
client.on('interactionCreate', async (interaction) => {
  const { handleInteraction } = await import('./bot/commands.js');
  await handleInteraction(interaction);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN);