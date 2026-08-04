# 立和设计 · 微信小程序部署指南

## 一、注册微信小程序

### 1. 注册账号
1. 打开 https://mp.weixin.qq.com/
2. 点击「立即注册」→ 选择「小程序」
3. 使用邮箱注册（每个邮箱只能注册一种类型的账号）

### 2. 主体类型选择
- **企业主体（推荐）**：需要营业执照，功能全（可用微信登录、客服消息等）
- **个人主体**：功能受限，不能使用部分API，但可以快速注册

### 3. 获取AppID
注册成功后在「开发管理 → 开发设置」中找到 **AppID**，替换 `project.config.json` 中的占位 AppID。

---

## 二、安装开发工具

1. 下载微信开发者工具：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
2. 安装后用微信扫码登录
3. 导入项目：选择 `miniprogram/` 文件夹，填入你的AppID

---

## 三、开发模式运行（无需域名备案）

在微信开发者工具中：
1. 点击右上角「详情」→「本地设置」
2. 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
3. 编译运行，可在模拟器和真机预览调试

> **注意**：开发模式下只有自己手机能预览，别人看不到。正式上线需要域名备案。

---

## 四、正式上线流程

### 1. 域名ICP备案（必须）
1. 购买域名（阿里云/腾讯云，约 ¥50-100/年）
2. 提交ICP备案（约 7-20 个工作日）
3. 备案通过后将域名解析到 Render 服务器
4. 在 Render Dashboard 设置自定义域名 + HTTPS

### 2. 配置小程序服务器域名
登录 https://mp.weixin.qq.com/ → 「开发管理 → 开发设置 → 服务器域名」：
- **request合法域名**：添加你的备案域名，如 `https://yourdomain.com`
- **uploadFile合法域名**：同上
- **downloadFile合法域名**：同上

### 3. 更新API地址
修改 `miniprogram/utils/config.js` 中的 `apiBase`：
```js
apiBase: 'https://yourdomain.com',  // 替换为备案域名
```

### 4. 提交审核
1. 点击开发者工具顶部「上传」
2. 登录 mp.weixin.qq.com → 「管理 → 版本管理」
3. 提交审核 → 等待微信团队审核（1-7天）
4. 审核通过后「发布」上线

---

## 五、小程序功能说明

### 角色与功能

| 角色 | 登录方式 | 功能页面 |
|------|----------|----------|
| 客户 | 手机号 | 项目列表 → 项目详情 → 确认节点 |
| 员工 | 工号+密码 | 项目列表 → 项目详情 → 上传成果/巡检 |
| 管理员 | B01+密码 | 概览仪表盘 → 项目管理 → 员工管理 → 待确认 |

### 账号配置
账号密码在 `render-deploy/lib/config.js` 的 `staffAccounts` 中配置：
```js
staffAccounts: {
  "D01": "lihe2026",   // 设计部
  "P01": "lihe2026",   // 项目部
  "B01": "lihe2026",   // 管理员
  "A01": "lihe2026",   // 行政财务
}
```

### 文件上传支持格式
图片 (JPG/PNG/GIF/WebP)、PDF、PPT/PPTX、Word/Doc、Excel/XLS、CAD (DWG/DXF)、视频 (MP4/MOV)、压缩包 (ZIP/RAR/7Z)、文本 (TXT/CSV)

### API地址
当前使用 Render 部署地址：`https://lihe-design.onrender.com`
正式上线后替换为备案域名。

---

## 六、项目结构

```
miniprogram/
├── app.js                    # 入口文件，全局状态
├── app.json                  # 页面注册、TabBar配置
├── app.wxss                  # 全局样式
├── project.config.json       # 项目配置（AppID在这里改）
├── sitemap.json
├── utils/
│   ├── config.js             # API地址、文件类型、阶段配置
│   ├── api.js                # 网络请求封装（GET/POST/上传/下载/预览）
│   └── auth.js               # 登录态检查、退出登录
├── components/
│   ├── progress-bar/         # 进度条组件
│   ├── timeline/              # 阶段时间线组件
│   └── file-item/             # 文件列表项组件
└── pages/
    ├── login/                 # 角色选择+登录
    ├── client/
    │   ├── index/             # 客户项目列表
    │   ├── detail/            # 项目详情+节点
    │   └── confirm/           # 确认/驳回节点
    ├── staff/
    │   ├── index/             # 员工项目列表
    │   ├── detail/            # 项目详情+时间线+节点/巡检
    │   ├── upload/            # 成果上传（拍照/图片/文件/视频）
    │   └── inspection/        # 巡检记录上传
    └── boss/
        ├── index/             # 管理概览仪表盘
        ├── projects/          # 全部项目（可筛选）
        ├── staff/             # 员工工作概览
        └── pending/           # 待确认节点列表
```

---

## 七、常见问题

**Q: 提示"不在以下request合法域名列表中"**
A: 开发阶段在「详情→本地设置」勾选「不校验合法域名」即可。正式上线需配置备案域名。

**Q: 上传文件失败**
A: 检查文件大小是否超过50MB，网络是否正常，服务器是否在线。

**Q: 客户找不到项目**
A: 确认客户输入的手机号与飞书项目表中"客户联系方式"字段一致。

**Q: 员工看不到项目**
A: 确认飞书项目表"负责人工号"字段已填写对应员工工号。

**Q: 管理员登录后看不到数据**
A: 确认使用 B01 账号登录，且 Render 服务正常。
