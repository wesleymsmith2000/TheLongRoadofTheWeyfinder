const LEVEL_STYLE_PALETTES = [
  {
    match: /digitized/i,
    palette: { core: '#76f7d4', armor: '#1f8794', gun: '#f7f36a', wheel: '#14545e', engine: '#76a8ff', shadow: 'rgb(0 0 0 / 0.34)' },
  },
  {
    match: /freedom/i,
    palette: { core: '#f7d48a', armor: '#456f93', gun: '#f08a3e', wheel: '#3c596e', engine: '#d58bdc', shadow: 'rgb(0 0 0 / 0.3)' },
  },
  {
    match: /ghost|forrest|forest/i,
    palette: { core: '#c8f4df', armor: '#4f7d69', gun: '#a9d2ff', wheel: '#35584d', engine: '#d8d0ff', shadow: 'rgb(0 0 0 / 0.35)' },
  },
  {
    match: /pirate/i,
    palette: { core: '#ffd37a', armor: '#426078', gun: '#d1523f', wheel: '#293d4f', engine: '#61b8a6', shadow: 'rgb(0 0 0 / 0.34)' },
  },
  {
    match: /shadoweddesert|desert|dessert/i,
    palette: { core: '#f6d18a', armor: '#7e6248', gun: '#e26932', wheel: '#4d4237', engine: '#b38ad8', shadow: 'rgb(0 0 0 / 0.32)' },
  },
  {
    match: /shadowedroad/i,
    palette: { core: '#98d0ff', armor: '#303f57', gun: '#d85c72', wheel: '#212b3a', engine: '#885fb7', shadow: 'rgb(0 0 0 / 0.36)' },
  },
  {
    match: /starlight/i,
    palette: { core: '#f8f0a8', armor: '#425d8e', gun: '#8fdcff', wheel: '#2b3d61', engine: '#d8a4ff', shadow: 'rgb(0 0 0 / 0.34)' },
  },
  {
    match: /twilight/i,
    palette: { core: '#f5bc7a', armor: '#5b527d', gun: '#e57a92', wheel: '#393657', engine: '#7ed3ce', shadow: 'rgb(0 0 0 / 0.34)' },
  },
];

const DEFAULT_ENHANCED_PALETTE = {
  core: '#e7e9aa',
  armor: '#607b8f',
  gun: '#f08a3e',
  wheel: '#3d5260',
  engine: '#9f8bd4',
  shadow: 'rgb(0 0 0 / 0.32)',
};

export function enhancedEnemyPaletteForMusic(trackName) {
  const match = LEVEL_STYLE_PALETTES.find((entry) => entry.match.test(trackName ?? ''));
  return { ...(match?.palette ?? DEFAULT_ENHANCED_PALETTE) };
}
