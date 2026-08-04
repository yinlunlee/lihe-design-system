// utils/config.js - 配置
module.exports = {
  // API基础地址（Render部署地址）
  apiBase: 'https://lihe-design.onrender.com',

  // 文件上传限制
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxFiles: 10,

  // 支持的文件类型（用于chooseMessageFile的extensions）
  fileExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'dwg', 'dxf', 'zip', 'rar', '7z', 'txt', 'csv', 'mp4', 'mov', 'avi'],

  // 阶段配置
  stageGroups: {
    '设计阶段': ['平面布局方案', '效果图设计', '物料整理', '施工图设计', '报价签合同'],
    '施工阶段': ['开工前期准备', '拆除改造', '水电隐蔽工程', '防水工程', '泥瓦工程', '木工吊顶', '油漆墙面', '安装阶段', '开荒保洁竣工验收'],
    '软装阶段': ['软装-前期对接', '软装-方案设计', '软装-深化定品', '软装-采购跟单', '软装-进场摆场', '软装-售后质保'],
    '竣工交付': ['竣工交付']
  },

  // 所有阶段（有序）
  allStages: [
    '平面布局方案', '效果图设计', '物料整理', '施工图设计', '报价签合同',
    '开工前期准备', '拆除改造', '水电隐蔽工程', '防水工程', '泥瓦工程',
    '木工吊顶', '油漆墙面', '安装阶段', '开荒保洁竣工验收', '竣工交付',
    '软装-前期对接', '软装-方案设计', '软装-深化定品', '软装-采购跟单', '软装-进场摆场', '软装-售后质保'
  ],

  // 获取文件图标
  getFileIcon(name) {
    if (!name) return { icon: '📄', label: '文件' };
    const ext = name.split('.').pop().toLowerCase();
    const map = {
      'jpg': { icon: '🖼', label: '图片' }, 'jpeg': { icon: '🖼', label: '图片' },
      'png': { icon: '🖼', label: '图片' }, 'gif': { icon: '🖼', label: '图片' },
      'webp': { icon: '🖼', label: '图片' }, 'bmp': { icon: '🖼', label: '图片' },
      'pdf': { icon: '📕', label: 'PDF' },
      'doc': { icon: '📘', label: 'Word' }, 'docx': { icon: '📘', label: 'Word' },
      'ppt': { icon: '📙', label: 'PPT' }, 'pptx': { icon: '📙', label: 'PPT' },
      'xls': { icon: '📗', label: 'Excel' }, 'xlsx': { icon: '📗', label: 'Excel' },
      'csv': { icon: '📗', label: 'CSV' },
      'dwg': { icon: '📐', label: 'CAD' }, 'dxf': { icon: '📐', label: 'CAD' },
      'zip': { icon: '🗜', label: '压缩包' }, 'rar': { icon: '🗜', label: '压缩包' }, '7z': { icon: '🗜', label: '压缩包' },
      'mp4': { icon: '🎥', label: '视频' }, 'mov': { icon: '🎥', label: '视频' }, 'avi': { icon: '🎥', label: '视频' },
      'txt': { icon: '📄', label: '文本' },
    };
    return map[ext] || { icon: '📄', label: '文件' };
  }
};
