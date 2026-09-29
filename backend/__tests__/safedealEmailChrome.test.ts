/**
 * SafeDeal email chrome must never carry Dynopay branding in the user-visible footer.
 * (Bug: "© Dynopay 2026. All Rights reserved." rendered on SafeDeal emails.)
 */
jest.mock('../utils/loggers', () => ({
  apiLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { baseEmailTemplate, safedealLegalName } from '../utils/emailTemplate';

const ENV_KEYS = ['EMAIL_LEGAL_NAME', 'SAFEDEAL_LEGAL_NAME'];
const saved: Record<string, string | undefined> = {};
beforeEach(() => { for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

const year = new Date().getFullYear();
const footerOf = (html: string) => html.slice(html.lastIndexOf('©') - 200);

describe('SafeDeal email chrome', () => {
  it('footer is SafeDeal-branded (no Dynopay) when no legal entity is configured', () => {
    const html = baseEmailTemplate('Hi', '<p>x</p>', { brand: 'safedeal' });
    expect(html).toContain(`© SafeDeal ${year}. All rights reserved.`);
    expect(footerOf(html)).not.toMatch(/Dynopay/);
    expect(html).toContain('The SafeDeal team');
    expect(html).toMatch(/href="[^"]*\/privacy"/);
    expect(html).not.toMatch(/privacy-policy/);
    expect(safedealLegalName()).toBe('SafeDeal');
  });

  it('names the operator only when explicitly configured', () => {
    process.env.EMAIL_LEGAL_NAME = 'Dynopay Ltd';
    const html = baseEmailTemplate('Hi', '<p>x</p>', { brand: 'safedeal' });
    expect(html).toContain(`© SafeDeal ${year}. All rights reserved. Operated by Dynopay Ltd.`);
    process.env.SAFEDEAL_LEGAL_NAME = 'SafeDeal Escrow OÜ';
    expect(safedealLegalName()).toBe('SafeDeal Escrow OÜ');
  });

  it('Dynopay chrome is unchanged', () => {
    const html = baseEmailTemplate('Hi', '<p>x</p>');
    expect(html).toContain(`© Dynopay ${year}. All Rights reserved.`);
    expect(html).not.toContain('© SafeDeal');
  });
});
