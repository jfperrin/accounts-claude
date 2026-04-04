import { MD3LightTheme, configureFonts } from 'react-native-paper';
import { palette } from './colors';

const fontConfig = {
  displayLarge:   { fontFamily: 'System', fontSize: 57, fontWeight: '400' as const },
  displayMedium:  { fontFamily: 'System', fontSize: 45, fontWeight: '400' as const },
  titleLarge:     { fontFamily: 'System', fontSize: 22, fontWeight: '600' as const },
  titleMedium:    { fontFamily: 'System', fontSize: 16, fontWeight: '600' as const },
  titleSmall:     { fontFamily: 'System', fontSize: 14, fontWeight: '600' as const },
  bodyLarge:      { fontFamily: 'System', fontSize: 16, fontWeight: '400' as const },
  bodyMedium:     { fontFamily: 'System', fontSize: 14, fontWeight: '400' as const },
  bodySmall:      { fontFamily: 'System', fontSize: 12, fontWeight: '400' as const },
  labelLarge:     { fontFamily: 'System', fontSize: 14, fontWeight: '600' as const },
  labelMedium:    { fontFamily: 'System', fontSize: 12, fontWeight: '600' as const },
  labelSmall:     { fontFamily: 'System', fontSize: 11, fontWeight: '600' as const },
};

export const theme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    primary:          palette.indigo500,
    primaryContainer: palette.indigo100,
    secondary:        palette.indigo400,
    background:       palette.gray50,
    surface:          palette.white,
    surfaceVariant:   palette.gray100,
    onPrimary:        palette.white,
    onSurface:        palette.gray900,
    onSurfaceVariant: palette.gray500,
    outline:          palette.gray200,
    error:            palette.red500,
  },
  roundness: 10,
} as const;

export type AppTheme = typeof theme;
export { palette };
