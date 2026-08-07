/**
 * Add new fields to the needs table in Feishu Bitable
 * Fields: 空间大类, 风格偏好, 商业类型, 经营内容, 特殊行业功能, 电器喜好
 */
const https = require('https');

const config = {
  appId: 'cli_aae7cda72cb8dbc0',
  appSecret: 'A1oaS8xoN0EMkDIm8HOmFdcwPgWkd21h',
  appToken: 'VdwxbP1vwa2XjZs2jLmcNBGKnMe',
  needsTable: 'tblB46Y4pvnoSWJA',
};

function getToken() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ app_id: config.appId, app_secret: config.appSecret });
    const req = https.request({
      hostname: 'open.feishu.cn',
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d).tenant_access_token));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function createField(token, fieldDef) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(fieldDef);
    const req = https.request({
      hostname: 'open.feishu.cn',
      path: `/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.needsTable}/fields`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const token = await getToken();
  console.log('Token acquired');

  const newFields = [
    { field_name: '空间大类', type: 1 },  // text
    { field_name: '风格偏好', type: 1 },  // text
    { field_name: '商业类型', type: 1 },  // text
    { field_name: '经营内容', type: 1 },  // text
    { field_name: '特殊行业功能', type: 1 },  // text
    { field_name: '电器喜好', type: 1 },  // text
  ];

  for (const field of newFields) {
    const result = await createField(token, field);
    if (result.code === 0) {
      console.log(`✓ Created: ${field.field_name}`);
    } else {
      console.log(`✗ ${field.field_name}: ${result.msg} (code: ${result.code})`);
    }
  }
  console.log('Done');
}

main().catch(console.error);
