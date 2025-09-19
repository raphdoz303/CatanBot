// Google Sheets integration for Catan scores
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class SheetsManager {
  constructor() {
    this.doc = null;
    this.sheet = null;
  }

  async initialize() {
    try {
      console.log('📊 Initializing Google Sheets connection...');
      
      // Debug: Check if environment variables are loaded
      console.log('🔍 SHEET_ID:', process.env.SHEET_ID ? 'Found' : 'Missing');
      console.log('🔍 GOOGLE_SERVICE_EMAIL:', process.env.GOOGLE_SERVICE_EMAIL ? 'Found' : 'Missing');
      console.log('🔍 GOOGLE_SERVICE_ACCOUNT_JSON length:', process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.length || 'Missing');
      
      if (!process.env.GOOGLE_SERVICE_EMAIL || !process.env.SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        console.error('❌ Missing required environment variables');
        return false;
      }
      
      // Extract private key from the JSON
      const serviceAccountJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      
      console.log('🔍 Service account email from JSON:', serviceAccountJson.client_email);
      console.log('🔍 Private key starts with:', serviceAccountJson.private_key?.substring(0, 50) + '...');
      console.log('🔍 Private key length:', serviceAccountJson.private_key?.length);
      
      // Test JWT creation
      console.log('🔍 Creating JWT with:');
      console.log('  - Email:', serviceAccountJson.client_email);
      console.log('  - Key type:', typeof serviceAccountJson.private_key);
      console.log('  - Scopes: https://www.googleapis.com/auth/spreadsheets');
      
      const serviceAccountAuth = new JWT({
        email: serviceAccountJson.client_email,
        key: serviceAccountJson.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      // Test token generation manually
      console.log('🔍 Testing token generation...');
      const accessToken = await serviceAccountAuth.getAccessToken();
      console.log('🔍 Access token generated:', accessToken ? 'Success' : 'Failed');

      this.doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);
      await this.doc.loadInfo();
      
      console.log(`✅ Connected to sheet: ${this.doc.title}`);
      
      // Use the first sheet
      this.sheet = this.doc.sheetsByTitle['Endgames_scores_FROM BOT'];
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize sheets:', error);
      return false;
    }
  }

  async addGameScores(scores) {
    if (!this.sheet) {
      console.error('❌ Sheet not initialized');
      return false;
    }

    try {
      // Sort scores by position (highest score first)
      const sortedScores = [...scores].sort((a, b) => b.score - a.score);
      
      // Find the winner (highest score)
      const winner = sortedScores[0];
      
      // Create game row data
      const gameData = {
        Game_id: Date.now(),
        Game_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        Game_nb_players: scores.length,
        Game_VP: winner.score // Winner's score as game VP
      };
      
      // Add each player's data (up to 6 players)
      for (let i = 0; i < 6; i++) {
        if (i < sortedScores.length) {
          gameData[`Player_${i + 1}_Discord`] = sortedScores[i].player;
          gameData[`Player_${i + 1}_VP`] = sortedScores[i].score;
        } else {
          // Empty slots for unused player positions
          gameData[`Player_${i + 1}_Discord`] = '';
          gameData[`Player_${i + 1}_VP`] = '';
        }
      }
      
      console.log('📝 Game data to add:', gameData);
      
      await this.sheet.addRow(gameData);
      console.log(`✅ Added game record to sheet`);
      return true;
    } catch (error) {
      console.error('❌ Failed to add scores:', error);
      return false;
    }
  }
}