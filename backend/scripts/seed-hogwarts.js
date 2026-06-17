import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import hogwartsSystemPrompt from '../src/prompts/hogwarts.js';

const prisma = new PrismaClient();

const SAVE_TEMPLATE = ['時間', '地點', '同伴', '最新進展', '未解線索'];

await prisma.world.upsert({
  where: { slug: 'hogwarts' },
  update: { isActive: true, systemPrompt: hogwartsSystemPrompt, saveTemplate: SAVE_TEMPLATE },
  create: {
    slug: 'hogwarts',
    name: '霍格華茲魔法學校',
    introText: '一封貓頭鷹送來的入學通知書，開啟了一切。',
    systemPrompt: hogwartsSystemPrompt,
    modelFree: 'claude-haiku-4-5-20251001',
    modelPaid: 'claude-opus-4-8',
    saveTemplate: SAVE_TEMPLATE,
    isActive: true,
  },
});

console.log('霍格華茲世界已建立。');
await prisma.$disconnect();
