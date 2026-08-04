// components/progress-bar/progress-bar.js
Component({
  properties: {
    progress: { type: Number, value: 0 },
    label: { type: String, value: '' },
    showText: { type: Boolean, value: true }
  },
  data: {
    barColor: '#5A7D6B'
  },
  observers: {
    'progress': function(val) {
      let color = '#5A7D6B';
      if (val >= 100) color = '#4CAF50';
      else if (val >= 80) color = '#4CAF50';
      else if (val >= 50) color = '#5A7D6B';
      else if (val >= 25) color = '#FF9800';
      else color = '#FF9800';
      this.setData({ barColor: color });
    }
  }
});
