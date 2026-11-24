import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';

describe('Helmet content security policy', () => {
  it('allows the PWA manifest and worker without dropping Helmet defaults', async () => {
    const response = await request(createApp()).get('/api/health');
    expect(response.status).toBe(200);
    const csp = String(response.headers['content-security-policy'] ?? '');
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
  });
});
