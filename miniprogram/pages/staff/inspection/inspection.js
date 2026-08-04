// pages/staff/inspection/inspection.js
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
    inspector: '',
    note: '',
    issues: '',
    files: [],
    submitting: false,
    inspectDate: ''
  },

  onLoad(opts) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.setData({
      projectId: opts.projectId,
      projectName: decodeURIComponent(opts.name || ''),
      stages: config.allStages,
      inspectDate: dateStr
    });
  },

  onStageChange(e) {
    this.setData({ stageIndex: e.detail.value, stage: this.data.stages[e.detail.value] });
  },

  onDateChange(e) {
    this.setData({ inspectDate: e.detail.value });
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value });
  },

  takePhoto() {
    wx.chooseMedia({
      count: 9 - this.data.files.length,
      mediaType: ['image'],
      sourceType: ['camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const newFiles = res.tempFiles.map(f => ({
          path: f.tempFilePath,
          name: `巡检照片_${Date.now()}.jpg`,
          size: f.size
        }));
        this.setData({ files: [...this.data.files, ...newFiles] });
      }
    });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 9 - this.data.files.length,
      mediaType: ['image'],
      sourceType: ['album'],
      sizeType: ['compressed'],
      success: (res) => {
        const newFiles = res.tempFiles.map(f => ({
          path: f.tempFilePath,
          name: `巡检照片_${Date.now()}.jpg`,
          size: f.size
        }));
        this.setData({ files: [...this.data.files, ...newFiles] });
      }
    });
  },

  removeFile(e) {
    const idx = e.currentTarget.dataset.index;
    const files = [...this.data.files];
    files.splice(idx, 1);
    this.setData({ files });
  },

  async submit() {
    if (this.data.stageIndex < 0) {
      wx.showToast({ title: '请选择巡检阶段', icon: 'none' });
      return;
    }
    if (this.data.files.length === 0) {
      wx.showToast({ title: '请至少添加一张照片', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    let successCount = 0;
    for (let i = 0; i < this.data.files.length; i++) {
      const f = this.data.files[i];
      try {
        await api.uploadFile('/api/inspection', f.path, {
          projectId: this.data.projectId,
          stage: this.data.stage,
          inspectDate: this.data.inspectDate,
          inspector: this.data.inspector || app.globalData.staffId,
          note: this.data.note,
          issues: this.data.issues,
          staffId: app.globalData.staffId,
          password: app.globalData.password,
          fileName: f.name
        });
        successCount++;
      } catch (err) {
        console.error('上传失败', err);
      }
    }

    this.setData({ submitting: false });

    if (successCount > 0) {
      wx.showToast({ title: `巡检上传成功`, icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } else {
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  }
});
