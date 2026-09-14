const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const DATABASE_URL = process.env.DATABASE_URL;

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Generate backup filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(BACKUP_DIR, `dailybloom-backup-${timestamp}.sql`);

console.log('Starting database backup...');

// Use pg_dump to backup the database
const dumpCommand = `pg_dump "${DATABASE_URL}" > "${backupFile}"`;

exec(dumpCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
  
  if (stderr) {
    console.error('pg_dump stderr:', stderr);
  }
  
  console.log(`Backup completed successfully: ${backupFile}`);
  
  // Compress the backup file
  const gzipCommand = `gzip "${backupFile}"`;
  exec(gzipCommand, (gzipError, gzipStdout, gzipStderr) => {
    if (gzipError) {
      console.warn('Compression failed (backup still available):', gzipError);
      process.exit(0);
    }
    
    const compressedFile = `${backupFile}.gz`;
    console.log(`Backup compressed: ${compressedFile}`);
    
    // Clean up old backups (keep last 7 days)
    const cleanupCommand = `find "${BACKUP_DIR}" -name "dailybloom-backup-*.sql.gz" -mtime +7 -delete`;
    exec(cleanupCommand, (cleanupError) => {
      if (cleanupError) {
        console.warn('Cleanup failed:', cleanupError);
      }
      
      console.log('Old backups cleaned up (keeping last 7 days)');
      process.exit(0);
    });
  });
});
