const path = require('path');
const { importWorkbook } = require('./services/excelImportService');
const { validateMigration } = require('./services/migrationValidationService');

async function test() {
    console.log('--- Starting Excel Workbook Import Test ---');
    const workbookPath = path.resolve(__dirname, '../../Terry_Bakers_Production_Management_Template.xlsx');

    const summary = importWorkbook(workbookPath, {
        defaultDate: '2026-10-01',
        dryRun: false,
        userId: 1,
        username: 'ADMIN'
    });

    console.log('Import Summary:', JSON.stringify({
        imported: summary.recordsImported,
        skipped: summary.recordsSkipped,
        duplicates: summary.duplicates,
        warningsCount: summary.warnings.length,
        errorsCount: summary.validationErrors.length,
        breakdown: summary.breakdown
    }, null, 2));

    console.log('\n--- Running Migration Validation Against Excel ---');
    const validation = validateMigration(workbookPath);
    console.log('Overall Status:', validation.overallStatus);
    console.log('\nCore Metrics:');
    console.table(validation.metrics);

    console.log('\nCake Balances Comparison:');
    console.table(validation.cakeBalances);

    console.log('\nIngredient Balances Comparison:');
    console.table(validation.ingredientBalances);
}

test().catch(err => {
    console.error('Migration Test Failed:', err);
});
