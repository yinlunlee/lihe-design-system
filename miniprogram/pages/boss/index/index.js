// pages/boss/index/index.js
const api = require('../../../utils/api.js');
const auth = require('../../../utils/auth.js');
const app = getApp();

Page({
  data: {
    stats: null,
    loading: true
  },

  onLoad() {
    if (!auth.checkLogin()) return;
    if (app.globalData.role !== 'boss') {
      app.goHome();
      return;
    }
    this.loadData();
  },

  onShow() {
    if (app.globalData.role === 'boss' && !this.data.loading) {
      this.loadData();
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const data = await api.get('/api/boss');
      this.setData({ stats: data, loading: false });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  goProjects() {
    wx.navigateTo({ url: '/pages/boss/projects/projects' });
  },

  goStaff() {
    wx.navigateTo({ url: '/pages/boss/staff/staff' });
  },

  goPending() {
    wx.navigateTo({ url: '/pages/boss/pending/pending' });
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => { if (res.confirm) auth.logout(); }
    });
  }
});
