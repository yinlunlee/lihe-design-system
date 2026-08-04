// utils/auth.js - 认证工具
const app = getApp();

// 检查登录状态，未登录跳转登录页
function checkLogin() {
  const app = getApp();
  if (!app.globalData.role) {
    wx.reLaunch({ url: '/pages/login/login' });
    return false;
  }
  return true;
}

// 根据角色获取认证参数
function getAuthParams() {
  const app = getApp();
  const params = {};
  if (app.globalData.staffId) params.staffId = app.globalData.staffId;
  if (app.globalData.password) params.password = app.globalData.password;
  return params;
}

// 退出登录
function logout() {
  const app = getApp();
  app.logout();
  wx.reLaunch({ url: '/pages/login/login' });
}

module.exports = {
  checkLogin,
  getAuthParams,
  logout
};
