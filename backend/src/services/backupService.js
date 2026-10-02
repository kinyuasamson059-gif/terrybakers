const fs = require('fs');
const path = require('path');
const { DB_PATH, BACKUP_DIR, db } = require('../database/db');
const { logAction } = require('./auditService');

function createBackup(userId = null, username = 'ADMIN') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `terrybakers_backup_${timestamp}.db`;
    const backupFilePath = path.resolve(BACKUP_DIR, backupFileName);

    // Using better-sqlite3 native backup API which safely creates a consistent hot backup
    return db.backup(backupFilePath)
        .then(() => {
            const stats = fs.statSync(backupFilePath);
            const backupInfo = {
                fileName: backupFileName,
                filePath: backupFilePath,
                size: stats.size,
                createdAt: new Date().toISOString()
            };

            logAction({
                userId,
                username,
                action: 'BACKUP_CREATED',
                tableName: 'system',
                details: `Created backup file ${backupFileName} (${(stats.size / 1024).toFixed(1)} KB)`
            });

            return backupInfo;
        });
}

function listBackups() {
    if (!fs.existsSync(BACKUP_DIR)) {
        return [];
    }

    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .map(f => {
            const fullPath = path.resolve(BACKUP_DIR, f);
            const stats = fs.statSync(fullPath);
            return {
                fileName: f,
                filePath: fullPath,
                sizeBytes: stats.size,
                sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
                createdAt: stats.mtime.toISOString()
            };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return files;
}

function restoreBackup(fileName, userId = null, username = 'ADMIN') {
    const backupFilePath = path.resolve(BACKUP_DIR, fileName);
    if (!fs.existsSync(backupFilePath)) {
        throw new Error(`Backup file ${fileName} does not exist`);
    }

    // First make an automatic safety backup of current db before restoring
    const safetyName = `pre_restore_safety_${Date.now()}.db`;
    fs.copyFileSync(DB_PATH, path.resolve(BACKUP_DIR, safetyName));

    // Restore by copying backup file over target db
    // Note: We close WAL checkpoints or execute WAL checkpoint truncate first
    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
        console.warn('WAL checkpoint warning during restore:', e);
    }

    fs.copyFileSync(backupFilePath, DB_PATH);

    logAction({
        userId,
        username,
        action: 'BACKUP_RESTORED',
        tableName: 'system',
        details: `Restored database from ${fileName}. Pre-restore backup saved as ${safetyName}.`
    });

    return {
        restoredFrom: fileName,
        safetyBackup: safetyName,
        restoredAt: new Date().toISOString()
    };
}

module.exports = {
    createBackup,
    listBackups,
    restoreBackup
};
