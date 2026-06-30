// 世界（模擬器）清單。
// 這裡只放前端展示用的常數；真正的 world ID 來自 env，不寫死進 JS。
// 之後若改由後端 /worlds 提供，再替換這個來源即可。

export const WORLDS = [
  {
    id: import.meta.env.VITE_HOGWARTS_WORLD_ID,
    title: '霍格華茲',
    description: '我們都在等待的那封信。',
    available: true,
  },
  {
    id: 'yuanchao', // 佔位用，尚未開放；無對應後端 world，不可進入。
    title: '淵朝',
    description: '宮牆深處，史書未載的那一夜即將翻頁。',
    available: false,
  },
];
