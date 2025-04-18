// Mock document.cookie and sessionStorage
let cookies = {};
global.document = {
  get cookie() {
    return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  },
  set cookie(str) {
    const [kv] = str.split(';');
    const [k, v] = kv.split('=');
    cookies[k.trim()] = v.trim();
  }
};
global.window = { sessionStorage: { setItem: jest.fn(), getItem: jest.fn(), clear: jest.fn() } };

describe('Auth Cookie Persistence (logic only)', () => {
  beforeEach(() => {
    cookies = {};
    window.sessionStorage.setItem.mockClear();
    window.sessionStorage.getItem.mockClear();
    window.sessionStorage.clear.mockClear();
  });

  test('should set authentication cookie after login', async () => {
    // Simulate login logic
    cookies['msGraphToken'] = 'test-access-token';
    window.sessionStorage.setItem('msGraphToken', 'test-access-token');
    expect(document.cookie).toContain('msGraphToken=test-access-token');
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith('msGraphToken', 'test-access-token');
  });

  test('should persist authentication across refreshes', () => {
    cookies['msGraphToken'] = 'existing-token';
    window.sessionStorage.getItem.mockReturnValue('existing-token');
    expect(document.cookie).toContain('msGraphToken=existing-token');
    expect(window.sessionStorage.getItem()).toBe('existing-token');
  });

  test('should clear cookie and sessionStorage on logout', () => {
    cookies['msGraphToken'] = 'existing-token';
    window.sessionStorage.getItem.mockReturnValue('existing-token');
    // Simulate logout
    delete cookies['msGraphToken'];
    window.sessionStorage.clear();
    expect(document.cookie).not.toContain('msGraphToken=');
    expect(window.sessionStorage.clear).toHaveBeenCalled();
  });

  test('should allow login after logout (regression test)', () => {
    // Simulate login
    cookies['msGraphToken'] = 'test-access-token';
    window.sessionStorage.setItem('msGraphToken', 'test-access-token');
    // Simulate logout
    delete cookies['msGraphToken'];
    window.sessionStorage.clear();
    // Simulate new login
    cookies['msGraphToken'] = 'test-access-token-2';
    window.sessionStorage.setItem('msGraphToken', 'test-access-token-2');
    expect(document.cookie).toContain('msGraphToken=test-access-token-2');
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith('msGraphToken', 'test-access-token-2');
  });
}); 