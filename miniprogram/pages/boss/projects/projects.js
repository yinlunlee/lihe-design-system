// pages/boss/projects/projects.js
const api = require('../../../utils/api.js');
const app = getApp();

Page({
  data: {
    projects: [],
    filtered: [],
    loading: true,
    filterStaff: '',
    filterStatus: '',
    staffList: []
  },

  onLoad() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const data = await api.get('/api/boss');
      const projects = data.projects || [];
      // 提取员工列表
      const staffSet = new Set();
      projects.forEach(p => { if (p.staffId) staffSet.add(p.staffId); });
      this.setData({
        projects,
        filtered: projects,
        staffList: Array.from(staffSet),
        loading: false
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onFilterStaff(e) {
    const staffId = e.detail.value === 'all' ? '' : this.data.staffList[e.detail.value];
    this.setData({ filterStaff: staffId });
    this.applyFilter();
  },

  onFilterStatus(e) {
    const status = e.detail.value;
    this.setData({ filterStatus: status === 'all' ? '' : status });
    this.applyFilter();
  },

  applyFilter() {
    let filtered = this.data.projects;
    if (this.data.filterStaff) {
      filtered = filtered.filter(p => p.staffId === this.data.filterStaff);
    }
    if (this.data.filterStatus) {
      filtered = filtered.filter(p => (p.status || '进行中') === this.data.filterStatus);
    }
    this.setData({ filtered });
  }
});
