import { maskPhone, resolveLogLevels, shortId } from './logging';

describe('logging helpers', () => {
  it('masks phone numbers but keeps country code and last digits', () => {
    expect(maskPhone('+251911223041')).toBe('+251******041');
    expect(maskPhone('0911223041')).toBe('091****041');
    expect(maskPhone(undefined)).toBe('-');
  });

  it('shortens ids for log lines', () => {
    expect(shortId('8c77d932-3ef8-4a3e-96a3-5a56cf7e3c68')).toBe('8c77d932');
    expect(shortId(null)).toBe('-');
  });

  it('resolves log levels from LOG_LEVEL with environment defaults', () => {
    expect(resolveLogLevels('warn', 'development')).toEqual(['fatal', 'error', 'warn']);
    expect(resolveLogLevels(undefined, 'production')).toEqual(['fatal', 'error', 'warn', 'log']);
    expect(resolveLogLevels('nonsense', 'development')).toContain('debug');
  });
});
