// components/timeline/timeline.js
const config = require('../../utils/config.js');

Component({
  properties: {
    currentStage: { type: String, value: '' },
    completedStages: { type: Array, value: [] }
  },
  data: {
    groups: []
  },
  observers: {
    'currentStage, completedStages': function(current, completed) {
      const groups = [];
      const allStages = config.allStages;
      const completedSet = new Set(completed || []);
      // 如果有currentStage，认为之前阶段都已完成
      let currentIdx = current ? allStages.indexOf(current) : -1;

      for (const [groupName, stages] of Object.entries(config.stageGroups)) {
        const items = stages.map((stage, i) => {
          const stageIdx = allStages.indexOf(stage);
          let status = 'pending';
          if (completedSet.has(stage)) status = 'done';
          else if (currentIdx >= 0 && stageIdx < currentIdx) status = 'done';
          else if (stage === current) status = 'current';
          return { name: stage, status };
        });
        groups.push({ name: groupName, items });
      }
      this.setData({ groups });
    }
  }
});
