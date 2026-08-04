// components/file-item/file-item.js
const config = require('../../utils/config.js');

Component({
  properties: {
    name: { type: String, value: '' },
    url: { type: String, value: '' },
    size: { type: Number, value: 0 },
    removable: { type: Boolean, value: false }
  },
  data: {
    icon: '📄',
    label: '文件',
    sizeText: ''
  },
  observers: {
    'name, size': function(name, size) {
      const fi = config.getFileIcon(name);
      let sizeText = '';
      if (size > 0) {
        if (size < 1024 * 1024) sizeText = (size / 1024).toFixed(1) + 'KB';
        else sizeText = (size / (1024 * 1024)).toFixed(1) + 'MB';
      }
      this.setData({ icon: fi.icon, label: fi.label, sizeText });
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { url: this.data.url, name: this.data.name });
    },
    onRemove() {
      this.triggerEvent('remove');
    }
  }
});
