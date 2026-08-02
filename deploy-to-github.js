/**
 * GitHub 仓库创建 + 代码推送脚本
 * 用法: node deploy-to-github.js <github_username> <github_token>
 */
const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

const REPO_NAME = 'lihe-design-system';
const username = process.argv[2];
const token = process.argv[3];

if (!username || !token) {
  console.error('Usage: node deploy-to-github.js <github_username> <github_token>');
  process.exit(1);
}

function ghRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'lihe-deploy-script',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
      }
    }, (res) => {
      let respData = '';
      res.on('data', c => respData += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(respData) }); }
        catch(e) { resolve({ status: res.statusCode, data: respData }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log(`\n========================================`);
  console.log(`  GitHub 自动部署脚本`);
  console.log(`  用户: ${username}`);
  console.log(`========================================\n`);

  // Step 1: Create repo
  console.log('Step 1: Creating GitHub repository...');
  const createResult = await ghRequest('POST', '/user/repos', {
    name: REPO_NAME,
    description: '立和设计自动化运营管理系统 - H5协同 + 飞书多维表格',
    private: false,
    auto_init: false,
  });

  if (createResult.status === 201) {
    console.log(`  ✅ Repository created: ${createResult.data.html_url}`);
  } else if (createResult.status === 422 && (createResult.data.message || '').includes('already exists')) {
    console.log(`  ℹ️ Repository already exists, will push to it`);
  } else {
    console.error(`  ❌ Failed to create repo:`, createResult.data);
    process.exit(1);
  }

  // Step 2: Configure git remote and push
  console.log('\nStep 2: Pushing code to GitHub...');
  const remoteUrl = `https://${username}:${token}@github.com/${username}/${REPO_NAME}.git`;

  try {
    execSync(`git remote remove origin`, { stdio: 'pipe' });
  } catch(e) { /* no existing remote */ }

  execSync(`git remote add origin "${remoteUrl}"`, { stdio: 'inherit' });
  execSync(`git branch -M main`, { stdio: 'pipe' });

  try {
    execSync(`git push -u origin main`, { stdio: 'inherit' });
    console.log(`\n  ✅ Code pushed successfully!`);
  } catch(e) {
    // Try force push if needed
    console.log('  Retrying with force push...');
    execSync(`git push -u origin main --force`, { stdio: 'inherit' });
    console.log(`\n  ✅ Code pushed successfully (force)!`);
  }

  // Step 3: Output repo URL
  const repoUrl = `https://github.com/${username}/${REPO_NAME}`;
  console.log(`\n========================================`);
  console.log(`  ✅ 部署完成!`);
  console.log(`  GitHub 仓库: ${repoUrl}`);
  console.log(`========================================`);
  console.log(`\n接下来在 Render 上部署:`);
  console.log(`  1. 打开 https://render.com → Sign up → 用 GitHub 登录`);
  console.log(`  2. New + → Blueprint`);
  console.log(`  3. 选择 ${username}/${REPO_NAME} 仓库`);
  console.log(`  4. render.yaml 会自动配置所有内容`);
  console.log(`  5. 点击 Apply → 等待部署完成`);
  console.log(`\n  或使用 Render API:`);
  console.log(`  https://render.com/oauth/github/login\n`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
