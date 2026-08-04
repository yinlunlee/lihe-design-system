// pages/boss/staff/staff.js
const api = require('../../../utils/api.js');

Page({
  data: { stats: null, loading: true },

  onLoad() { this.loadData(); },
  onPullDownRefresh() { this.loadData().then(() => wx.stopPullDownRefresh()); },

  async loadData() {
    this.setData({ loading: true });
    try {
      const data = await api.get('/api/boss');
      this.setData({ stats: data, loading: false });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  }
});
