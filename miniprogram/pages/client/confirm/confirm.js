// pages/client/confirm/confirm.js
const api = require('../../../utils/api.js');
const app = getApp();

Page({
  data: {
    nodeId: '',
    stage: '',
    projectId: '',
    node: null,
    feedback: '',
    action: '', // confirm / reject
    loading: true,
    submitting: false
  },

  onLoad(opts) {
    this.setData({
      nodeId: opts.nodeId,
      stage: decodeURIComponent(opts.stage || ''),
      projectId: opts.projectId
    });
    this.loadNode();
  },

  async loadNode() {
    this.setData({ loading: true });
    try {
      const data = await api.get('/api/nodes', { phone: app.globalData.staffId });
      if (data.nodes) {
        const node = data.nodes.find(n => (n.recordId || n.id) === this.data.nodeId);
        this.setData({ node, loading: false });
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onInput(e) {
    this.setData({ feedback: e.detail.value });
  },

  selectAction(e) {
    this.setData({ action: e.currentTarget.dataset.action });
  },

  // 预览文件
  onFileTap(e) {
    api.previewFile(e.detail.url);
  },

  // 提交
  async onSubmit() {
    if (!this.data.action) {
      wx.showToast({ title: '请选择确认或驳回', icon: 'none' });
      return;
    }
    if (this.data.action === 'reject' && !this.data.feedback) {
      wx.showToast({ title: '请填写修改意见', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      await api.post('/api/confirm', {
        nodeId: this.data.nodeId,
        phone: app.globalData.staffId,
        action: this.data.action,
        feedback: this.data.feedback
      });

      wx.showToast({
        title: this.data.action === 'confirm' ? '已确认' : '已驳回',
        icon: 'success'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    } catch (err) {
      wx.showToast({ title: '提交失败: ' + err.message, icon: 'none' });
    }
    this.setData({ submitting: false });
  }
});
