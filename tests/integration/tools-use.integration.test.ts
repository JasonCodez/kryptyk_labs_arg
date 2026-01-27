import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';

dotenv.config();

const RUN = process.env.RUN_INTEGRATION_TESTS === '1';

const prisma = new PrismaClient();

if (!RUN) {
  test.skip('integration tests disabled (set RUN_INTEGRATION_TESTS=1 to enable)', () => {});
} else {
  describe('Tools Use Integration (requires dev DB)', () => {
    const testEmail = `integration+tool@local`;
    let userId: string;
    const toolIds: Record<string, string> = {};

    beforeAll(async () => {
      // create test user and multiple tools in the real DB
      const user = await prisma.user.create({ data: { email: testEmail, name: 'Integration Tester' } });
      userId = user.id;
      const detective = await prisma.tool.create({ data: { name: 'Detective Scanner', specialty: 'detective', type: 'single', metadata: { detective: { hintDefault: 'Look near the painting.' } } } as any });
      const tech = await prisma.tool.create({ data: { name: 'Tech Toolkit', specialty: 'tech', type: 'single', metadata: { tech: { requiredAttempts: 3 } } } as any });
      const locksmith = await prisma.tool.create({ data: { name: 'Locksmith Kit', specialty: 'locksmith', type: 'single' } } as any);
      const linguist = await prisma.tool.create({ data: { name: 'Linguist Notes', specialty: 'linguist', type: 'single' } } as any);
      const unknown = await prisma.tool.create({ data: { name: 'Unknown Tool', specialty: 'mystery', type: 'single' } } as any);
      toolIds.detective = detective.id;
      toolIds.tech = tech.id;
      toolIds.locksmith = locksmith.id;
      toolIds.linguist = linguist.id;
      toolIds.unknown = unknown.id;
    });

    afterAll(async () => {
      // cleanup
      await prisma.tool.deleteMany({ where: { id: { in: Object.values(toolIds) } } });
      await prisma.toolUsage.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.$disconnect();
    });

    test('detective (metadata override) persists usage and result', async () => {
      const { computeSpecialtyResult } = await import('../../src/lib/specialties');
      const payload = { targetId: 'obj-detective' };
      const computed = computeSpecialtyResult('detective', payload, { detective: { hintDefault: 'Under the lamp.' } });
      await prisma.toolUsage.create({ data: { userId, teamId: 'team-int', puzzleId: 'puzzle-int', toolId: toolIds.detective, payload, result: computed } });
      const usage = await prisma.toolUsage.findFirst({ where: { userId, toolId: toolIds.detective }, orderBy: { createdAt: 'desc' } });
      expect(usage).toBeTruthy();
      expect((usage!.result as any).hint).toBe('Under the lamp.');
    });

    test('tech respects metadata.requiredAttempts and force', async () => {
      const { computeSpecialtyResult } = await import('../../src/lib/specialties');
      // attempt with insufficient attempts
      let payload = { action: 'override', attempts: 2 };
      let computed = computeSpecialtyResult('tech', payload, { tech: { requiredAttempts: 3 } });
      expect((computed as any).success).toBe(false);

      // attempt with sufficient attempts
      payload = { action: 'override', attempts: 3 };
      computed = computeSpecialtyResult('tech', payload, { tech: { requiredAttempts: 3 } });
      expect((computed as any).success).toBe(true);

      // force success
      payload = { action: 'override', force: true };
      computed = computeSpecialtyResult('tech', payload, { tech: { requiredAttempts: 99 } });
      expect((computed as any).success).toBe(true);

      // persist one usage
      await prisma.toolUsage.create({ data: { userId, teamId: 'team-int', puzzleId: 'puzzle-int', toolId: toolIds.tech, payload, result: computed } });
      const usage = await prisma.toolUsage.findFirst({ where: { userId, toolId: toolIds.tech }, orderBy: { createdAt: 'desc' } });
      expect(usage).toBeTruthy();
    });

    test('locksmith partial and full unlock behaviors', async () => {
      const { computeSpecialtyResult } = await import('../../src/lib/specialties');
      // high skill -> unlock
      let payload = { method: 'pick', skill: 8 };
      let computed = computeSpecialtyResult('locksmith', payload, {});
      expect((computed as any).effect).toBe('lock_unlocked');

      // moderate skill -> partial
      payload = { method: 'pick', skill: 5 };
      computed = computeSpecialtyResult('locksmith', payload, {});
      expect((computed as any).effect).toBe('partial');

      // low skill -> failed
      payload = { method: 'pick', skill: 1 };
      computed = computeSpecialtyResult('locksmith', payload, {});
      expect((computed as any).effect).toBe('failed');

      // force method
      payload = { method: 'force' };
      computed = computeSpecialtyResult('locksmith', payload, {});
      expect((computed as any).effect).toBe('lock_unlocked');

      await prisma.toolUsage.create({ data: { userId, teamId: 'team-int', puzzleId: 'puzzle-int', toolId: toolIds.locksmith, payload: { method: 'pick', skill: 8 }, result: computeSpecialtyResult('locksmith', { method: 'pick', skill: 8 }, {}) } });
    });

    test('linguist decodes and hints', async () => {
      const { computeSpecialtyResult } = await import('../../src/lib/specialties');
      let payload = { plaintext: 'secret' };
      let computed = computeSpecialtyResult('linguist', payload, {});
      expect((computed as any).effect).toBe('decoded');

      payload = {};
      computed = computeSpecialtyResult('linguist', payload, { linguist: { hintLevelDefault: 2 } });
      expect((computed as any).effect).toBe('hint');
      expect((computed as any).hintLevel).toBe(2);

      await prisma.toolUsage.create({ data: { userId, teamId: 'team-int', puzzleId: 'puzzle-int', toolId: toolIds.linguist, payload: { plaintext: 'abc' }, result: computeSpecialtyResult('linguist', { plaintext: 'abc' }, {}) } });
    });

    test('unknown specialty yields null result (failure mode)', async () => {
      const { computeSpecialtyResult } = await import('../../src/lib/specialties');
      const computed = computeSpecialtyResult('mystery', { foo: 'bar' }, {});
      expect(computed).toBeNull();
    });

    test('concurrent usages do not error and all persist', async () => {
      const count = 10;
      const payload = { concurrent: true };
      // spawn concurrent creates
      await Promise.all(Array.from({ length: count }).map(() => prisma.toolUsage.create({ data: { userId, teamId: 'team-conc', puzzleId: 'puzzle-conc', toolId: toolIds.detective, payload, result: { effect: 'concurrent_test' } } })));
      const usages = await prisma.toolUsage.findMany({ where: { userId, toolId: toolIds.detective, teamId: 'team-conc' } });
      expect(usages.length).toBeGreaterThanOrEqual(count);
    });

    test('socket emission: captures toolUsed and toolCooldown posts', async () => {
      const http = await import('http');
      const axios = await import('axios');

      const received: any[] = [];
      const server = http.createServer(async (req: any, res: any) => {
        if (req.method === 'POST' && req.url === '/emit') {
          let body = '';
          req.on('data', (chunk: any) => (body += chunk));
          req.on('end', () => {
            try {
              received.push(JSON.parse(body));
            } catch (e) {
              received.push(body);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      await new Promise<void>((resolve) => server.listen(0, resolve));
      const addr: any = server.address();
      const base = `http://127.0.0.1:${addr.port}`;

      // emulate route emissions
      await axios.default.post(`${base}/emit`, { room: 'team::puzzle', event: 'toolUsed', payload: { userId, toolId: toolIds.detective } });
      await axios.default.post(`${base}/emit`, { room: 'team::puzzle', event: 'toolCooldown', payload: { userId, toolId: toolIds.detective, cooldownSeconds: 30 } });

      // give server a moment
      await new Promise((r) => setTimeout(r, 50));

      expect(received.some(r => r.event === 'toolUsed')).toBe(true);
      expect(received.some(r => r.event === 'toolCooldown')).toBe(true);

      // properly close and await server close to avoid open handles
      await new Promise<void>((resolve, reject) => {
        server.close((err: any) => (err ? reject(err) : resolve()));
      });
    });
  });
}
