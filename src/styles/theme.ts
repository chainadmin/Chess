export const theme = {
  colors: {
    bgTop: '#181229',
    bgBottom: '#0b0a14',
    surface: '#1c1730',
    surfaceAlt: '#241d3d',
    border: '#382f57',
    borderSoft: '#2a2444',
    accent: '#f2b95f',
    accentSoft: '#f2b95f33',
    cyan: '#5be8ef',
    gold: '#e7c56b',
    text: '#f7ead2',
    textDim: '#cdbfe0',
    textFaint: '#8f84ab',
    success: '#7fffa0',
    danger: '#ff8a8a',
    boardLight: '#f0d5a4',
    boardDark: '#8a5a34',
    boardBorder: '#5c3d24',
  },
  radius: { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 },
  space: (n: number) => n * 4,
  font: {
    display: { fontSize: 40, fontWeight: '900' as const, letterSpacing: -0.5 },
    title: { fontSize: 26, fontWeight: '900' as const },
    subtitle: { fontSize: 15, fontWeight: '700' as const },
    body: { fontSize: 15, fontWeight: '500' as const },
    caption: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.6 },
  },
};

export const gradients = {
  app: [theme.colors.bgTop, theme.colors.bgBottom] as const,
  card: ['#241d3dcc', '#1c1730cc'] as const,
  accent: ['#f2c974', '#dc9a3d'] as const,
};
