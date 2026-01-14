(async ()=>{
  try{
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    await p.$connect();
    console.log('PRISMA_CONNECTED');
    await p.$disconnect();
  } catch(e) {
    console.error('PRISMA_ERROR');
    console.error(e);
    process.exit(1);
  }
})();
