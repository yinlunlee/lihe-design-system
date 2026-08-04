// pages/staff/upload/upload.js
const api = require('../../../utils/api.js');
const config = require('../../../utils/config.js');
const app = getApp();

Page({
  data: {
    projectId: '',
    projectName: '',
    stages: [],
    stageIndex: -1,
    stage: '',
    description: '',
    files: [],
    submitting: false,
    uploadProgress: ''
  },

  onLoad(opts) {
    this.setData({
      projectId: opts.projectId,
      projectName: decodeURIComponent(opts.name || ''),
      stages: config.allStages
    });
  },

  // 阶段选择
  onStageChange(e) {
    this.setData({ stageIndex: e.detail.value, stage: this.data.stages[e.detail.value] });
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value });
  },

  // 选择文件
  chooseFiles() {
    wx.chooseMessageFile({
      count: 10 - this.data.files.length,
      type: 'file',
      extension: config.fileExtensions,
      success: (res) => {
        const newFiles = res.tempFiles.map(f => ({
          path: f.path,
          name: f.name,
          size: f.size
        }));
        // 检查文件大小
        const oversized = newFiles.filter(f => f.size > config.maxFileSize);
        if (oversized.length > 0) {
          wx.showToast({ title: `文件 ${oversized[0].name} 超过50MB限制`, icon: 'none' });
          return;
        }
        this.setData({ files: [...this.data.files, ...newFiles] });
      }
    });
  },

  // 拍照
  takePhoto() {
    wx.chooseMedia({
      count: 9 - this.data.files.length,
      mediaType: ['image'],
      sourceType: ['camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const newFiles = res.tempFiles.map(f => ({
          path: f.tempFilePath,
          name: `照片_${Date.now()}.jpg`,
          size: f.size
        }));
        this.setData({ files: [...this.data.files, ...newFiles] });
      }
    });
  },

  // 从相册选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 9 - this.data.files.length,
      mediaType: ['image'],
      sourceType: ['album'],
      sizeType: ['compressed'],
      success: (res) => {
        const newFiles = res.tempFiles.map(f => ({
          path: f.tempFilePath,
          name: `图片_${Date.now()}.jpg`,
          size: f.size
        }));
        this.setData({ files: [...this.data.files, ...newFiles] });
      }
    });
  },

  // 选择视频
  chooseVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      success: (res) => {
        const f = res.tempFiles[0];
        if (f.size > config.maxFileSize) {
          wx.showToast({ title: '视频超过50MB限制', icon: 'none' });
          return;
        }
        this.setData({ files: [...this.data.files, { path: f.tempFilePath, name: `视频_${Date.now()}.mp4`, size: f.size }] });
      }
    });
  },

  // 移除文件
  removeFile(e) {
    const idx = e.currentTarget.dataset.index;
    const files = [...this.data.files];
    files.splice(idx, 1);
    this.setData({ files });
  },

  // 预览文件
  previewFile(e) {
    const { url, name } = e.detail;
    // 本地文件直接预览
    if (url.startsWith('http')) {
      api.previewFile(url);
    } else {
      // 本地图片预览
      if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)) {
        wx.previewImage({ urls: [url] });
      }
    }
  },

  // 提交上传
  async submit() {
    if (this.data.stageIndex < 0) {
      wx.showToast({ title: '请选择上传节点', icon: 'none' });
      return;
    }
    if (this.data.files.length === 0) {
      wx.showToast({ title: '请添加文件', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    // 逐个上传文件
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < this.data.files.length; i++) {
      const f = this.data.files[i];
      this.setData({ uploadProgress: `上传中 ${i + 1}/${this.data.files.length}...` });

      try {
        await api.uploadFile('/api/upload', f.path, {
          projectId: this.data.projectId,
          stage: this.data.stage,
          description: this.data.description,
          staffId: app.globalData.staffId,
          password: app.globalData.password,
          fileName: f.name
        });
        successCount++;
      } catch (err) {
        console.error('上传失败', f.name, err);
        failCount++;
      }
    }

    this.setData({ submitting: false, uploadProgress: '' });

    if (successCount > 0) {
      wx.showToast({
        title: `上传成功 ${successCount} 个文件`,
        icon: 'success'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } else {
      wx.showToast({ title: '上传失败，请重试', icon: 'none' });
    }
  }
});
