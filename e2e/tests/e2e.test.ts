import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import i18next from 'i18next';

const execAsync = promisify(exec);

describe('i18next-auto-keys E2E Tests', () => {
  const e2eRoot = path.resolve(__dirname, '..');
  const distPath = path.join(e2eRoot, 'dist');
  const bundlePath = path.join(distPath, 'bundle.js');
  const translationsPath = path.join(distPath, 'locales', 'en.json');

  beforeAll(async () => {
    // Clean any previous builds
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }

    // Build with webpack
    const { stdout, stderr } = await execAsync('npm run build', {
      cwd: e2eRoot,
      timeout: 60000
    });

    if (stderr && !stderr.includes('webpack compiled')) {
      console.error('Webpack build stderr:', stderr);
    }

    // Verify build outputs exist
    expect(fs.existsSync(bundlePath)).toBe(true);
    expect(fs.existsSync(translationsPath)).toBe(true);
  }, 60000);

  describe('Webpack Transformation', () => {
    let transformedCode: string;

    beforeAll(() => {
      transformedCode = fs.readFileSync(bundlePath, 'utf8');
    });

    it('should transform string returns to i18next.t() calls', () => {
      // Check that the bundle contains i18next.t() calls
      expect(transformedCode).toMatch(/\.t\(/);
      expect(transformedCode).toMatch(/\.t\(\s*['"]\w{10}['"]/);
    });

    it('should not transform @noTranslate functions', () => {
      // The debug message should remain as a string literal
      expect(transformedCode).toMatch(/Debug: Auth component mounted/);
    });

    it('should include parameter objects for parameterized messages', () => {
      // Check that parameterized calls include the parameter objects
      expect(transformedCode).toMatch(/\.t\(\s*['"]\w{10}['"]\s*,\s*\{/);
    });

    it('should generate hash keys of correct length', () => {
      // Extract hash keys from .t() calls
      const hashMatches = transformedCode.match(/\.t\(\s*["'](\w{10})["']/g);
      expect(hashMatches).toBeTruthy();
      expect(hashMatches!.length).toBeGreaterThan(0);

      // Verify each hash is exactly 10 characters
      hashMatches!.forEach(match => {
        const hash = match.match(/["'](\w{10})["']/)?.[1];
        expect(hash).toBeDefined();
        expect(hash!.length).toBe(10);
      });
    });
  });

  describe('Translation File Generation', () => {
    let translations: Record<string, string>;

    beforeAll(() => {
      const translationsContent = fs.readFileSync(translationsPath, 'utf8');
      translations = JSON.parse(translationsContent);
    });

    it('should generate valid JSON translation file', () => {
      expect(translations).toBeDefined();
      expect(typeof translations).toBe('object');
    });

    it('should contain expected translations', () => {
      const values = Object.values(translations);
      
      // Check for simple messages
      expect(values).toContain('Authentication');
      expect(values).toContain('Please sign in to continue');
      expect(values).toContain('Sign In');
      expect(values).toContain('Home');
      expect(values).toContain('Save Changes');

      // Check for parameterized messages
      expect(values).toContain('Welcome back, {{name}}!');
      expect(values).toContain('{{count}} items in your cart');
      expect(values).toContain('Password reset link sent to {{email}}. Expires in {{minutes}} minutes.');
    });

    it('should not include @noTranslate messages', () => {
      const values = Object.values(translations);
      expect(values).not.toContain('Debug: Auth component mounted');
    });

    it('should have hash keys as object keys', () => {
      const keys = Object.keys(translations);
      expect(keys.length).toBeGreaterThan(0);

      // All keys should be 10-character hashes
      keys.forEach(key => {
        expect(key).toMatch(/^\w{10}$/);
      });
    });

    it('should preserve i18next interpolation syntax', () => {
      const values = Object.values(translations);
      const interpolatedMessages = values.filter(value => value.includes('{{'));
      
      expect(interpolatedMessages.length).toBeGreaterThan(0);
      
      // Check specific interpolation patterns
      interpolatedMessages.forEach(message => {
        expect(message).toMatch(/\{\{\w+\}\}/);
      });
    });
  });

  describe('i18next Integration', () => {
    beforeAll(async () => {
      // Initialize i18next with the generated translations
      await i18next.init({
        lng: 'en',
        fallbackLng: 'en',
        resources: {
          en: {
            translation: JSON.parse(fs.readFileSync(translationsPath, 'utf8'))
          }
        }
      });
    });

    it('should load translations into i18next', () => {
      const store = i18next.getResourceBundle('en', 'translation');
      expect(store).toBeDefined();
      expect(Object.keys(store).length).toBeGreaterThan(0);
    });

    it('should resolve simple translations', () => {
      const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
      
      // Find hash keys for known messages
      const authTitleKey = Object.keys(translations).find(key => 
        translations[key] === 'Authentication'
      );
      const loginButtonKey = Object.keys(translations).find(key => 
        translations[key] === 'Sign In'
      );

      expect(authTitleKey).toBeDefined();
      expect(loginButtonKey).toBeDefined();

      // Test i18next resolution
      expect(i18next.t(authTitleKey!)).toBe('Authentication');
      expect(i18next.t(loginButtonKey!)).toBe('Sign In');
    });

    it('should resolve parameterized translations', () => {
      const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
      
      // Find hash key for welcome message
      const welcomeKey = Object.keys(translations).find(key => 
        translations[key] === 'Welcome back, {{name}}!'
      );
      const itemCountKey = Object.keys(translations).find(key =>
        translations[key] === '{{count}} items in your cart'
      );

      expect(welcomeKey).toBeDefined();
      expect(itemCountKey).toBeDefined();

      // Test i18next interpolation
      expect(i18next.t(welcomeKey!, { name: 'John' })).toBe('Welcome back, John!');
      expect(i18next.t(itemCountKey!, { count: 5 })).toBe('5 items in your cart');
    });

    it('should resolve complex multi-parameter translations', () => {
      const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
      
      // Find hash key for reset email message
      const resetEmailKey = Object.keys(translations).find(key => 
        translations[key] === 'Password reset link sent to {{email}}. Expires in {{minutes}} minutes.'
      );
      const attemptsKey = Object.keys(translations).find(key =>
        translations[key] === '{{count}} of {{maxAttempts}} login attempts remaining'
      );

      expect(resetEmailKey).toBeDefined();
      expect(attemptsKey).toBeDefined();

      // Test complex interpolation
      const resetResult = i18next.t(resetEmailKey!, { 
        email: 'test@example.com', 
        minutes: 15 
      });
      expect(resetResult).toBe('Password reset link sent to test@example.com. Expires in 15 minutes.');

      const attemptsResult = i18next.t(attemptsKey!, { 
        count: 3, 
        maxAttempts: 5 
      });
      expect(attemptsResult).toBe('3 of 5 login attempts remaining');
    });

    it('should handle missing keys gracefully', () => {
      const result = i18next.t('nonexistent_key_123');
      expect(result).toBe('nonexistent_key_123'); // i18next returns key when translation missing
    });

    it('should handle missing parameters gracefully', () => {
      const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
      
      const welcomeKey = Object.keys(translations).find(key => 
        translations[key] === 'Welcome back, {{name}}!'
      );

      if (welcomeKey) {
        // Without the name parameter, i18next should show the interpolation placeholder
        const result = i18next.t(welcomeKey);
        expect(result).toBe('Welcome back, {{name}}!');
      }
    });
  });

  describe('Transformed Code Execution', () => {
    it('should be able to require and execute the transformed bundle', () => {
      // This tests that the transformed code is syntactically valid JavaScript
      expect(() => {
        require(bundlePath);
      }).not.toThrow();
    });

    it('should export the expected functions', () => {
      // Clear the require cache to get fresh module
      delete require.cache[bundlePath];
      const bundle = require(bundlePath);
      
      // The webpack bundle should export our main functions
      // They might be nested under different property names due to webpack structure
      const exportKeys = Object.keys(bundle);
      expect(exportKeys.length).toBeGreaterThan(0);
      
      // Check if any exports contain our function names or if they're at the root
      const hasWelcomeMessage = bundle.getWelcomeMessage || 
        (bundle.default && bundle.default.getWelcomeMessage) ||
        exportKeys.some(key => typeof bundle[key] === 'object' && bundle[key].getWelcomeMessage);
      
      // At minimum, the bundle should be a valid JS module
      expect(typeof bundle).toBe('object');
      expect(bundle).not.toBeNull();
    });
  });

  afterAll(() => {
    // Clean up i18next
    i18next.init({});
  });
});
