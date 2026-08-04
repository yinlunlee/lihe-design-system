/**
 * 立和设计 H5协同系统后端服务器
 * Connects H5 frontend with Feishu Bitable
 *
 * Endpoints:
 *   POST /api/needs     - Submit client needs form
 *   GET  /api/project   - Query projects by phone or staffId
 *   GET  /api/nodes     - Get confirmation nodes for a project
 *   POST /api/upload    - Staff upload files to a project node
 *   POST /api/confirm   - Client confirm or submit revision
 *   Static files: needs.html, client.html, staff.html
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { feishuRequest, getToken } = require('./lib/feishu.js');
const config = require('./lib/config.js');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipart(buffer, boundary) {
  const parts = {};
  const files = [];
  const boundaryBuffer = Buffer.from('--' + boundary);

  let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length;

  while (start < buffer.length) {
    // Find next boundary
    let end = buffer.indexOf(boundaryBuffer, start);
    if (end === -1) break;

    const partBuffer = buffer.slice(start, end - 2); // -2 for \r\n before boundary

    // Parse headers
    const headerEnd = partBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      start = end + boundaryBuffer.length;
      continue;
    }

    const headerStr = partBuffer.slice(0, headerEnd).toString('utf-8');
    const bodyBuffer = partBuffer.slice(headerEnd + 4);

    // Extract field name and filename
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const fileMatch = headerStr.match(/filename="([^"]+)"/);

    if (nameMatch) {
      const fieldName = nameMatch[1];
      if (fileMatch) {
        // It's a file
        const fileName = fileMatch[1];
        const typeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/);
        files.push({
          fieldname: fieldName,
          originalname: fileName,
          mimetype: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
          buffer: bodyBuffer,
          size: bodyBuffer.length,
        });
      } else {
        // It's a text field
        parts[fieldName] = bodyBuffer.toString('utf-8');
      }
    }

    start = end + boundaryBuffer.length;
  }

  return { fields: parts, files };
}

async function uploadToFeishu(file, appToken) {
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

  // Build multipart form data manually
  const parts = [];

  // file_name
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file_name"\r\n\r\n${file.originalname}\r\n`));
  // parent_type
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="parent_type"\r\n\r\nbitable_file\r\n`));
  // parent_node
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="parent_node"\r\n\r\n${appToken}\r\n`));
  // size
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n${file.size}\r\n`));
  // file
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.originalname}"\r\nContent-Type: ${file.mimetype}\r\n\r\n`));
  parts.push(file.buffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const token = await getToken();
  const https = require('https');

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'open.feishu.cn',
      path: '/open-apis/drive/v1/medias/upload_all',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ code: -1, msg: 'parse error', raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ===== API Handlers =====

// Parse Feishu text field value (can be string, array of {text,type}, or number)
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

async function handleNeeds(req, res) {
  const body = await getBody(req);
  let data;
  try { data = JSON.parse(body.toString()); } catch { return sendJSON(res, 400, { success: false, error: 'Invalid JSON' }); }

  // Map H5 form fields to Feishu table fields
  const record = {
    fields: {
      '客户姓名': data.name || '',
      '联系方式': data.contact || '',
      '项目地址': data.address || '',
      '空间类型': data.spaceType || '',
      '面积': data.area ? parseFloat(data.area) : null,
      '每平米预算': data.budget || '',
      '预算弹性': data.budgetFlex || '',
      '喜欢的色系': data.colorSystem || '',
      '圈选色系': data.colorPick || '',
      '喜欢的明暗度': data.brightness || '',
      '不接受的色调': data.reject || '',
      '常住人口': data.residents || '',
      '核心功能区': data.rooms || '',
      '特殊需求': data.special || '',
      '收纳需求': data.storage || '',
      '材质偏好': data.material || '',
      '风水考量': data.fengshui || '',
      '工期期望': data.timeline || '',
      '其他说明': data.other || '',
      '跟进状态': '待联系',
      '提交时间': Date.now(),
    }
  };

  // Remove null/empty values
  Object.keys(record.fields).forEach(k => {
    if (record.fields[k] === null || record.fields[k] === '') delete record.fields[k];
  });

  const result = await feishuRequest('POST',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.needs}/records`,
    record
  );

  if (result.code === 0) {
    console.log(`[needs] New client needs submitted: ${data.name} - ${data.contact}`);
    sendJSON(res, 200, { success: true, recordId: result.data.record.record_id });
  } else {
    console.error('[needs] Error:', result.msg);
    sendJSON(res, 500, { success: false, error: result.msg });
  }
}

function mapProjectFields(item) {
  const f = item.fields;
  return {
    recordId: item.record_id,
    name: parseFieldValue(f['项目名称']) || '未命名',
    code: parseFieldValue(f['项目编号']),
    clientName: parseFieldValue(f['客户姓名']) || '',
    clientPhone: parseFieldValue(f['客户联系方式']) || '',
    spaceType: parseFieldValue(f['空间类型']),
    area: typeof f['面积'] === 'number' ? f['面积'] : 0,
    address: parseFieldValue(f['项目地址']),
    stage: parseFieldValue(f['当前阶段']),
    progress: typeof f['阶段进度'] === 'number' ? f['阶段进度'] : 0,
    budget: typeof f['合同金额'] === 'number' ? f['合同金额'] : 0,
    paidAmount: typeof f['已收款'] === 'number' ? f['已收款'] : 0,
    status: parseFieldValue(f['停工状态']) || '正常',
    // 多角色团队
    designerId: parseFieldValue(f['设计师工号']) || '',
    designerName: parseFieldValue(f['设计师姓名']) || '',
    softDecoId: parseFieldValue(f['软装设计师工号']) || '',
    softDecoName: parseFieldValue(f['软装设计师姓名']) || '',
    drawingId: parseFieldValue(f['施工图设计师工号']) || '',
    drawingName: parseFieldValue(f['施工图设计师姓名']) || '',
    supervisorId: parseFieldValue(f['施工监理工号']) || '',
    supervisorName: parseFieldValue(f['施工监理姓名']) || '',
    // 兼容旧字段
    staffId: parseFieldValue(f['负责人工号']) || '',
  };
}

async function handleBoss(req, res) {
  const parsed = url.parse(req.url, true);
  const { staffId, password } = parsed.query;

  // Boss auth - B01 account or any account with "boss" role
  if (!staffId || !config.staffAccounts[staffId] || config.staffAccounts[staffId] !== password) {
    return sendJSON(res, 401, { success: false, error: '认证失败' });
  }
  // Only B01 is boss account
  if (staffId !== 'B01') {
    return sendJSON(res, 403, { success: false, error: '无管理员权限' });
  }

  // Load ALL projects
  const projectResult = await feishuRequest('GET',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.project}/records?page_size=500`
  );
  let projects = [];
  if (projectResult.code === 0 && projectResult.data.items) {
    projects = projectResult.data.items.map(item => mapProjectFields(item));
  }

  // Load ALL confirm nodes (pending ones for alerts)
  const confirmResult = await feishuRequest('POST',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.confirm}/records/search?page_size=500`,
    { filter: { conjunction: 'and', conditions: [{ field_name: '客户确认状态', operator: 'is', value: ['待确认'] }] } }
  );
  let pendingNodes = [];
  if (confirmResult.code === 0 && confirmResult.data && confirmResult.data.items) {
    pendingNodes = confirmResult.data.items.map(item => mapNodeFields(item));
  }

  // Load ALL confirm nodes (for stats)
  const allConfirmResult = await feishuRequest('GET',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.confirm}/records?page_size=500`
  );
  let allNodes = [];
  if (allConfirmResult.code === 0 && allConfirmResult.data && allConfirmResult.data.items) {
    allNodes = allConfirmResult.data.items.map(item => mapNodeFields(item));
  }

  // Statistics
  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === '正常').length,
    pausedProjects: projects.filter(p => p.status !== '正常').length,
    pendingConfirmations: pendingNodes.length,
    totalBudget: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
    totalPaid: projects.reduce((sum, p) => sum + (p.paidAmount || 0), 0),
    // By stage group
    designCount: projects.filter(p => {
      const s = p.stage || '';
      return ['平面布局方案','效果图设计','物料整理','施工图设计','报价签合同'].includes(s);
    }).length,
    constructionCount: projects.filter(p => {
      const s = p.stage || '';
      return ['开工前期准备','拆除改造','水电隐蔽工程','防水工程','泥瓦工程','木工吊顶','油漆墙面','安装阶段','开荒保洁竣工验收'].includes(s);
    }).length,
    softDecoCount: projects.filter(p => {
      const s = p.stage || '';
      return s.startsWith('软装-');
    }).length,
    deliveredCount: projects.filter(p => p.stage === '竣工交付').length,
    // By staff
    byStaff: {},
    // Recent nodes (last 7 days)
    recentNodes: allNodes.filter(n => n.uploadTime && (Date.now() - n.uploadTime < 7 * 86400000)).length,
    // Confirmed nodes
    confirmedNodes: allNodes.filter(n => n.status === '已确认').length,
    // Revised nodes
    revisedNodes: allNodes.filter(n => n.status === '有修改意见').length,
  };

  // Group projects by staff across all 4 roles
  const allStaffIds = Object.keys(config.staffRoles).filter(id => id !== 'B01');
  allStaffIds.forEach(sid => {
    const staffProjects = projects.filter(p => {
      return p.designerId === sid || p.softDecoId === sid || p.drawingId === sid || p.supervisorId === sid || p.staffId === sid;
    });
    const staffPending = pendingNodes.filter(n => {
      return staffProjects.some(p => p.recordId === n.projectId);
    }).length;
    const staffInfo = config.staffRoles[sid] || { name: sid, label: '' };
    stats.byStaff[sid] = {
      name: staffInfo.name,
      role: staffInfo.label,
      count: staffProjects.length,
      avgProgress: staffProjects.length > 0
        ? Math.round(staffProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / staffProjects.length)
        : 0,
      budget: staffProjects.reduce((sum, p) => sum + (p.budget || 0), 0),
      pending: staffPending,
    };
  });

  return sendJSON(res, 200, { success: true, projects, pendingNodes, allNodes, stats });
}

async function handleProject(req, res) {
  const parsed = url.parse(req.url, true);
  const { phone, staffId, password } = parsed.query;

  // Staff query: load projects where staffId matches any of the 4 role fields
  if (staffId) {
    if (!config.staffAccounts[staffId] || config.staffAccounts[staffId] !== password) {
      return sendJSON(res, 401, { success: false, error: 'Auth failed' });
    }

    // Search projects where ANY of the 4 role fields = staffId (OR conjunction)
    const searchResult = await feishuRequest('POST',
      `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.project}/records/search?page_size=500`,
      {
        filter: {
          conjunction: 'or',
          conditions: [
            { field_name: '设计师工号', operator: 'is', value: [staffId] },
            { field_name: '软装设计师工号', operator: 'is', value: [staffId] },
            { field_name: '施工图设计师工号', operator: 'is', value: [staffId] },
            { field_name: '施工监理工号', operator: 'is', value: [staffId] },
            { field_name: '负责人工号', operator: 'is', value: [staffId] },
          ]
        }
      }
    );

    let projects = [];
    if (searchResult.code === 0 && searchResult.data.items) {
      projects = searchResult.data.items.map(item => mapProjectFields(item));
    }

    return sendJSON(res, 200, {
      success: true,
      projects,
      staffId,
      staffName: config.staffRoles[staffId] ? config.staffRoles[staffId].name : '',
      staffRole: config.staffRoles[staffId] ? config.staffRoles[staffId].label : '',
    });
  }

  // Client query: find by phone
  if (phone) {
    // Search in client needs table first to get client name
    const needsResult = await feishuRequest('POST',
      `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.needs}/records/search`,
      { filter: { conjunction: 'and', conditions: [{ field_name: '联系方式', operator: 'is', value: [phone] }] } }
    );

    let clientName = '';
    if (needsResult.code === 0 && needsResult.data.items && needsResult.data.items.length > 0) {
      clientName = parseFieldValue(needsResult.data.items[0].fields['客户姓名']);
    }

    // Search in project table by client phone
    const searchResult = await feishuRequest('POST',
      `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.project}/records/search`,
      { filter: { conjunction: 'and', conditions: [{ field_name: '客户联系方式', operator: 'is', value: [phone] }] } }
    );

    if (searchResult.code === 0) {
      const projects = (searchResult.data.items || []).map(item => mapProjectFields(item));

      // If no project found but needs exist, create a virtual project from needs
      if (projects.length === 0 && clientName) {
        const needItem = needsResult.data.items[0].fields;
        projects.push({
          recordId: needsResult.data.items[0].record_id,
          name: `${clientName}的装修项目`,
          code: '待创建',
          clientName,
          clientPhone: phone,
          spaceType: parseFieldValue(needItem['空间类型']),
          area: typeof needItem['面积'] === 'number' ? needItem['面积'] : 0,
          address: parseFieldValue(needItem['项目地址']),
          stage: '需求解析',
          progress: 5,
          status: '正常',
          staffId: '',
        });
      }

      return sendJSON(res, 200, { success: true, projects, clientName });
    } else {
      return sendJSON(res, 500, { success: false, error: searchResult.msg });
    }
  }

  sendJSON(res, 400, { success: false, error: 'Missing phone or staffId' });
}

// 解析飞书附件字段
function parseAttachments(attachField) {
  if (!attachField || !Array.isArray(attachField)) return [];
  return attachField.map(att => ({
    name: att.name || att.file_name || '附件',
    token: att.file_token || att.token || '',
    type: att.type || att.mime_type || '',
    size: att.size || 0,
    url: `/api/file/${att.file_token || att.token || ''}`,
  }));
}

// 文件代理：从飞书下载附件并流式转发给客户端
async function handleFileProxy(req, res) {
  const parsed = url.parse(req.url);
  const parts = parsed.pathname.split('/');
  const fileToken = parts[parts.length - 1];

  if (!fileToken || fileToken === 'file') {
    return sendJSON(res, 400, { error: 'Missing file token' });
  }

  try {
    const token = await getToken();
    const https = require('https');

    https.get({
      hostname: 'open.feishu.cn',
      path: `/open-apis/drive/v1/medias/${fileToken}/download`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }, (proxyRes) => {
      if (proxyRes.statusCode !== 200) {
        return sendJSON(res, proxyRes.statusCode, { error: `Feishu returned ${proxyRes.statusCode}` });
      }
      const ct = proxyRes.headers['content-type'] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      proxyRes.pipe(res);
    }).on('error', (err) => {
      sendJSON(res, 500, { error: err.message });
    });
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

function mapNodeFields(item) {
  const f = item.fields;
  return {
    recordId: item.record_id,
    projectId: parseFieldValue(f['关联项目']),
    stage: parseFieldValue(f['节点阶段']),
    nodeName: parseFieldValue(f['节点名称']),
    status: parseFieldValue(f['客户确认状态']) || '待确认',
    description: parseFieldValue(f['上传描述']),
    uploadTime: f['上传时间'] ? Number(f['上传时间']) : null,
    uploader: parseFieldValue(f['员工工号']),
    clientNotes: parseFieldValue(f['客户修改意见']),
    attachments: parseAttachments(f['成果附件']),
  };
}

async function handleNodes(req, res) {
  const parsed = url.parse(req.url, true);
  const { phone, projectId, staffId, password } = parsed.query;

  // Staff query: by projectId
  if (projectId && staffId) {
    if (!config.staffAccounts[staffId] || config.staffAccounts[staffId] !== password) {
      return sendJSON(res, 401, { success: false, error: 'Auth failed' });
    }
    const result = await feishuRequest('POST',
      `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.confirm}/records/search`,
      { filter: { conjunction: 'and', conditions: [{ field_name: '关联项目', operator: 'is', value: [projectId] }] } }
    );
    const nodes = (result.code === 0 && result.data.items) ? result.data.items.map(item => mapNodeFields(item)) : [];
    nodes.sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0));
    return sendJSON(res, 200, { success: true, nodes });
  }

  // Client query: by phone
  if (!phone) {
    return sendJSON(res, 400, { success: false, error: 'Missing phone or projectId' });
  }

  // Get all confirm nodes for this client's phone
  const result = await feishuRequest('POST',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.confirm}/records/search`,
    { filter: { conjunction: 'and', conditions: [{ field_name: '客户手机', operator: 'is', value: [phone] }] } }
  );

  if (result.code === 0) {
    const nodes = (result.data.items || []).map(item => mapNodeFields(item));

    // Sort by upload time
    nodes.sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0));

    sendJSON(res, 200, { success: true, nodes });
  } else {
    sendJSON(res, 200, { success: true, nodes: [] });
  }
}

async function handleUpload(req, res) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    return sendJSON(res, 400, { success: false, error: 'No boundary' });
  }

  const body = await getBody(req);
  const { fields, files } = parseMultipart(body, boundaryMatch[1]);

  const staffId = fields.staffId;
  const password = fields.password;
  const projectId = fields.projectId;
  const stage = fields.stage;
  const nodeName = fields.nodeName || stage;
  const description = fields.description || '';

  // Verify staff
  if (!config.staffAccounts[staffId] || config.staffAccounts[staffId] !== password) {
    return sendJSON(res, 401, { success: false, error: 'Auth failed' });
  }

  if (!projectId || !stage || files.length === 0) {
    return sendJSON(res, 400, { success: false, error: 'Missing required fields' });
  }

  // Get project info to get client phone
  const projectResult = await feishuRequest('GET',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.project}/records/${projectId}`
  );

  let clientPhone = '';
  let projectName = '';
  if (projectResult.code === 0) {
    clientPhone = parseFieldValue(projectResult.data.record.fields['客户联系方式']);
    projectName = parseFieldValue(projectResult.data.record.fields['项目名称']);
  }

  // Upload files to Feishu
  const uploadedFiles = [];
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) {
      console.warn(`[upload] File too large: ${file.originalname} (${file.size} bytes)`);
      continue;
    }

    const uploadResult = await uploadToFeishu(file, config.feishu.appToken);
    if (uploadResult.code === 0) {
      uploadedFiles.push({
        name: file.originalname,
        token: uploadResult.data.file_token,
        type: file.mimetype,
      });
      console.log(`[upload] File uploaded: ${file.originalname} -> ${uploadResult.data.file_token}`);
    } else {
      console.error(`[upload] Upload failed for ${file.originalname}:`, uploadResult.msg);
    }
  }

  // Create confirm node record
  const now = Date.now();
  const record = {
    fields: {
      '关联项目': projectId,
      '项目名称': projectName,
      '客户手机': clientPhone,
      '节点阶段': stage,
      '节点名称': nodeName,
      '客户确认状态': '待确认',
      '员工工号': staffId,
      '上传时间': now,
      '上传描述': description,
    }
  };

  // Add file tokens as attachment
  if (uploadedFiles.length > 0) {
    record.fields['成果附件'] = uploadedFiles.map(f => ({ file_token: f.token }));
  }

  const createResult = await feishuRequest('POST',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.confirm}/records`,
    record
  );

  if (createResult.code === 0) {
    console.log(`[upload] Node created: ${nodeName} for ${projectName}`);
    sendJSON(res, 200, {
      success: true,
      recordId: createResult.data.record.record_id,
      uploadedCount: uploadedFiles.length,
    });
  } else {
    console.error('[upload] Create record failed:', createResult.msg);
    sendJSON(res, 500, { success: false, error: createResult.msg });
  }
}

async function handleConfirm(req, res) {
  const body = await getBody(req);
  let data;
  try { data = JSON.parse(body.toString()); } catch { return sendJSON(res, 400, { success: false, error: 'Invalid JSON' }); }

  const { recordId, action, clientNotes } = data;

  if (!recordId || !action) {
    return sendJSON(res, 400, { success: false, error: 'Missing recordId or action' });
  }

  // 1. 先获取确认节点记录，拿到阶段和关联项目
  const nodeResult = await feishuRequest('GET',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.confirm}/records/${recordId}`
  );

  let stage = '';
  let projectId = '';
  if (nodeResult.code === 0 && nodeResult.data && nodeResult.data.record) {
    const f = nodeResult.data.record.fields;
    stage = parseFieldValue(f['节点阶段']);
    projectId = parseFieldValue(f['关联项目']);
  }

  // 2. 更新确认状态
  const updateData = {
    fields: {
      '客户确认状态': action === 'confirm' ? '已确认' : '有修改意见',
      '客户确认时间': Date.now(),
    }
  };

  if (action === 'revise' && clientNotes) {
    updateData.fields['客户修改意见'] = clientNotes;
  }

  const result = await feishuRequest('PUT',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.confirm}/records/${recordId}`,
    updateData
  );

  if (result.code !== 0) {
    console.error('[confirm] Error:', result.msg);
    return sendJSON(res, 500, { success: false, error: result.msg });
  }

  console.log(`[confirm] Record ${recordId}: ${action === 'confirm' ? 'confirmed' : 'revision requested'}`);

  // 3. 如果是确认通过，自动推进项目阶段
  let advanceInfo = null;
  if (action === 'confirm' && stage && projectId) {
    const flow = config.stageFlow[stage];
    if (flow && flow.next) {
      const projectUpdate = { fields: { '当前阶段': flow.next } };
      if (flow.progress !== null) {
        projectUpdate.fields['阶段进度'] = flow.progress;
      }

      const advResult = await feishuRequest('PUT',
        `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.project}/records/${projectId}`,
        projectUpdate
      );

      if (advResult.code === 0) {
        advanceInfo = { from: stage, to: flow.next, progress: flow.progress };
        console.log(`[confirm] Project ${projectId} advanced: ${stage} -> ${flow.next}`);
      } else {
        console.error('[confirm] Failed to advance project:', advResult.msg);
      }
    }
  }

  sendJSON(res, 200, {
    success: true,
    message: action === 'confirm' ? '已确认，感谢您的反馈' : '修改意见已提交，我们会尽快处理',
    advanceInfo,
  });
}

// ===== Sync: 已签约需求 → 自动创建项目记录 =====

async function syncNeedToProject(needRecordId) {
  // 1. 获取需求表记录详情
  const needResult = await feishuRequest('GET',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.needs}/records/${needRecordId}`
  );

  if (needResult.code !== 0 || !needResult.data || !needResult.data.record) {
    console.error('[sync] Failed to get need record:', needResult.msg);
    return { success: false, error: '无法获取需求记录' };
  }

  const f = needResult.data.record.fields;
  const status = parseFieldValue(f['跟进状态']);
  const clientPhone = parseFieldValue(f['联系方式']);

  // 2. 确认状态是"已签约"
  if (status !== '已签约') {
    return { success: false, error: `状态不是"已签约"(当前: ${status})` };
  }

  // 3. 检查项目管理表是否已有该客户的项目（按手机号查重）
  if (clientPhone) {
    const existResult = await feishuRequest('POST',
      `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.project}/records/search`,
      { filter: { conjunction: 'and', conditions: [{ field_name: '客户联系方式', operator: 'is', value: [clientPhone] }] } }
    );

    if (existResult.code === 0 && existResult.data.items && existResult.data.items.length > 0) {
      console.log(`[sync] Project already exists for phone ${clientPhone}, skip`);
      return { success: true, skipped: true, message: '该项目已存在，跳过创建', recordId: existResult.data.items[0].record_id };
    }
  }

  // 4. 从需求记录映射到项目记录字段
  const clientName = parseFieldValue(f['客户姓名']);
  const projectRecord = {
    fields: {
      '项目名称': `${clientName}的装修项目`,
      '客户姓名': clientName,
      '客户联系方式': clientPhone,
      '项目地址': parseFieldValue(f['项目地址']),
      '空间类型': parseFieldValue(f['空间类型']),
      '面积': typeof f['面积'] === 'number' ? f['面积'] : (f['面积'] ? parseFloat(parseFieldValue(f['面积'])) : null),
      '每平米预算': parseFieldValue(f['每平米预算']),
      '当前阶段': '设计准备',
      '阶段进度': 10,
      '停工状态': '正常',
    }
  };

  // 移除空值
  Object.keys(projectRecord.fields).forEach(k => {
    if (projectRecord.fields[k] === null || projectRecord.fields[k] === '') delete projectRecord.fields[k];
  });

  // 5. 在项目管理表创建记录
  const createResult = await feishuRequest('POST',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.project}/records`,
    projectRecord
  );

  if (createResult.code === 0) {
    console.log(`[sync] Project created for ${clientName} (${clientPhone}), recordId: ${createResult.data.record.record_id}`);
    return {
      success: true,
      created: true,
      recordId: createResult.data.record.record_id,
      message: `已为${clientName}创建项目记录`
    };
  } else {
    console.error('[sync] Failed to create project:', createResult.msg);
    return { success: false, error: createResult.msg };
  }
}

// 获取客户需求列表（含跟进状态）
async function handleNeedsList(req, res) {
  const parsed = url.parse(req.url, true);
  const { staffId, password } = parsed.query;

  if (!staffId || !config.staffAccounts[staffId] || config.staffAccounts[staffId] !== password) {
    return sendJSON(res, 401, { success: false, error: '需要员工登录' });
  }

  const result = await feishuRequest('GET',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.needs}/records?page_size=100`
  );

  if (result.code !== 0) {
    return sendJSON(res, 500, { success: false, error: result.msg });
  }

  const items = (result.data.items || []).map(item => {
    const f = item.fields;
    return {
      recordId: item.record_id,
      name: parseFieldValue(f['客户姓名']),
      contact: parseFieldValue(f['联系方式']),
      address: parseFieldValue(f['项目地址']),
      spaceType: parseFieldValue(f['空间类型']),
      area: parseFieldValue(f['面积']),
      budget: parseFieldValue(f['每平米预算']),
      timeline: parseFieldValue(f['工期期望']),
      status: parseFieldValue(f['跟进状态']) || '待联系',
      createdAt: item.created_time || '',
    };
  });

  return sendJSON(res, 200, { success: true, total: items.length, items });
}

// 更新需求跟进状态
async function handleUpdateStatus(req, res) {
  const body = await getBody(req);
  let data;
  try { data = JSON.parse(body.toString()); } catch { return sendJSON(res, 400, { success: false, error: 'Invalid JSON' }); }

  const { staffId, password, recordId, status } = data;

  if (!staffId || !config.staffAccounts[staffId] || config.staffAccounts[staffId] !== password) {
    return sendJSON(res, 401, { success: false, error: '需要员工登录' });
  }

  if (!recordId || !status) {
    return sendJSON(res, 400, { success: false, error: '缺少 recordId 或 status' });
  }

  const validStatuses = ['待联系', '已联系', '方案设计中', '已签约', '已搁置', '已流失'];
  if (!validStatuses.includes(status)) {
    return sendJSON(res, 400, { success: false, error: '无效的状态值' });
  }

  const updateResult = await feishuRequest('PUT',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.needs}/records/${recordId}`,
    { fields: { '跟进状态': status } }
  );

  if (updateResult.code !== 0) {
    return sendJSON(res, 500, { success: false, error: updateResult.msg });
  }

  let syncResult = null;
  if (status === '已签约') {
    try {
      syncResult = await syncNeedToProject(recordId);
    } catch (e) {
      syncResult = { success: false, error: e.message };
    }
  }

  return sendJSON(res, 200, {
    success: true,
    recordId,
    status,
    syncResult,
  });
}

// 手动触发同步所有"已签约"需求
async function handleSyncSigned(req, res) {
  const parsed = url.parse(req.url, true);
  const { staffId, password } = parsed.query;

  // 需要员工权限
  if (!staffId || !config.staffAccounts[staffId] || config.staffAccounts[staffId] !== password) {
    return sendJSON(res, 401, { success: false, error: '需要员工登录' });
  }

  // 查询所有"已签约"的需求
  const result = await feishuRequest('POST',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.needs}/records/search`,
    { filter: { conjunction: 'and', conditions: [{ field_name: '跟进状态', operator: 'is', value: ['已签约'] }] } }
  );

  if (result.code !== 0) {
    return sendJSON(res, 500, { success: false, error: result.msg });
  }

  const needs = result.data.items || [];
  const results = [];

  for (const item of needs) {
    const r = await syncNeedToProject(item.record_id);
    results.push({
      recordId: item.record_id,
      clientName: parseFieldValue(item.fields['客户姓名']),
      ...r,
    });
  }

  const created = results.filter(r => r.created).length;
  const skipped = results.filter(r => r.skipped).length;

  sendJSON(res, 200, {
    success: true,
    total: needs.length,
    created,
    skipped,
    results,
  });
}

// ===== 巡检记录 API =====

// 获取项目巡检记录列表
async function handleInspectionList(req, res) {
  const parsed = url.parse(req.url, true);
  const { staffId, password, projectId } = parsed.query;

  if (!staffId || !config.staffAccounts[staffId] || config.staffAccounts[staffId] !== password) {
    return sendJSON(res, 401, { success: false, error: '需要员工登录' });
  }

  if (!projectId) {
    return sendJSON(res, 400, { success: false, error: '缺少 projectId' });
  }

  const result = await feishuRequest('POST',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.inspection}/records/search`,
    { filter: { conjunction: 'and', conditions: [{ field_name: '关联项目', operator: 'is', value: [projectId] }] } }
  );

  if (result.code !== 0) {
    return sendJSON(res, 500, { success: false, error: result.msg });
  }

  const items = (result.data.items || []).map(item => {
    const f = item.fields;
    return {
      recordId: item.record_id,
      projectId: parseFieldValue(f['关联项目']),
      stage: parseFieldValue(f['巡检阶段']),
      inspectDate: parseFieldValue(f['巡检日期']),
      inspector: parseFieldValue(f['巡检人']),
      notes: parseFieldValue(f['巡检备注']),
      issues: parseFieldValue(f['发现问题']),
      attachments: parseAttachments(f['巡检照片']),
      createdAt: item.created_time || '',
    };
  });

  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return sendJSON(res, 200, { success: true, total: items.length, items });
}

// 员工上传巡检记录
async function handleInspectionUpload(req, res) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    return sendJSON(res, 400, { success: false, error: 'No boundary' });
  }

  const body = await getBody(req);
  const { fields, files } = parseMultipart(body, boundaryMatch[1]);

  const staffId = fields.staffId;
  const password = fields.password;
  const projectId = fields.projectId;
  const stage = fields.stage || '';
  const rawDate = fields.inspectDate || new Date().toISOString().slice(0, 10);
  const inspectDate = new Date(rawDate).getTime() || Date.now();
  const notes = fields.notes || '';
  const issues = fields.issues || '';

  if (!config.staffAccounts[staffId] || config.staffAccounts[staffId] !== password) {
    return sendJSON(res, 401, { success: false, error: 'Auth failed' });
  }

  if (!projectId || files.length === 0) {
    return sendJSON(res, 400, { success: false, error: '缺少项目或文件' });
  }

  // 获取项目名称
  let projectName = '';
  const projectResult = await feishuRequest('GET',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.project}/records/${projectId}`
  );
  if (projectResult.code === 0) {
    projectName = parseFieldValue(projectResult.data.record.fields['项目名称']);
  }

  // 上传文件到飞书
  const uploadedFiles = [];
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) continue;
    const uploadResult = await uploadToFeishu(file, config.feishu.appToken);
    if (uploadResult.code === 0) {
      uploadedFiles.push({
        name: file.originalname,
        token: uploadResult.data.file_token,
        type: file.mimetype,
      });
    }
  }

  // 创建巡检记录
  const record = {
    fields: {
      '关联项目': projectId,
      '项目名称': projectName,
      '巡检阶段': stage,
      '巡检日期': inspectDate,
      '巡检人': staffId,
      '巡检备注': notes,
      '发现问题': issues,
    }
  };

  if (uploadedFiles.length > 0) {
    record.fields['巡检照片'] = uploadedFiles.map(f => ({ file_token: f.token }));
  }

  const createResult = await feishuRequest('POST',
    `/open-apis/bitable/v1/apps/${config.feishu.appToken}/tables/${config.tables.inspection}/records`,
    record
  );

  if (createResult.code === 0) {
    console.log(`[inspection] Record created for ${projectName}: ${stage}`);
    sendJSON(res, 200, {
      success: true,
      recordId: createResult.data.record.record_id,
      uploadedCount: uploadedFiles.length,
    });
  } else {
    console.error('[inspection] Create failed:', createResult.msg);
    sendJSON(res, 500, { success: false, error: createResult.msg });
  }
}

// 飞书事件订阅 Webhook
async function handleWebhook(req, res) {
  const body = await getBody(req);
  let data;
  try { data = JSON.parse(body.toString()); } catch { return sendJSON(res, 400, { error: 'Invalid JSON' }); }

  // 1. URL验证请求（飞书添加事件订阅时发送）
  if (data.type === 'url_verification' && data.challenge) {
    console.log('[webhook] URL verification challenge');
    return sendJSON(res, 200, { challenge: data.challenge });
  }

  // 2. 事件通知
  if (data.header && data.header.event_type) {
    const eventType = data.header.event_type;
    console.log(`[webhook] Event received: ${eventType}`);

    // 处理多维表格记录变更事件
    if (eventType === 'bitable.v1.record.changed' && data.event) {
      const evt = data.event;
      const appToken = evt.app_token || evt.app_id;
      const tableId = evt.table_id;
      const recordId = evt.record_id;
      const changeType = evt.change_type || evt.action;

      console.log(`[webhook] Bitable change: table=${tableId}, record=${recordId}, type=${changeType}`);

      // 只处理客户需求表的记录更新
      if (tableId === config.tables.needs && recordId) {
        try {
          const syncResult = await syncNeedToProject(recordId);
          console.log('[webhook] Sync result:', JSON.stringify(syncResult));
        } catch (e) {
          console.error('[webhook] Sync error:', e.message);
        }
      }
    }

    return sendJSON(res, 200, { code: 0 });
  }

  // 3. 未知请求
  sendJSON(res, 200, { code: 0 });
}

// ===== Static file server =====
function serveStatic(req, res) {
  let pathname = url.parse(req.url).pathname;
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const filePath = path.join(__dirname, 'public', pathname);
  const ext = path.extname(filePath);

  if (!MIME[ext] && ext !== '.html') {
    return sendJSON(res, 404, { error: 'Not found' });
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return sendJSON(res, 404, { error: 'File not found: ' + pathname });
    }
    const headers = { 'Content-Type': MIME[ext] || 'text/plain' };
    // Prevent browser caching of HTML/JS files to ensure latest code is served
    if (ext === '.html' || ext === '.js' || ext === '.css') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

// ===== Main server =====
const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;

  console.log(`${new Date().toLocaleTimeString()} ${req.method} ${pathname}`);

  try {
    if (pathname === '/api/needs' && req.method === 'POST') {
      return await handleNeeds(req, res);
    }
    if (pathname === '/api/boss' && req.method === 'GET') {
      return await handleBoss(req, res);
    }
    if (pathname === '/api/project' && req.method === 'GET') {
      return await handleProject(req, res);
    }
    if (pathname === '/api/nodes' && req.method === 'GET') {
      return await handleNodes(req, res);
    }
    if (pathname === '/api/upload' && req.method === 'POST') {
      return await handleUpload(req, res);
    }
    if (pathname === '/api/confirm' && req.method === 'POST') {
      return await handleConfirm(req, res);
    }
    if (pathname === '/api/sync-signed' && req.method === 'GET') {
      return await handleSyncSigned(req, res);
    }
    if (pathname === '/api/needs-list' && req.method === 'GET') {
      return await handleNeedsList(req, res);
    }
    if (pathname === '/api/update-status' && req.method === 'POST') {
      return await handleUpdateStatus(req, res);
    }
    if (pathname.startsWith('/api/file/') && req.method === 'GET') {
      return await handleFileProxy(req, res);
    }
    if (pathname === '/api/inspection' && req.method === 'GET') {
      return await handleInspectionList(req, res);
    }
    if (pathname === '/api/inspection' && req.method === 'POST') {
      return await handleInspectionUpload(req, res);
    }
    if (pathname === '/api/webhook' && (req.method === 'POST' || req.method === 'GET')) {
      return await handleWebhook(req, res);
    }

    // Static files
    return serveStatic(req, res);
  } catch (err) {
    console.error('Server error:', err);
    sendJSON(res, 500, { success: false, error: err.message });
  }
});

server.listen(config.port, () => {
  console.log(`\n========================================`);
  console.log(`  立和设计 H5协同系统后端已启动`);
  console.log(`  端口: ${config.port}`);
  console.log(`  飞书多维表格: ${config.feishu.appToken}`);
  console.log(`========================================`);
  console.log(`\n  访问地址:`);
  console.log(`  客户需求表: http://localhost:${config.port}/needs.html`);
  console.log(`  客户查看端: http://localhost:${config.port}/client.html`);
  console.log(`  员工上传端: http://localhost:${config.port}/staff.html`);
  console.log(`  老板管理台: http://localhost:${config.port}/boss.html`);
  console.log(`  管理后台: http://localhost:${config.port}/manage.html`);
  console.log(`\n  员工账号:`);
  Object.keys(config.staffAccounts).forEach(id => {
    console.log(`    ${id} / 密码: ${config.staffAccounts[id]}`);
  });
  console.log(`\n  按 Ctrl+C 停止服务\n`);
});
