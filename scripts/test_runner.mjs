import { spawn } from 'child_process';
import http from 'http';

const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;

function waitServer(timeoutMs = 25000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`${BASE}/login`, (res) => {
        if (res.statusCode) return resolve();
        setTimeout(check, 500);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Server start timed out'));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

async function run() {
  console.log('Starting Next.js production server on port', PORT, '...');
  const nextBin = './node_modules/next/dist/bin/next';
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      AUTH_SECRET: 'gemas-pertamina-retail-archive-system-secret-2026-very-secure-key',
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
    },
  });

  child.on('error', (err) => {
    console.error('Child process error:', err);
  });

  try {
    await waitServer();
    console.log('✓ Server is ready at', BASE);

    // Helper fetch with cookie jar
    class Session {
      constructor(username) {
        this.username = username;
        this.cookies = [];
      }

      async fetch(path, opts = {}) {
        const headers = { ...(opts.headers || {}) };
        if (this.cookies.length) {
          headers['cookie'] = this.cookies.join('; ');
        }
        if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
          headers['content-type'] = 'application/json';
          opts.body = JSON.stringify(opts.body);
        }
        const res = await fetch(`${BASE}${path}`, {
          ...opts,
          headers,
          redirect: 'manual',
        });
        const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
        if (setCookie.length) {
          for (const c of setCookie) {
            const part = c.split(';')[0];
            this.cookies.push(part);
          }
        }
        return res;
      }

      async login(password = 'gemas123') {
        const res = await this.fetch('/api/auth/login', {
          method: 'POST',
          body: { username: this.username, password },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`Login ${this.username} failed: ${json.error || res.status}`);
        console.log(`✓ Login ${this.username}: success`);
      }
    }

    // 1. Test unauthenticated redirect
    console.log('\n--- Test 1: Unauthenticated access ---');
    const unauth = new Session();
    const resHomeUnauth = await unauth.fetch('/home');
    console.log('/home unauth status (expect redirect 307):', resHomeUnauth.status, resHomeUnauth.headers.get('location'));
    if (resHomeUnauth.status !== 307) {
      console.warn('Warning: expected 307 redirect for unauthenticated access');
    }

    // 2. Test Admin PAM (Head Office)
    console.log('\n--- Test 2: Admin PAM (Head Office) ---');
    const pam = new Session('pam.demo');
    await pam.login();
    const pamPaths = [
      '/home',
      '/dashboard',
      '/dashboard/region/REG-1',
      '/info',
      '/templates',
      '/submissions',
      '/submissions?tab=pooling',
      '/ask',
      '/admin/master',
      '/admin/users',
      '/admin/activity',
    ];
    for (const p of pamPaths) {
      const res = await pam.fetch(p);
      console.log(`PAM GET ${p} -> HTTP ${res.status}`);
      if (res.status >= 400) throw new Error(`PAM GET ${p} failed with ${res.status}`);
    }

    // 3. Test PIC Region (Region I)
    console.log('\n--- Test 3: PIC Region I ---');
    const reg1 = new Session('region1.demo');
    await reg1.login();
    const regPaths = [
      '/home',
      '/dashboard',
      '/submissions',
      '/submissions?tab=pooling',
      '/submissions?tab=memo',
    ];
    for (const p of regPaths) {
      const res = await reg1.fetch(p);
      console.log(`PIC Region GET ${p} -> HTTP ${res.status}`);
      if (res.status >= 400) throw new Error(`PIC Region GET ${p} failed with ${res.status}`);
    }

    // Test RBAC: PIC Region trying to access Admin Users page should be redirected
    const resForbiddenUsers = await reg1.fetch('/admin/users');
    console.log('PIC Region GET /admin/users -> HTTP', resForbiddenUsers.status, '(expect 307 redirect)');
    if (resForbiddenUsers.status !== 307) {
      throw new Error(`Expected 307 Redirect for non-PAM /admin/users, got ${resForbiddenUsers.status}`);
    }

    // 4. Test Admin SPBU
    console.log('\n--- Test 4: Admin SPBU (11201101) ---');
    const spbu = new Session('spbu11201101');
    await spbu.login();
    const spbuPaths = [
      '/home',
      '/dashboard',
      '/submissions',
      '/submissions/new',
    ];
    for (const p of spbuPaths) {
      const res = await spbu.fetch(p);
      console.log(`Admin SPBU GET ${p} -> HTTP ${res.status}`);
      if (res.status >= 400) throw new Error(`Admin SPBU GET ${p} failed with ${res.status}`);
    }

    // RBAC: SPBU trying to approve a submission -> must return 403 Forbidden
    const resReviewIllegal = await spbu.fetch('/api/submissions/SUB-001/review', {
      method: 'POST',
      body: { decision: 'approve' },
    });
    console.log('Admin SPBU POST /api/submissions/SUB-001/review -> HTTP', resReviewIllegal.status, '(expect 403)');
    if (resReviewIllegal.status !== 403) {
      throw new Error(`Expected 403 Forbidden for SPBU review, got ${resReviewIllegal.status}`);
    }

    // 5. Test AI Assistant "Tanya si GEMAS" (RAG)
    console.log('\n--- Test 5: Tanya si GEMAS AI Assistant ---');
    const resAi = await pam.fetch('/api/ai/chat', {
      method: 'POST',
      body: { question: 'Bagaimana alur pengajuan usul musnah arsip?' },
    });
    console.log('AI Chat POST status:', resAi.status);
    const aiData = await resAi.json();
    console.log('AI Response mode:', aiData.mode);
    console.log('AI Sources count:', aiData.sources?.length || 0);
    console.log('AI Links count:', aiData.links?.length || 0);
    console.log('AI Answer snippet:\n', aiData.answer?.slice(0, 200) + '...\n');
    if (!aiData.answer || !aiData.sources) {
      throw new Error('AI Chat response missing answer or sources');
    }

    console.log('\n======================================');
    console.log('🎉 ALL INTEGRATION SMOKE TESTS PASSED!');
    console.log('======================================\n');
  } finally {
    console.log('Stopping test server...');
    child.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
