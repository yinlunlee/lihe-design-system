// pages/staff/index/index.js
const api = require('../../../utils/api.js');
const auth = require('../../../utils/auth.js');
const app = getApp();

Page({
  data: {
    projects: [],
    loading: true,
    staffId: ''
  },

  onLoad() {
    if (!auth.checkLogin()) return;
    if (app.globalData.role !== 'staff') {
      app.goHome();
      return;
    }
    this.setData({ staffId: app.globalData.staffId });
    this.loadProjects();
  },

  onShow() {
    // 页面返回时刷新
    if (app.globalData.role === 'staff' && !this.data.loading) {
      this.loadProjects();
    }
  },

  onPullDownRefresh() {
    this.loadProjects().then(() => wx.stopPullDownRefresh());
  },

  async loadProjects() {
    this.setData({ loading: true });
    try {
      const data = await api.get('/api/project', { staffId: this.data.staffId });
      this.setData({
        projects: data.projects || [],
        loading: false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  goDetail(e) {
    const project = e.currentTarget.dataset.project;
    wx.navigateTo({
      url: `/pages/staff/detail/detail?projectId=${project.recordId || project.id}&name=${encodeURIComponent(project.name || '')}`
    });
  },

  goUpload(e) {
    const project = e.currentTarget.dataset.project;
    wx.navigateTo({
      url: `/pages/staff/upload/upload?projectId=${project.recordId || project.id}&name=${encodeURIComponent(project.name || '')}`
    });
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) auth.logout();
      }
    });
  }
});
