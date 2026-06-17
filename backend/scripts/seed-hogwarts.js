import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import hogwartsSystemPrompt from '../src/prompts/hogwarts.js';

const prisma = new PrismaClient();

await prisma.world.upsert({
  where: { slug: 'hogwarts' },
  update: { isActive: true, systemPrompt: hogwartsSystemPrompt },
  create: {
    slug: 'hogwarts',
    name: '霍格華茲魔法學校',
    introText: '一封貓頭鷹送來的入學通知書，開啟了一切。',
    systemPrompt: hogwartsSystemPrompt,
    modelFree: 'claude-sonnet-4-6',
    modelPaid: 'claude-opus-4-8',
    isActive: true,
  },
});

console.log('霍格華茲世界已建立。');
await prisma.$disconnect();
