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
      
      // Use the specific named sheet
      this.sheet = this.doc.sheetsByTitle['Endgames_scores_FROM BOT'];
      
      if (!this.sheet) {
        console.error('❌ Could not find sheet "Endgames_scores_FROM BOT"');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize sheets:', error);
      return false;
    }
  }

  async addGameScores(scores, gameId, loggedByUser) {
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
        Game_id: gameId, // Use the provided game ID
        Game_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        Game_nb_players: scores.length,
        Game_VP: winner.score, // Winner's score as game VP
        Game_logged_by_user: loggedByUser // Add Discord username who logged the game
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
      console.log(`✅ Added game record to sheet (logged by: ${loggedByUser})`);
      return true;
    } catch (error) {
      console.error('❌ Failed to add scores:', error);
      console.error('❌ Error details:', error.message);
      return false;
    }
  }
  async getLadderData() {
    try {
      const ladderSheet = this.doc.sheetsByTitle['LADDER'];
      if (!ladderSheet) {
        console.error('❌ LADDER sheet not found');
        return null;
      }

      await ladderSheet.loadCells('B:E'); // Load columns B-E
      
      const ladderData = [];
      let row = 2; // Start from row 2 (assuming row 1 is headers)
      
      while (row <= 100) { // Check up to 100 rows
        const rank = ladderSheet.getCell(row - 1, 1).value; // Column B
        const player = ladderSheet.getCell(row - 1, 2).value; // Column C
        const points = ladderSheet.getCell(row - 1, 3).value; // Column D
        const games = ladderSheet.getCell(row - 1, 4).value; // Column E
        
        if (!player) break; // No more data
        
        ladderData.push({
          rank: rank,
          player: player,
          points: points,
          games: games
        });
        
        row++;
      }
      
      console.log(`📊 Loaded ladder data for ${ladderData.length} players`);
      return ladderData;
    } catch (error) {
      console.error('❌ Failed to load ladder data:', error);
      return null;
    }
  }

  async getPlayerRank(playerName) {
    try {
      const myRankSheet = this.doc.sheetsByTitle['MY_RANK'];
      if (!myRankSheet) {
        console.error('❌ MY_RANK sheet not found');
        return null;
      }

      await myRankSheet.loadCells('B3:E3');
      
      // Set the player name in B3
      myRankSheet.getCell(2, 1).value = playerName; // B3 (0-indexed: row 2, col 1)
      await myRankSheet.saveUpdatedCells();
      
      // Wait a moment for formulas to recalculate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload to get updated values
      await myRankSheet.loadCells('B3:E3');
      
      const rank = myRankSheet.getCell(2, 2).value; // C3
      const points = myRankSheet.getCell(2, 3).value; // D3
      const games = myRankSheet.getCell(2, 4).value; // E3
      
      return {
        player: playerName,
        rank: rank,
        points: points,
        games: games
      };
    } catch (error) {
      console.error('❌ Failed to get player rank:', error);
      return null;
    }
  }

  async getLadderData() {
    try {
      console.log('🔍 Looking for LADDER sheet...');
      const ladderSheet = this.doc.sheetsByTitle['LADDER'];
      if (!ladderSheet) {
        console.error('❌ LADDER sheet not found');
        console.log('🔍 Available sheets:', Object.keys(this.doc.sheetsByTitle));
        return null;
      }

      console.log('🔍 Loading cells B:E...');
      await ladderSheet.loadCells('B:E');
      console.log('🔍 Cells loaded successfully');
      
      const ladderData = [];
      let row = 2;
      
      console.log('🔍 Starting to read rows...');
      while (row <= 100) {
        const rank = ladderSheet.getCell(row - 1, 1).value;
        const player = ladderSheet.getCell(row - 1, 2).value;
        const points = ladderSheet.getCell(row - 1, 3).value;
        const games = ladderSheet.getCell(row - 1, 4).value;
        
        if (!player) {
          console.log(`🔍 No player found at row ${row}, stopping`);
          break;
        }
        
        console.log(`🔍 Row ${row}: ${player}, Rank: ${rank}, Points: ${points}, Games: ${games}`);
        
        ladderData.push({
          rank: rank,
          player: player,
          points: points,
          games: games
        });
        
        row++;
      }
      
      console.log(`📊 Loaded ladder data for ${ladderData.length} players`);
      return ladderData;
    } catch (error) {
      console.error('❌ Failed to load ladder data:', error);
      console.error('❌ Error details:', error.message);
      return null;
    }
  }

  async getPlayerRank(playerName) {
    try {
      const myRankSheet = this.doc.sheetsByTitle['MY_RANK'];
      if (!myRankSheet) {
        console.error('❌ MY_RANK sheet not found');
        return null;
      }

      await myRankSheet.loadCells('B3:E3');
      
      // Set the player name in B3
      myRankSheet.getCell(2, 1).value = playerName; // B3 (0-indexed: row 2, col 1)
      await myRankSheet.saveUpdatedCells();
      
      // Wait a moment for formulas to recalculate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload to get updated values
      await myRankSheet.loadCells('B3:E3');
      
      const rank = myRankSheet.getCell(2, 2).value; // C3
      const points = myRankSheet.getCell(2, 3).value; // D3
      const games = myRankSheet.getCell(2, 4).value; // E3
      
      if (!rank || rank === '#N/A' || rank === '') {
        return null; // Player not found
      }
      
      return {
        player: playerName,
        rank: rank,
        points: points,
        games: games
      };
    } catch (error) {
      console.error('❌ Failed to get player rank:', error);
      return null;
    }
  }
  async getTeasingMessages() {
    try {
      const teasingSheet = this.doc.sheetsByTitle['TEASING_MESSAGES'];
      if (!teasingSheet) {
        console.error('❌ TEASING_MESSAGES sheet not found');
        console.log('🔍 Available sheets:', Object.keys(this.doc.sheetsByTitle));
        return null;
      }

      await teasingSheet.loadCells('A:A'); // Only load column A since we don't use signatures from sheet
      
      const messages = [];
      let row = 1; // Start from row 1
      
      while (row <= 100) {
        const message = teasingSheet.getCell(row - 1, 0).value; // Column A
        
        if (!message) break; // No more messages
        
        messages.push({
          template: message
        });
        
        row++;
      }
      
      console.log(`🎭 Loaded ${messages.length} teasing messages`);
      return messages;
    } catch (error) {
      console.error('❌ Failed to load teasing messages:', error);
      return null;
    }
  }
}