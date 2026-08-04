// pages/staff/detail/detail.js
const api = require('../../../utils/api.js');
const app = getApp();

Page({
  data: {
    projectId: '',
    projectName: '',
    project: null,
    nodes: [],
    inspections: [],
    activeTab: 'timeline',
    loading: true,
    videoUrl: '',
    showVideo: false
  },

  onLoad(opts) {
    this.setData({
      projectId: opts.projectId,
      projectName: decodeURIComponent(opts.name || '')
    });
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const [projectData, nodesData, inspData] = await Promise.all([
        api.get('/api/project', { staffId: app.globalData.staffId }),
        api.get('/api/nodes', { projectId: this.data.projectId, staffId: app.globalData.staffId }),
        api.get('/api/inspection', { staffId: app.globalData.staffId, projectId: this.data.projectId })
      ]);

      let project = null;
      if (projectData.projects) {
        project = projectData.projects.find(p => (p.recordId || p.id) === this.data.projectId);
      }

      this.setData({
        project,
        nodes: nodesData.nodes || [],
        inspections: inspData.inspections || [],
        loading: false
      });
    } catch (err) {
      console.error('加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  goUpload() {
    wx.navigateTo({
      url: `/pages/staff/upload/upload?projectId=${this.data.projectId}&name=${encodeURIComponent(this.data.projectName)}`
    });
  },

  goInspection() {
    wx.navigateTo({
      url: `/pages/staff/inspection/inspection?projectId=${this.data.projectId}&name=${encodeURIComponent(this.data.projectName)}`
    });
  },

  onFileTap(e) {
    api.previewFile(e.detail.url);
  },

  closeVideo() {
    this.setData({ showVideo: false, videoUrl: '' });
  }
});
