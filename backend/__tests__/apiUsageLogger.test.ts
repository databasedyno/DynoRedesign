/**
 * Unit tests: apiUsageLogger middleware (Developers → API keys "Last used" / usage).
 * It was exported but never mounted, so tbl_api_usage_log stayed empty forever.
 */
jest.mock('../utils/loggers', () => ({
  apiLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const apiModel = { findOne: jest.fn(), update: jest.fn().mockResolvedValue([1]) };
jest.mock('../models', () => ({ apiModel }));

jest.mock('../helper/apiKeyToken', () => ({
  looksLikeApiKey: (k: unknown) => typeof k === 'string' && k.startsWith('dpk_'),
  hashApiKey: (k: string) => `hash(${k})`,
}));

import sequelize from '../utils/dbInstance';
import { apiUsageLogger } from '../middleware/apiUsageLogger';

const flush = () => new Promise((r) => setImmediate(r));

const mkReq = (headers: Record<string, string>, extra: Record<string, unknown> = {}) =>
  ({ headers, method: 'GET', originalUrl: '/api/user/getBalance', ip: '1.2.3.4', socket: {}, ...extra } as any);

const mkRes = (statusCode = 200) => {
  const res: any = { statusCode, locals: {} };
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  (sequelize.query as jest.Mock).mockResolvedValue([]);
});

describe('apiUsageLogger', () => {
  it('passes straight through (no DB work) when there is no API key', async () => {
    const next = jest.fn();
    await apiUsageLogger(mkReq({}), mkRes(), next);
    expect(next).toHaveBeenCalled();
    expect(apiModel.findOne).not.toHaveBeenCalled();
  });

  it('bumps last_used_at/request_count atomically and writes a usage row after send', async () => {
    apiModel.findOne.mockResolvedValueOnce({ dataValues: { api_id: 7, company_id: 3 } });
    const next = jest.fn();
    const res = mkRes(200);
    await apiUsageLogger(mkReq({ 'x-api-key': 'dpk_live_abc' }), res, next);

    expect(next).toHaveBeenCalled();
    expect(apiModel.update).toHaveBeenCalledTimes(1);
    const [values, opts] = apiModel.update.mock.calls[0];
    expect(opts).toEqual({ where: { api_id: 7 } });
    expect(values.last_used_at).toBeInstanceOf(Date);
    // atomic SQL increment, not a read-modify-write number
    expect(typeof values.request_count).not.toBe('number');

    res.send('{"ok":true}');
    await flush();
    const insert = (sequelize.query as jest.Mock).mock.calls.find((c) => /INSERT INTO tbl_api_usage_log/.test(c[0]));
    expect(insert).toBeDefined();
    expect(insert![1].replacements).toMatchObject({ api_id: 7, company_id: 3, method: 'GET', status_code: 200, error_message: null });
  });

  it('captures the error message for 4xx/5xx responses', async () => {
    apiModel.findOne.mockResolvedValueOnce({ dataValues: { api_id: 9, company_id: 3 } });
    const res = mkRes(401);
    await apiUsageLogger(mkReq({ 'x-api-key': 'dpk_test_x' }), res, jest.fn());
    res.send(JSON.stringify({ message: 'Invalid API key' }));
    await flush();
    const insert = (sequelize.query as jest.Mock).mock.calls.find((c) => /INSERT INTO tbl_api_usage_log/.test(c[0]));
    expect(insert![1].replacements).toMatchObject({ api_id: 9, status_code: 401, error_message: 'Invalid API key' });
  });

  it('does not log when the key is unknown (no api row)', async () => {
    apiModel.findOne.mockResolvedValueOnce(null);
    const res = mkRes(401);
    await apiUsageLogger(mkReq({ 'x-api-key': 'dpk_live_unknown' }), res, jest.fn());
    res.send('{}');
    await flush();
    expect(apiModel.update).not.toHaveBeenCalled();
    expect((sequelize.query as jest.Mock).mock.calls.some((c) => /tbl_api_usage_log/.test(c[0]))).toBe(false);
  });
});
