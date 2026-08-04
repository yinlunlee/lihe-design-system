// app.js - 立和设计小程序入口
App({
  globalData: {
    // API地址（部署后改为正式域名）
    apiBase: 'https://lihe-design.onrender.com',
    // 用户登录信息
    userInfo: null,
    role: '',        // client / staff / boss
    staffId: '',     // 员工工号或客户手机号
    password: '',    // 密码（仅员工/老板）
    // 阶段配置（与服务端config一致）
    stageGroups: {
      '设计阶段': ['平面布局方案', '效果图设计', '物料整理', '施工图设计', '报价签合同'],
      '施工阶段': ['开工前期准备', '拆除改造', '水电隐蔽工程', '防水工程', '泥瓦工程', '木工吊顶', '油漆墙面', '安装阶段', '开荒保洁竣工验收'],
      '软装阶段': ['软装-前期对接', '软装-方案设计', '软装-深化定品', '软装-采购跟单', '软装-进场摆场', '软装-售后质保'],
      '竣工交付': ['竣工交付']
    },
    allStages: [
      '平面布局方案', '效果图设计', '物料整理', '施工图设计', '报价签合同',
      '开工前期准备', '拆除改造', '水电隐蔽工程', '防水工程', '泥瓦工程',
      '木工吊顶', '油漆墙面', '安装阶段', '开荒保洁竣工验收', '竣工交付',
      '软装-前期对接', '软装-方案设计', '软装-深化定品', '软装-采购跟单', '软装-进场摆场', '软装-售后质保'
    ]
  },

  onLaunch() {
    // 从Storage恢复登录状态
    const saved = wx.getStorageSync('lihe_user');
    if (saved && saved.role) {
      this.globalData.role = saved.role;
      this.globalData.staffId = saved.staffId || '';
      this.globalData.password = saved.password || '';
      this.globalData.userInfo = saved;
    }
  },

  // 保存登录状态
  saveLogin(role, staffId, password, extra) {
    const data = { role, staffId, password, ...extra };
    this.globalData.role = role;
    this.globalData.staffId = staffId;
    this.globalData.password = password || '';
    this.globalData.userInfo = data;
    wx.setStorageSync('lihe_user', data);
  },

  // 清除登录状态
  logout() {
    this.globalData.role = '';
    this.globalData.staffId = '';
    this.globalData.password = '';
    this.globalData.userInfo = null;
    wx.removeStorageSync('lihe_user');
  },

  // 判断是否已登录
  isLoggedIn() {
    return !!this.globalData.role;
  },

  // 跳转到对应首页
  goHome() {
    const role = this.globalData.role;
    const routes = {
      client: '/pages/client/index/index',
      staff: '/pages/staff/index/index',
      boss: '/pages/boss/index/index'
    };
    const url = routes[role] || '/pages/login/login';
    wx.reLaunch({ url });
  }
});
