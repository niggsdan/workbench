// 100 fontes do Google Fonts, carregadas só quando usadas.
export const FONTS = ['Plus Jakarta Sans', 'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato', 'Oswald', 'Raleway', 'Nunito',
  'Work Sans', 'Rubik', 'Archivo', 'Archivo Black', 'Anton', 'Bebas Neue', 'Barlow', 'Barlow Condensed', 'Kanit', 'Manrope',
  'DM Sans', 'DM Serif Display', 'Space Grotesk', 'Sora', 'Outfit', 'Urbanist', 'Lexend', 'Figtree', 'Onest', 'Epilogue',
  'Syne', 'Unbounded', 'Chivo', 'IBM Plex Sans', 'IBM Plex Mono', 'JetBrains Mono', 'Space Mono', 'Fira Sans', 'Source Sans 3', 'PT Sans',
  'Merriweather', 'Playfair Display', 'Lora', 'Libre Baskerville', 'EB Garamond', 'Cormorant Garamond', 'Crimson Text', 'Bitter', 'Roboto Slab', 'Zilla Slab',
  'Abril Fatface', 'Alfa Slab One', 'Bodoni Moda', 'Fraunces', 'Instrument Serif', 'Young Serif', 'Gloock', 'Prata', 'Cinzel', 'Spectral',
  'Black Ops One', 'Bungee', 'Bungee Shade', 'Righteous', 'Russo One', 'Teko', 'Saira Condensed', 'Big Shoulders Display', 'Staatliches', 'Fjalla One',
  'Permanent Marker', 'Rock Salt', 'Caveat', 'Caveat Brush', 'Kalam', 'Patrick Hand', 'Shadows Into Light', 'Indie Flower', 'Gloria Hallelujah', 'Amatic SC',
  'Pacifico', 'Lobster', 'Dancing Script', 'Great Vibes', 'Satisfy', 'Sacramento', 'Yellowtail', 'Kaushan Script', 'Allura', 'Parisienne',
  'Press Start 2P', 'VT323', 'Monoton', 'Bungee Inline', 'Rubik Mono One', 'Bowlby One', 'Luckiest Guy', 'Bangers', 'Creepster', 'Special Elite'];
const loaded = new Set(['Plus Jakarta Sans']);
export function loadFont(name, onReady) {
  if (!name || loaded.has(name)) return; loaded.add(name);
  const l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':wght@400;700;800&display=swap';
  l.onload = () => { document.fonts.load('800 40px "' + name + '"').then(() => { if (onReady) onReady(); window.dispatchEvent(new Event('wb-font')); }).catch(() => {}); };
  document.head.appendChild(l);
}
export const TSTYLE = { font: 'Plus Jakarta Sans', size: 5, color: '#ffffff', weight: 800, bg: 1, y: 84, stroke: 0 };
export const tstyle = (p) => ({ ...TSTYLE, ...Object.fromEntries(Object.keys(TSTYLE).filter((k) => p[k] != null).map((k) => [k, p[k]])) });
