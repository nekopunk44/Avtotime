// Avtotime mobile design tokens — dark-first, monochrome premium.
// Import these instead of hard-coding values. See .claude/skills/mobile-ui.
import { StyleSheet } from 'react-native';

export const colors = {
  ink: '#000000',        // pure black (splash, hero backdrops)
  bg: '#0B0B0E',         // app background (near-black)
  surface: '#17181D',    // elevated card / one level up from bg
  surfaceAlt: '#212329', // inputs, chips, secondary elevated
  surfaceHi: '#2B2D35',  // pressed / overlay level
  border: '#2A2C33',     // hairline dividers (define surfaces on dark)

  text: '#F4F5F7',       // primary text
  textMuted: '#9AA0AA',  // secondary text
  textFaint: '#6A6F79',  // captions / placeholders

  // Monochrome accent: white is the "primary". Put dark text/icons on it.
  accent: '#FFFFFF',
  onAccent: '#0B0B0E',
  accentSoft: '#1E2027',  // soft dark bg behind an accent icon

  success: '#3DD68C',
  danger: '#FF5A5F',
  warning: '#F6B23D',
  star: '#F5C518',

  black: '#000000',
  white: '#FFFFFF',
};

// 4-based spacing scale.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const font = { display: 30, h1: 25, h2: 20, h3: 17, body: 15, small: 13, tiny: 11 };

// On dark UIs, elevation reads from the lighter surface colour + a hairline,
// not from a drop shadow.
export const shadow = {
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#24262D',
    shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  float: {
    shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 }, elevation: 10,
  },
};
