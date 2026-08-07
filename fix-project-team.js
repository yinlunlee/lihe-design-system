/**
 * 一次性修复脚本：同步需求表团队分配到项目表
 * 用法: node fix-project-team.js
 */
const { feishuRequest } = require('./lib/feishu.js');
const config = require('./lib/config.js');

function parseFieldValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return val;
  if (Array.isArray(val)) {
    return val.map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.text || item.name || '';
      return String(item);
    }).join('');
  }
  if (typeof val === 'object' && val.text) return val.text;
  if (typeof val === 'object' && val.name) return val.name;
  return String(val);
}

async function main() {
  console.log('=== 修复项目团队分配 ===\n');

  // 1. 获取所有已签约需求
  const needsResult = await feishuRequest('POST',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.needs}/records/search`,
    { filter: { conjunction: 'and', conditions: [{ field_name: '跟进状态', operator: 'is', value: ['已签约'] }] } }
  );

  if (needsResult.code !== 0) {
    console.error('获取需求失败:', needsResult.msg);
    return;
  }

  const needs = needsResult.data.items || [];
  console.log(`找到 ${needs.length} 条已签约需求`);

  for (const need of needs) {
    const f = need.fields;
    const clientName = parseFieldValue(f['客户姓名']);
    const clientPhone = parseFieldValue(f['联系方式']);
    const designerId = parseFieldValue(f['设计师工号']);
    const designerName = parseFieldValue(f['设计师姓名']);
    const softDecoId = parseFieldValue(f['软装设计师工号']);
    const softDecoName = parseFieldValue(f['软装设计师姓名']);
    const drawingId = parseFieldValue(f['施工图设计师工号']);
    const drawingName = parseFieldValue(f['施工图设计师姓名']);

    console.log(`\n处理: ${clientName} (${clientPhone})`);
    console.log(`  需求表团队: 设计师=${designerId}/${designerName}, 软装=${softDecoId}/${softDecoName}, 施工图=${drawingId}/${drawingName}`);

    if (!clientPhone) {
      console.log('  跳过: 无联系方式');
      continue;
    }

    // 2. 查找对应项目
    const projResult = await feishuRequest('POST',
      `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.project}/records/search`,
      { filter: { conjunction: 'and', conditions: [{ field_name: '客户联系方式', operator: 'is', value: [clientPhone] }] } }
    );

    if (projResult.code !== 0 || !projResult.data.items || projResult.data.items.length === 0) {
      console.log('  跳过: 项目不存在');
      continue;
    }

    const project = projResult.data.items[0];
    const projectId = project.record_id;
    const pf = project.fields;
    const projDesignerId = parseFieldValue(pf['设计师工号']);
    const projStage = parseFieldValue(pf['当前阶段']);
    const projProgress = typeof pf['阶段进度'] === 'number' ? pf['阶段进度'] : 0;

    console.log(`  项目表当前: 设计师=${projDesignerId}, 阶段=${projStage}, 进度=${projProgress}%`);

    // 3. 构建更新字段
    const updateFields = {};

    // 同步团队
    if (designerId && designerId !== projDesignerId) {
      updateFields['设计师工号'] = designerId;
      updateFields['设计师姓名'] = designerName;
    }
    if (softDecoId) {
      updateFields['软装设计师工号'] = softDecoId;
      updateFields['软装设计师姓名'] = softDecoName;
    }
    if (drawingId) {
      updateFields['施工图设计师工号'] = drawingId;
      updateFields['施工图设计师姓名'] = drawingName;
    }

    // 修正阶段（"设计准备" → "平面布局方案"）
    if (projStage === '设计准备' || !projStage) {
      updateFields['当前阶段'] = '平面布局方案';
    }

    // 修正进度
    if (projProgress === 0) {
      updateFields['阶段进度'] = 5;
    }

    if (Object.keys(updateFields).length === 0) {
      console.log('  无需更新');
      continue;
    }

    console.log('  更新字段:', JSON.stringify(updateFields));

    // 4. 更新项目
    const updateResult = await feishuRequest('PUT',
      `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.project}/records/${projectId}`,
      { fields: updateFields }
    );

    if (updateResult.code === 0) {
      console.log('  ✓ 项目已更新');
    } else {
      console.log('  ✗ 更新失败:', updateResult.msg);
    }
  }

  console.log('\n=== 修复完成 ===');
}

main().catch(console.error);
