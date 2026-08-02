/**
 * Configuration - Feishu Bitable table IDs and field mappings
 * On Render: environment variables are set in dashboard
 * On local: values from .env file (loaded by dotenv) or fallback defaults
 */
try { require('dotenv').config(); } catch(e) { /* dotenv not installed, using env vars directly */ }

module.exports = {
  feishu: {
    appId: process.env.FEISHU_APP_ID || 'cli_aae7cda72cb8dbc0',
    appSecret: process.env.FEISHU_APP_SECRET || 'A1oaS8xoN0EMkDIm8HOmFdcwPgWkd21h',
    appToken: process.env.FEISHU_APP_TOKEN || 'VdwxbP1vwa2XjZs2jLmcNBGKnMe',
  },
  tables: {
    project: process.env.FEISHU_TABLE_PROJECT || 'tblAG1FhgpckeRfC',
    needs: process.env.FEISHU_TABLE_NEEDS || 'tblB46Y4pvnoSWJA',
    acceptance: process.env.FEISHU_TABLE_ACCEPTANCE || 'tblIpniPozX2jYll',
    inspection: process.env.FEISHU_TABLE_INSPECTION || 'tblcJLchpdyqDW0l',
    finance: process.env.FEISHU_TABLE_FINANCE || 'tblIgHZwXyOlRORj',
    confirm: process.env.FEISHU_TABLE_CONFIRM || 'tblWdDRkieHqc1dm',
  },
  staffAccounts: JSON.parse(process.env.STAFF_ACCOUNTS || '{"D01":"lihe2026","P01":"lihe2026","B01":"lihe2026","A01":"lihe2026"}'),
  port: process.env.PORT || 3000,
};
