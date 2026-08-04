// pages/client/detail/detail.js
const api = require('../../../utils/api.js');

Page({
  data: {
    projectId: '',
    projectName: '',
    project: null,
    nodes: [],
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
      // 并行加载项目信息和节点
      const [projectData, nodesData] = await Promise.all([
        api.get('/api/nodes', { phone: getApp().globalData.staffId }),
        api.get('/api/nodes', { phone: getApp().globalData.staffId })
      ]);

      // 从项目列表中找到当前项目
      let project = null;
      if (projectData.projects) {
        project = projectData.projects.find(p => (p.recordId || p.id) === this.data.projectId);
      }

      // 获取节点列表
      let nodes = [];
      if (nodesData.nodes) {
        nodes = nodesData.nodes.filter(n => n.projectId === this.data.projectId || !n.projectId);
      }

      this.setData({
        project,
        nodes,
        loading: false
      });
    } catch (err) {
      console.error('加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // 切换Tab
  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  // 确认节点
  goConfirm(e) {
    const node = e.currentTarget.dataset.node;
    wx.navigateTo({
      url: `/pages/client/confirm/confirm?nodeId=${node.recordId || node.id}&stage=${encodeURIComponent(node.stage || node.nodeStage || '')}&projectId=${this.data.projectId}`
    });
  },

  // 预览文件
  onFileTap(e) {
    const { url, name } = e.detail;
    api.previewFile(url);
  },

  // 关闭视频
  closeVideo() {
    this.setData({ showVideo: false, videoUrl: '' });
  }
});
