/**
 * 清空飞书所有表的数据记录 + 重构项目表字段
 * Usage: node clear-all-records.js
 */
const { feishuRequest, getToken } = require('./lib/feishu.js');
const config = require('./lib/config.js');

const APP_TOKEN = config.feishu.appToken;
const TABLES = config.tables;

async function getAllRecords(tableId) {
  const all = [];
  let pageToken = null;
  do {
    let path = `/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records?page_size=500`;
    if (pageToken) path += `&page_token=${pageToken}`;
    const result = await feishuRequest('GET', path);
    if (result.code !== 0) {
      console.error(`Error getting records from ${tableId}:`, result.msg);
      return all;
    }
    if (result.data.items) {
      all.push(...result.data.items);
    }
    pageToken = result.data.page_token;
    if (result.data.has_more === false) break;
  } while (pageToken);
  return all;
}

async function batchDeleteRecords(tableId, recordIds) {
  // Feishu allows max 500 records per batch delete
  const batchSize = 500;
  for (let i = 0; i < recordIds.length; i += batchSize) {
    const batch = recordIds.slice(i, i + batchSize);
    const result = await feishuRequest('POST',
      `/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records/batch_delete`,
      { records: batch }
    );
    if (result.code !== 0) {
      console.error(`Error deleting batch from ${tableId}:`, result.msg);
    } else {
      console.log(`  Deleted ${batch.length} records`);
    }
  }
}

async function listFields(tableId) {
  const result = await feishuRequest('GET',
    `/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/fields`
  );
  if (result.code === 0 && result.data && result.data.items) {
    return result.data.items;
  }
  return [];
}

async function createField(tableId, fieldConfig) {
  const result = await feishuRequest('POST',
    `/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/fields`,
    fieldConfig
  );
  if (result.code === 0) {
    console.log(`  Field created: ${fieldConfig.field_name}`);
    return result.data.field;
  } else {
    console.error(`  Failed to create field ${fieldConfig.field_name}:`, result.msg);
    return null;
  }
}

async function main() {
  console.log('===== Step 1: Clear all records from all tables =====\n');

  const tableNames = {
    project: '项目管理表',
    needs: '客户需求表',
    acceptance: '验收记录表',
    inspection: '巡检记录表',
    finance: '财务记录表',
    confirm: '确认节点表',
  };

  for (const [key, name] of Object.entries(tableNames)) {
    const tableId = TABLES[key];
    console.log(`[${name}] (${tableId}) - Getting records...`);
    const records = await getAllRecords(tableId);
    console.log(`  Found ${records.length} records`);

    if (records.length > 0) {
      const ids = records.map(r => r.record_id);
      await batchDeleteRecords(tableId, ids);
    }
    console.log('');
  }

  console.log('===== Step 2: Add new role fields to project table =====\n');

  const projectTableId = TABLES.project;

  // Check existing fields
  const existingFields = await listFields(projectTableId);
  const existingFieldNames = existingFields.map(f => f.field_name);
  console.log('Existing fields in project table:', existingFieldNames.join(', '));

  // New role fields to add
  const newFields = [
    { field_name: '设计师工号', type: 1 },
    { field_name: '设计师姓名', type: 1 },
    { field_name: '软装设计师工号', type: 1 },
    { field_name: '软装设计师姓名', type: 1 },
    { field_name: '施工图设计师工号', type: 1 },
    { field_name: '施工图设计师姓名', type: 1 },
    { field_name: '施工监理工号', type: 1 },
    { field_name: '施工监理姓名', type: 1 },
  ];

  for (const field of newFields) {
    if (!existingFieldNames.includes(field.field_name)) {
      console.log(`Creating field: ${field.field_name}`);
      await createField(projectTableId, field);
    } else {
      console.log(`Field already exists: ${field.field_name}`);
    }
  }

  console.log('\n===== Done! =====');
  console.log('All tables cleared and new fields added.');
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
