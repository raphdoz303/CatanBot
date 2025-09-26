import { SlashCommandBuilder } from 'discord.js';
import { SheetsManager } from '../storage/sheets.js';

// Define teasing slash command
const roastCommand = new SlashCommandBuilder()
  .setName('roast')
  .setDescription('Generate a playful Catan-themed teasing message')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The player to playfully tease')
      .setRequired(true));

// Register teasing commands
export async function registerTeasingCommands(client) {
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
      console.log('❌ Bot not in specified guild');
      return;
    }
    
    await guild.commands.create(roastCommand);
    console.log('📝 Teasing commands registered to guild');
  } catch (error) {
    console.error('❌ Error registering teasing commands:', error);
  }
}

// Handle teasing command interactions
export async function handleTeasingCommand(interaction) {
  if (interaction.commandName === 'roast') {
    await handleRoast(interaction);
  }
}

// Handle /insult command
async function handleRoast(interaction) {
  const targetUser = interaction.options.getUser('target');
  const senderUser = interaction.user; // The person who sent the command
  
  // Prevent self-teasing
  if (targetUser.id === senderUser.id) {
    await interaction.reply({
      content: 'Tu ne peux pas te taquiner toi-même! Trouve quelqu\'un d\'autre à embêter 😄',
      ephemeral: true
    });
    return;
  }
  
  await interaction.reply({
    content: '🎭 Préparation d\'une bonne taquinerie...',
    ephemeral: true
  });

  try {
    const sheetsManager = new SheetsManager();
    
    if (await sheetsManager.initialize()) {
      const messages = await sheetsManager.getTeasingMessages();
      
      if (messages && messages.length > 0) {
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        
        // Replace {player} placeholder with the target user mention
        const finalMessage = randomMessage.template.replace(/{player}/g, targetUser.toString());
        
        // Add sender signature
        const fullMessage = `${finalMessage}\n\n*— ${senderUser.username}*`;
        
        // Delete the loading message and post publicly
        await interaction.deleteReply();
        
        // Send the teasing message to the channel (public)
        await interaction.followUp({
          content: fullMessage,
          ephemeral: false
        });
      } else {
        await interaction.editReply({
          content: `Désolé, je n'ai pas d'inspiration pour taquiner ${targetUser} aujourd'hui!`
        });
      }
    } else {
      await interaction.editReply({
        content: 'Impossible de charger les messages de taquinerie!'
      });
    }
  } catch (error) {
    console.error('❌ Error in roast command:', error);
    await interaction.editReply({
      content: 'Erreur lors du chargement des taquineries!'
    });
  }
}