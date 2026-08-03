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

  // 阶段推进配置：客户确认后自动推进到下一阶段
  stageFlow: {
    // 设计阶段
    '平面布局方案':   { next: '效果图设计',     progress: 5 },
    '效果图设计':     { next: '物料整理',       progress: 10 },
    '物料整理':       { next: '施工图设计',     progress: 15 },
    '施工图设计':     { next: '报价签合同',     progress: 20 },
    '报价签合同':     { next: '开工前期准备',   progress: 25 },
    // 施工阶段
    '开工前期准备':   { next: '拆除改造',       progress: 30 },
    '拆除改造':       { next: '水电隐蔽工程',   progress: 35 },
    '水电隐蔽工程':   { next: '防水工程',       progress: 40 },
    '防水工程':       { next: '泥瓦工程',       progress: 45 },
    '泥瓦工程':       { next: '木工吊顶',       progress: 50 },
    '木工吊顶':       { next: '油漆墙面',       progress: 55 },
    '油漆墙面':       { next: '安装阶段',       progress: 65 },
    '安装阶段':       { next: '开荒保洁竣工验收', progress: 80 },
    '开荒保洁竣工验收': { next: '竣工交付',     progress: 90 },
    // 软装阶段（与施工并行，不阻塞主流程）
    '软装-前期对接':  { next: '软装-方案设计',  progress: null },
    '软装-方案设计':  { next: '软装-深化定品',  progress: null },
    '软装-深化定品':  { next: '软装-采购跟单',  progress: null },
    '软装-采购跟单':  { next: '软装-进场摆场',  progress: null },
    '软装-进场摆场':  { next: '软装-售后质保',  progress: null },
    '软装-售后质保':  { next: null,             progress: null },
    // 竣工
    '竣工交付':       { next: null,             progress: 100 },
  },

  // 阶段分组（用于H5展示）
  stageGroups: {
    '设计阶段': ['平面布局方案', '效果图设计', '物料整理', '施工图设计', '报价签合同'],
    '施工阶段': ['开工前期准备', '拆除改造', '水电隐蔽工程', '防水工程', '泥瓦工程', '木工吊顶', '油漆墙面', '安装阶段', '开荒保洁竣工验收'],
    '软装阶段': ['软装-前期对接', '软装-方案设计', '软装-深化定品', '软装-采购跟单', '软装-进场摆场', '软装-售后质保'],
    '竣工交付': ['竣工交付'],
  },
};
