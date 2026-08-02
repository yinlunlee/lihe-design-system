/**
 * Feishu API client - handles authentication and API calls
 */
const https = require('https');

const APP_ID = process.env.FEISHU_APP_ID || 'cli_aae7cda72cb8dbc0';
const APP_SECRET = process.env.FEISHU_APP_SECRET || 'A1oaS8xoN0EMkDIm8HOmFdcwPgWkd21h';

let cachedToken = null;
let tokenExpiry = 0;

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ code: -1, msg: 'JSON parse error', raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function getToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 300000) {
    return cachedToken;
  }

  const result = await request({
    hostname: 'open.feishu.cn',
    path: '/open-apis/auth/v3/tenant_access_token/internal',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { app_id: APP_ID, app_secret: APP_SECRET });

  if (result.code !== 0) {
    throw new Error(`Failed to get token: ${result.msg}`);
  }

  cachedToken = result.tenant_access_token;
  tokenExpiry = now + result.expire * 1000;
  return cachedToken;
}

async function feishuRequest(method, path, body) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  return request({
    hostname: 'open.feishu.cn',
    path: path,
    method: method,
    headers: headers
  }, body);
}

module.exports = { getToken, feishuRequest, request };
