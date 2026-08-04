// pages/login/login.js
const api = require('../../utils/api.js');

const app = getApp();

Page({
  data: {
    role: '',          // client / staff / boss
    staffId: '',
    password: '',
    phone: '',
    loading: false
  },

  onLoad() {
    // 已登录直接跳转
    if (app.globalData.role) {
      app.goHome();
    }
  },

  // 选择角色
  selectRole(e) {
    this.setData({ role: e.currentTarget.dataset.role });
  },

  // 返回角色选择
  backToRole() {
    this.setData({ role: '', staffId: '', password: '', phone: '' });
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value });
  },

  // 登录
  async onLogin() {
    const { role, staffId, password, phone } = this.data;

    if (role === 'client') {
      if (!phone || phone.length < 11) {
        wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
        return;
      }
      // 客户登录：通过手机号查项目验证
      this.setData({ loading: true });
      try {
        const data = await api.get('/api/project', { phone });
        if (data.projects && data.projects.length > 0) {
          app.saveLogin('client', phone, '', { phone });
          wx.showToast({ title: '登录成功', icon: 'success' });
          setTimeout(() => app.goHome(), 500);
        } else {
          wx.showToast({ title: '未找到项目，请确认手机号', icon: 'none' });
        }
      } catch (err) {
        wx.showToast({ title: '登录失败: ' + err.message, icon: 'none' });
      }
      this.setData({ loading: false });
    } else {
      // 员工/老板登录
      if (!staffId) { wx.showToast({ title: '请输入工号', icon: 'none' }); return; }
      if (!password) { wx.showToast({ title: '请输入密码', icon: 'none' }); return; }

      this.setData({ loading: true });
      try {
        const data = await api.get('/api/project', { staffId, password });
        // API返回200且无error则认证成功
        if (data.error) throw new Error(data.error);

        const isBoss = role === 'boss' || staffId.startsWith('B');
        app.saveLogin(isBoss ? 'boss' : 'staff', staffId, password);
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => app.goHome(), 500);
      } catch (err) {
        wx.showToast({ title: '登录失败: ' + err.message, icon: 'none' });
      }
      this.setData({ loading: false });
    }
  }
});
