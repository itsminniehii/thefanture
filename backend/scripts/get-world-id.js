import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const w = await prisma.world.findUnique({ where: { slug: 'hogwarts' } });
console.log(w.id);
await prisma.$disconnect();
