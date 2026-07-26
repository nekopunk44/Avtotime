// Avtotime mobile design tokens. Import these instead of hard-coding values so
// the whole app shares one visual language. See .claude/skills/mobile-ui.

export const colors = {
  // Neutrals
  ink: '#0B0B0B',        // near-black surfaces (splash, dark UI, brand)
  text: '#12141A',       // primary text
  textMuted: '#6B7280',  // secondary text
  textFaint: '#9AA3AF',  // captions / placeholders
  bg: '#F4F5F7',         // app background (not pure white — softer)
  surface: '#FFFFFF',    // cards
  surfaceAlt: '#F0F2F5', // filled inputs / chips
  border: '#ECEEF2',     // hairline dividers (use sparingly — prefer shadow)

  // Signature accent (from the logo's electric blue)
  accent: '#0A84FF',
  accentDark: '#0060DF',
  accentSoft: '#E7F1FF',

  // Status
  success: '#12B76A',
  danger: '#F0453A',
  warning: '#F6A609',
  star: '#F5A623',

  black: '#000000',
  white: '#FFFFFF',
};

// 4-based spacing scale — pick from here, don't invent one-off paddings.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

// Font sizes; pair with weight '600' (medium), '800' (bold), '900' (display).
export const font = { display: 28, h1: 24, h2: 20, h3: 17, body: 15, small: 13, tiny: 11 };

// Soft, low-opacity shadows — depth without heavy borders.
export const shadow = {
  card: {
    shadowColor: '#0B1220', shadowOpacity: 0.06, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  float: {
    shadowColor: '#0B1220', shadowOpacity: 0.12, shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
};
