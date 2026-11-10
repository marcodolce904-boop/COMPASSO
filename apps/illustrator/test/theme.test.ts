import { describe, expect, it } from 'vitest';
import { themeFor } from '../src/js/main/theme';

describe('tema dall’host (§8.5)', () => {
  it('scuro e chiaro in base alla luminosità', () => {
    expect(themeFor('rgb(50, 50, 50)')).toEqual({ background: 'rgb(50, 50, 50)', theme: 'dark' });
    expect(themeFor('rgb(240.0001, 240, 240)')).toEqual({
      background: 'rgb(240, 240, 240)',
      theme: 'light',
    });
    expect(themeFor('nero')).toBeNull();
  });
});
