// utils/api.js - API请求封装
const config = require('./config.js');

const app = getApp();

// 通用GET请求
function get(path, params = {}) {
  const app = getApp();
  // 自动附加认证信息
  if (app.globalData.staffId) {
    params.staffId = app.globalData.staffId;
  }
  if (app.globalData.password) {
    params.password = app.globalData.password;
  }

  const query = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const url = `${config.apiBase}${path}${query ? '?' + query : ''}`;
  console.log('[GET]', url);

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      header: { 'Content-Type': 'application/json' },
      success(res) {
        if (res.statusCode === 200 && res.data) {
          resolve(res.data);
        } else {
          reject(new Error(res.data?.error || `HTTP ${res.statusCode}`));
        }
      },
      fail(err) {
        console.error('[GET ERROR]', err);
        reject(new Error('网络连接失败'));
      }
    });
  });
}

// 通用POST请求（JSON）
function post(path, data = {}) {
  const url = `${config.apiBase}${path}`;
  console.log('[POST]', url, data);

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data,
      success(res) {
        if (res.statusCode === 200 && res.data) {
          resolve(res.data);
        } else {
          reject(new Error(res.data?.error || `HTTP ${res.statusCode}`));
        }
      },
      fail(err) {
        console.error('[POST ERROR]', err);
        reject(new Error('网络连接失败'));
      }
    });
  });
}

// 文件上传（multipart/form-data）
function uploadFile(path, filePath, formData = {}, onProgress) {
  const app = getApp();
  if (app.globalData.staffId) formData.staffId = app.globalData.staffId;
  if (app.globalData.password) formData.password = app.globalData.password;

  const url = `${config.apiBase}${path}`;
  console.log('[UPLOAD]', url);

  return new Promise((resolve, reject) => {
    const task = wx.uploadFile({
      url,
      filePath,
      name: 'file',
      header: { 'Content-Type': 'multipart/form-data' },
      formData,
      success(res) {
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(res.data);
            resolve(data);
          } catch (e) {
            resolve(res.data);
          }
        } else {
          reject(new Error(`上传失败 HTTP ${res.statusCode}`));
        }
      },
      fail(err) {
        console.error('[UPLOAD ERROR]', err);
        reject(new Error('上传失败'));
      }
    });

    if (onProgress && task) {
      task.onProgressUpdate(res => {
        onProgress(res.progress);
      });
    }
  });
}

// 批量上传文件
async function uploadFiles(path, filePaths, formData = {}, onProgress) {
  const results = [];
  for (let i = 0; i < filePaths.length; i++) {
    if (onProgress) onProgress(i, filePaths.length, 0);
    try {
      const res = await uploadFile(path, filePaths[i], formData, (p) => {
        if (onProgress) onProgress(i, filePaths.length, p);
      });
      results.push({ success: true, data: res });
    } catch (err) {
      results.push({ success: false, error: err.message });
    }
  }
  return results;
}

// 下载文件
function downloadFile(fileUrl) {
  const url = fileUrl.startsWith('http') ? fileUrl : `${config.apiBase}${fileUrl}`;
  console.log('[DOWNLOAD]', url);
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success(res) {
        if (res.statusCode === 200) {
          resolve(res.tempFilePath);
        } else {
          reject(new Error('下载失败'));
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

// 预览文件（图片/PDF等）
async function previewFile(fileUrl, fileType) {
  try {
    // 图片直接预览
    if (fileType === 'image' || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileUrl)) {
      const urls = [fileUrl.startsWith('http') ? fileUrl : `${config.apiBase}${fileUrl}`];
      wx.previewImage({ urls });
      return;
    }

    // 其他文件先下载再预览
    wx.showLoading({ title: '加载中...' });
    const tempPath = await downloadFile(fileUrl);
    wx.hideLoading();

    // 根据文件类型预览
    let type = 'pdf';
    if (/\.(doc|docx)$/i.test(fileUrl)) type = 'doc';
    else if (/\.(xls|xlsx)$/i.test(fileUrl)) type = 'xls';
    else if (/\.(ppt|pptx)$/i.test(fileUrl)) type = 'ppt';
    else if (/\.(mp4|mov)$/i.test(fileUrl)) {
      // 视频用video组件播放
      const pages = getCurrentPages();
      const page = pages[pages.length - 1];
      if (page.setData) {
        page.setData({ videoUrl: fileUrl.startsWith('http') ? fileUrl : `${config.apiBase}${fileUrl}`, showVideo: true });
      }
      return;
    }

    wx.openDocument({
      filePath: tempPath,
      fileType: type,
      showMenu: true,
      success() {},
      fail(err) {
        wx.showToast({ title: '无法预览此文件', icon: 'none' });
      }
    });
  } catch (err) {
    wx.hideLoading();
    wx.showToast({ title: '加载失败: ' + err.message, icon: 'none' });
  }
}

module.exports = {
  get,
  post,
  uploadFile,
  uploadFiles,
  downloadFile,
  previewFile,
  config
};
