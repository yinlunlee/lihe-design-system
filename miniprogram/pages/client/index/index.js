// pages/client/index/index.js
const api = require('../../../utils/api.js');
const auth = require('../../../utils/auth.js');

const app = getApp();

Page({
  data: {
    projects: [],
    loading: true,
    phone: ''
  },

  onLoad() {
    if (!auth.checkLogin()) return;
    if (app.globalData.role !== 'client') {
      app.goHome();
      return;
    }
    this.setData({ phone: app.globalData.staffId });
    this.loadProjects();
  },

  onPullDownRefresh() {
    this.loadProjects().then(() => wx.stopPullDownRefresh());
  },

  async loadProjects() {
    this.setData({ loading: true });
    try {
      const data = await api.get('/api/project', { phone: this.data.phone });
      if (data.projects) {
        this.setData({ projects: data.projects, loading: false });
      } else {
        this.setData({ projects: [], loading: false });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // 进入项目详情
  goDetail(e) {
    const project = e.currentTarget.dataset.project;
    wx.navigateTo({
      url: `/pages/client/detail/detail?projectId=${project.recordId || project.id}&name=${encodeURIComponent(project.name || '')}`
    });
  },

  // 退出登录
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
