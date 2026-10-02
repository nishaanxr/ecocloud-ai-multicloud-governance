const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH 
  ? path.resolve(__dirname, '../../', process.env.DB_PATH)
  : path.resolve(__dirname, 'governance.sqlite');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;
try {
  db = new Database(dbPath, {
    // verbose: process.env.NODE_ENV === 'development' ? console.log : null
  });
  
  // Enable foreign keys and WAL mode for better concurrency
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Initialize schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  
  console.log(`[Database] SQLite connected and schema initialized at: ${dbPath}`);
} catch (error) {
  console.error('[Database] Failed to initialize SQLite database:', error.message);
  throw error;
}

/**
 * Health check helper for SQLite
 */
function checkHealth() {
  try {
    const result = db.prepare('SELECT 1 as healthy').get();
    return {
      status: result && result.healthy === 1 ? 'healthy' : 'unhealthy',
      database: 'SQLite',
      path: dbPath
    };
  } catch (err) {
    return {
      status: 'error',
      database: 'SQLite',
      error: err.message
    };
  }
}

/**
 * Graceful shutdown — close SQLite before process exit
 * Prevents better-sqlite3 assertion failures on hosted environments
 */
function closeDatabase() {
  try {
    if (db && db.open) {
      db.close();
      console.log('[Database] SQLite connection closed gracefully.');
    }
  } catch (err) {
    console.error('[Database] Error closing SQLite:', err.message);
  }
}

process.on('SIGTERM', () => {
  console.log('[Process] SIGTERM received. Shutting down gracefully...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Process] SIGINT received. Shutting down gracefully...');
  closeDatabase();
  process.exit(0);
});

process.on('exit', () => {
  closeDatabase();
});

module.exports = {
  db,
  checkHealth,
  closeDatabase
};
