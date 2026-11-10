// Catálogo de efeitos, texturas, sons e Auto-FX. Parte pura (sem DOM).
import { phraseNear, pauses } from './transcript.js';
// Os textos e parâmetros seguem o preview aprovado.

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const r1 = (t) => Math.round(t * 10) / 10;
const r2 = (t) => Math.round(t * 100) / 100;
export const FPS = 30;

export const DIRS = ['para a esquerda', 'para cima', 'para a direita', 'para baixo'];

export const SOUNDS = [
  { key: 'whoosh', name: 'Whoosh curto 02', dur: 0.5 },
  { key: 'riser', name: 'Riser + swoosh', dur: 1.4 },
  { key: 'swoosh', name: 'Swoosh', dur: 0.5 },
  { key: 'impact', name: 'Impacto seco', dur: 0.6 },
  { key: 'pop', name: 'Pop leve', dur: 0.25 },
  { key: 'ding', name: 'Ding', dur: 1.0 },
  { key: 'projector', name: 'Ruído de projetor', dur: 2.0 }
];
export const soundName = (k) => (SOUNDS.find((s) => s.key === k) || SOUNDS[0]).name;

// y dos keyframes é a altura numa caixa de 40: menor = mais forte (como no preview)
export const KF_BASE = 36; export const KF_PEAK = 4;

export const TECH = [
  { key: 'whip', name: 'WHIP PAN', hint: 'Panorâmica rápida com blur direcional', badge: 'Ajuste', len: 0.8,
    params: [{ k: 'blur', label: 'Blur direcional', min: 0, max: 100, def: 70, unit: '%' }, { k: 'frames', label: 'Duração', min: 2, max: 24, def: 8, unit: 'quadros', len: true }, { k: 'dir', label: 'Direção', min: 0, max: 3, def: 2, unit: 'dir' }],
    kf: [{ x: 0, y: 36 }, { x: 35, y: 6 }, { x: 65, y: 6 }, { x: 100, y: 36 }],
    sfx: { key: 'whoosh', off: -0.1, vol: -8, when: 'Entra 3 quadros antes' },
    recipe: 'A cena de baixo desliza na horizontal em 8 quadros com blur direcional. O whoosh entra 3 quadros antes do corte.' },
  { key: 'speed', name: 'SPEED RAMP', hint: 'Rampa de velocidade no tempo', badge: 'Ajuste', len: 2.5,
    params: [{ k: 'max', label: 'Velocidade máxima', min: 100, max: 400, def: 300, unit: '%' }, { k: 'in', label: 'Entrada da rampa', min: 0.1, max: 1.5, def: 0.4, unit: 's', dec: 1 }, { k: 'out', label: 'Saída da rampa', min: 0.1, max: 1.5, def: 0.6, unit: 's', dec: 1 }],
    kf: [{ x: 0, y: 34 }, { x: 28, y: 34 }, { x: 50, y: 5 }, { x: 76, y: 34 }, { x: 100, y: 34 }],
    sfx: { key: 'riser', off: -1.2, vol: -10, when: 'Entra 1,2 s antes' },
    recipe: 'Remapeamento de tempo de 100% para 300% e de volta, com curva suave. O áudio da cena abaixa durante a rampa.' },
  { key: 'flash', name: 'FLASH CUT', hint: 'Quadro branco de 2 a 3 quadros', badge: 'Ajuste', len: 0.4,
    params: [{ k: 'bright', label: 'Brilho do flash', min: 10, max: 100, def: 85, unit: '%' }, { k: 'frames', label: 'Duração', min: 2, max: 8, def: 3, unit: 'quadros', len: true }],
    kf: [{ x: 0, y: 36 }, { x: 20, y: 4 }, { x: 100, y: 36 }],
    sfx: { key: 'impact', off: 0, vol: -6, when: 'Entra junto com o efeito' },
    recipe: 'Quadro branco de 3 quadros em cima do corte, entrada seca e saída rápida. O impacto bate no primeiro quadro.' },
  { key: 'zoom', name: 'ZOOM', hint: 'Zoom de ênfase na palavra', badge: 'Ajuste', len: 2,
    params: [{ k: 'scale', label: 'Escala final', min: 100, max: 300, def: 115, unit: '%' }, { k: 'curve', label: 'Curva', min: 0, max: 3, def: 1, unit: 'curve' }],
    kf: [{ x: 0, y: 36 }, { x: 70, y: 8 }, { x: 100, y: 8 }],
    sfx: { key: 'pop', off: -0.03, vol: -12, when: 'Entra 1 quadro antes' },
    recipe: 'Escala de 100% para 115% em 10 quadros, com ease out. Volta ao normal no próximo corte.' },
  { key: 'freeze', name: 'FREEZE FRAME', hint: 'Congela o quadro e segura', badge: 'Ajuste', len: 1,
    params: [{ k: 'hold', label: 'Tempo parado', min: 0.2, max: 4, def: 1, unit: 's', dec: 1, len: 's' }, { k: 'bw', label: 'Tirar a cor', min: 0, max: 100, def: 0, unit: '%' }],
    kf: [], sfx: { key: 'impact', off: 0, vol: -10, when: 'Entra junto com o efeito' },
    recipe: 'O quadro do início do efeito fica parado pelo tempo escolhido, depois a cena segue.' },
  { key: 'jump', name: 'JUMP CUT', hint: 'Tira pausa e respiro da fala', badge: 'Ajuste', len: 0.6,
    params: [], kf: [], sfx: null,
    recipe: 'Pula o trecho marcado: o vídeo vai direto do começo pro fim do efeito, e o filme fica mais curto.' },
  { key: 'split', name: 'SPLIT SCREEN', hint: 'Vídeo ao vivo e o quadro do início, lado a lado', badge: 'Ajuste', len: 3,
    params: [{ k: 'pos', label: 'Posição da divisória', min: 20, max: 80, def: 50, unit: '%' }],
    kf: [], sfx: null,
    recipe: 'Divide o quadro em duas metades: o vídeo ao vivo em cima e o quadro do começo do efeito embaixo.' },
  { key: 'dolly', name: 'DOLLY', hint: 'Pede cena com câmera deslizando', badge: 'Linguagem', len: 2, language: true,
    params: [], kf: [], sfx: null,
    recipe: 'Marcador de linguagem: lembra que aqui entra uma cena com câmera deslizando. Não altera a imagem.' }
];


// Técnicas do Eyecandy produzidas aqui (além das acima). y dos keyframes: menor = mais forte.
const P = (k, label, min, max, def, unit, extra = {}) => ({ k, label, min, max, def, unit, ...extra });
const FADE = [{ x: 0, y: 36 }, { x: 12, y: 4 }, { x: 88, y: 4 }, { x: 100, y: 36 }];
const HOLD = [{ x: 0, y: 4 }, { x: 100, y: 4 }];
const T2 = (key, name, hint, len, params, recipe, kf = HOLD, sfx = null) => ({ key, name, hint, badge: 'Ajuste', len, params, kf: kf.map((k) => ({ ...k })), sfx, recipe });
TECH.push(
  T2('slow', 'SLOW MOTION', 'Câmera lenta', 2, [P('rate', 'Velocidade', 20, 90, 50, '%')], 'O trecho toca mais devagar. Fica mais liso em vídeo gravado com muitos quadros por segundo (60 ou 120).'),
  T2('fast', 'FAST MOTION', 'Tempo acelerado', 2, [P('rate', 'Velocidade', 150, 400, 250, '%')], 'O trecho toca mais rápido, o filme fica mais curto nesse ponto.'),
  T2('dutch', 'DUTCH ANGLE', 'Horizonte torto', 2, [P('deg', 'Inclinação', -30, 30, 12, '°'), P('scale', 'Zoom pra esconder bordas', 100, 160, 125, '%')], 'Gira o quadro e aproxima pra não aparecer borda preta.', FADE),
  T2('roll', 'CAMERA ROLL', 'Quadro gira no próprio eixo', 1.5, [P('turns', 'Voltas', 25, 200, 100, '%'), P('scale', 'Zoom pra esconder bordas', 100, 200, 150, '%')], 'O quadro gira em volta do centro, com aceleração no começo e freio no fim.'),
  T2('handheld', 'HANDHELD', 'Câmera na mão', 3, [P('amt', 'Tremida', 5, 100, 40, '%'), P('speed', 'Velocidade', 20, 100, 50, '%')], 'Tremida suave e irregular, como câmera no ombro. Aproxima um pouco pra não aparecer borda.', FADE),
  T2('wiggle', 'WIGGLEGRAM', 'Vai e volta entre dois ângulos', 2, [P('amt', 'Distância', 5, 100, 40, '%'), P('frames', 'Troca a cada', 2, 8, 3, 'quadros')], 'Alterna o quadro pra esquerda e pra direita em poucos quadros, como foto 3D caseira.'),
  T2('colorshift', 'COLOR SHIFT', 'Cor que gira', 2, [P('speed', 'Giro por segundo', 10, 360, 120, '°'), P('sat', 'Saturação', 100, 250, 140, '%')], 'A matiz gira ao longo do trecho e a saturação sobe.', FADE),
  T2('double', 'DOUBLE EXPOSURE', 'Duas imagens sobrepostas', 2, [P('mix', 'Mistura', 10, 90, 50, '%'), P('delay', 'Atraso da segunda', 2, 30, 12, 'quadros')], 'Sobrepõe o quadro atual com um quadro de instantes antes, em modo Screen.', FADE),
  T2('echo', 'ECHO PRINT', 'Rastro dos quadros anteriores', 2, [P('n', 'Rastros', 2, 8, 5, 'quadros'), P('amt', 'Intensidade', 10, 100, 60, '%')], 'Cada quadro carrega o fantasma dos anteriores, cada vez mais fraco.', FADE),
  T2('mblur', 'MOTION BLUR', 'Borrão de movimento', 2, [P('amt', 'Intensidade', 10, 95, 60, '%')], 'Mistura o quadro com o anterior, então tudo que se mexe borra.', FADE),
  T2('step', 'STEP-PRINT', 'Movimento picotado', 2, [P('hold', 'Segura cada quadro', 2, 8, 3, 'quadros')], 'Segura cada quadro por vários quadros, como filme rodado em velocidade baixa.'),
  T2('stutter', 'STUTTER', 'Gagueira de imagem', 1.5, [P('len', 'Pedaço repetido', 2, 12, 6, 'quadros')], 'Repete um pedacinho de poucos quadros em loop enquanto dura o trecho.'),
  T2('glitch', 'FEEDBACK', 'Glitch e sinal quebrado', 1, [P('amt', 'Intensidade', 10, 100, 60, '%')], 'Separa as cores e desloca faixas horizontais da imagem, aleatórias a cada quadro.', FADE, { key: 'swoosh', off: 0, vol: -14, when: 'Entra junto com o efeito' }),
  T2('datamosh', 'DATAMOSH', 'Compressão quebrada', 1.5, [P('amt', 'Intensidade', 10, 100, 70, '%'), P('block', 'Tamanho dos blocos', 8, 64, 24, 'px')], 'O quadro novo só entra em alguns blocos, o resto arrasta o quadro anterior, como vídeo corrompido.', FADE),
  T2('kaleido', 'KALEIDOSCOPE', 'Imagem espelhada em fatias', 2, [P('n', 'Fatias', 4, 12, 6, ''), P('spin', 'Giro', 0, 100, 20, '%')], 'Recorta uma fatia do quadro e espelha em volta do centro.', FADE),
  T2('dup', 'DUPLICATION', 'Quadro repetido em grade', 2, [P('n', 'Grade', 2, 4, 2, '×')], 'Repete o quadro inteiro numa grade.'),
  T2('pip', 'SCREEN IN SCREEN', 'Um vídeo dentro do outro', 3, [P('size', 'Tamanho', 20, 60, 35, '%'), P('pos', 'Canto', 0, 3, 1, 'corner'), P('delay', 'Atraso', 0, 30, 15, 'quadros')], 'Uma janela menor com o mesmo vídeo atrasado, num dos cantos.'),
  T2('fisheye', 'FISHEYE', 'Lente olho de peixe', 2, [P('amt', 'Curvatura', 10, 100, 55, '%')], 'Estica o centro e dobra as bordas, como lente olho de peixe.', FADE),
  T2('pixel', 'PIXEL ART', 'Pixels grandes', 2, [P('size', 'Tamanho do pixel', 4, 40, 12, 'px')], 'Reduz a imagem e amplia sem suavizar.', FADE),
  T2('tiltshift', 'TILT SHIFT', 'Efeito de miniatura', 3, [P('pos', 'Altura da faixa', 10, 90, 55, '%'), P('blur', 'Desfoque', 2, 20, 8, 'px'), P('sat', 'Saturação', 100, 200, 135, '%')], 'Só uma faixa fica em foco, em cima e embaixo borram, e a cor fica viva como maquete.'),
  T2('shallow', 'SHALLOW FOCUS', 'Fundo desfocado', 3, [P('blur', 'Desfoque', 2, 20, 8, 'px'), P('size', 'Área em foco', 20, 80, 45, '%')], 'Mantém o centro nítido e desfoca as bordas, imitando pouca profundidade de campo.', FADE),
  T2('focal', 'FOCAL SHIFT', 'Foco que vai e volta', 2, [P('blur', 'Desfoque máximo', 2, 24, 10, 'px')], 'Desfoca e volta a focar seguindo os keyframes.', [{ x: 0, y: 36 }, { x: 50, y: 4 }, { x: 100, y: 36 }]),
  T2('spotlight', 'SPOTLIGHT', 'Luz num ponto', 3, [P('r', 'Raio', 10, 80, 35, '%'), P('dark', 'Escuridão', 20, 100, 80, '%')], 'Escurece tudo fora de um círculo de luz no centro.', FADE),
  T2('silhouette', 'SILHOUETTE', 'Assunto preto contra a luz', 2, [P('amt', 'Intensidade', 20, 100, 80, '%')], 'Contraste no máximo e brilho baixo: quem está na frente da luz vira sombra.', FADE),
  T2('hardlight', 'HARD LIGHT', 'Luz dura', 2, [P('amt', 'Intensidade', 10, 100, 60, '%')], 'Mais contraste e um pouco mais de saturação, sombras recortadas.', FADE),
  T2('haze', 'HAZE', 'Névoa', 3, [P('amt', 'Intensidade', 10, 100, 55, '%')], 'Pretos lavados, contraste baixo e um véu de luz.', FADE),
  T2('lightflash', 'LIGHT FLASH', 'Clarão quente', 0.6, [P('bright', 'Brilho', 20, 100, 80, '%')], 'Um clarão quente que cresce e some rápido.', [{ x: 0, y: 36 }, { x: 30, y: 4 }, { x: 100, y: 36 }], { key: 'impact', off: 0, vol: -12, when: 'Entra junto com o efeito' }),
  T2('night', 'NIGHT VISION', 'Visão noturna', 2, [P('amt', 'Intensidade', 30, 100, 90, '%')], 'Imagem monocromática verde, clara e com grão, com vinheta circular.', FADE),
  T2('thermal', 'THERMAL', 'Câmera térmica', 2, [P('amt', 'Intensidade', 30, 100, 100, '%')], 'Troca a luz por cores de calor: escuro vira azul, claro vira amarelo e branco.', FADE),
  T2('xray', 'X-RAY', 'Raio-X', 2, [P('amt', 'Intensidade', 30, 100, 100, '%')], 'Negativo em preto e branco com tom frio e contraste alto.', FADE),
  T2('ratio', 'RATIO SWITCH', 'Formato que muda', 2, [P('to', 'Faixas pretas', 5, 45, 22, '%')], 'Faixas pretas entram em cima e embaixo e mudam o formato do quadro no meio do vídeo.', [{ x: 0, y: 36 }, { x: 25, y: 4 }, { x: 100, y: 4 }]),
  { key: 'lang', name: 'LINGUAGEM', hint: 'Marcador de linguagem', badge: 'Linguagem', len: 2, language: true, params: [], kf: [], sfx: null, recipe: '' }
);

export const TEXKEYS = {
  grain: 'Grão', dust: 'Poeira e riscos', jitter: 'Tremida de projetor', flicker: 'Flicker', halation: 'Halation',
  softness: 'Suavidade de lente', vignette: 'Vinheta', leak: 'Vazamento de luz', tracking: 'Tracking e ruído de fita', frame: 'Moldura de película', fade: 'Cor desbotada', paper: 'Papel', grunge: 'Grunge', scratch: 'Riscos de filme', burn: 'Queimado de filme', bokeh: 'Bokeh', halftone: 'Meio-tom'
};
export const TEXTURES = [
  { key: 'super8', name: 'SUPER 8', hint: 'Grão alto, tremida, poeira e flicker', badge: 'Preset', set: { grain: 62, dust: 40, jitter: 24, flicker: 18, halation: 30 },
    recipe: 'Grão de tamanho médio com textura de filme, poeira e riscos aleatórios, leve tremida de quadro e flicker. Tudo gerado aqui, sem arquivo.', sfx: { key: 'projector', off: 0, vol: -26, when: 'Em loop, do começo ao fim' } },
  { key: '8mm', name: '8 MM', hint: 'Grão grosso, moldura, tremida e cor desbotada', badge: 'Preset', set: { grain: 75, dust: 55, jitter: 35, flicker: 25, frame: 60, fade: 45, vignette: 30 },
    recipe: 'Filme 8 mm caseiro: grão grosso, poeira, tremida de projetor, cantos arredondados de película e cor desbotada puxando pro quente. Gerado aqui, sem arquivo.', sfx: { key: 'projector', off: 0, vol: -24, when: 'Em loop, do começo ao fim' } },
  { key: 'moldura', name: 'MOLDURA DE PELÍCULA', hint: 'Cantos arredondados e borda de filme', badge: 'Gerado', set: { frame: 70 }, recipe: 'Borda escura com cantos arredondados, como a janela do projetor.' },
  { key: '16mm', name: '16 MM', hint: 'Grão médio, cor suave, leve tremida', badge: 'Preset', set: { grain: 45, softness: 15, jitter: 10, halation: 12 }, recipe: 'Grão médio, cor suave e uma tremida leve de quadro.' },
  { key: '35mm', name: '35 MM', hint: 'Grão fino e brilho nas luzes fortes', badge: 'Preset', set: { grain: 30, halation: 35, softness: 20, vignette: 25 }, recipe: 'Grão fino, brilho suave ao redor das luzes mais fortes e um pouco de suavidade de lente.' },
  { key: 'vhs', name: 'VHS', hint: 'Ruído de fita, borda mole e tracking', badge: 'Preset', set: { grain: 25, tracking: 55, softness: 45, flicker: 10 }, recipe: 'Faixas de tracking, ruído de fita e bordas moles.' },
  { key: 'papel', name: 'PAPEL', hint: 'Fibra de papel mexendo, cara de impresso', badge: 'Animada', set: { paper: 55 }, recipe: 'Textura de papel gerada aqui, que muda de lugar a cada quadro como se fosse impressa e filmada.' },
  { key: 'grunge', name: 'GRUNGE', hint: 'Manchas e sujeira que pulsam', badge: 'Animada', set: { grunge: 50 }, recipe: 'Manchas escuras irregulares, trocando a cada poucos quadros.' },
  { key: 'riscos', name: 'RISCOS DE FILME', hint: 'Riscos fortes e fios de cabelo na película', badge: 'Animada', set: { scratch: 60, dust: 25 }, recipe: 'Riscos verticais que atravessam o quadro, fios e poeira, novos a cada quadro.' },
  { key: 'queimado', name: 'QUEIMADO DE FILME', hint: 'Película queimando nas bordas', badge: 'Animada', set: { burn: 65 }, recipe: 'Manchas laranja e brancas que crescem das bordas, como filme queimando no projetor.' },
  { key: 'bokeh', name: 'BOKEH', hint: 'Bolas de luz desfocadas passando', badge: 'Animada', set: { bokeh: 55 }, recipe: 'Círculos de luz desfocados flutuando devagar por cima da imagem.' },
  { key: 'meiotom', name: 'MEIO-TOM', hint: 'Pontos de impressão, estilo jornal', badge: 'Animada', set: { halftone: 60 }, recipe: 'Transforma a imagem em pontos de impressão que acompanham o vídeo.' },
  { key: 'grao', name: 'GRÃO', hint: 'Ruído de filme, tamanho e intensidade', badge: 'Gerado', set: { grain: 50 }, recipe: 'Ruído de filme sobre a imagem inteira.' },
  { key: 'poeira', name: 'POEIRA E RISCOS', hint: 'Partículas e riscos aleatórios', badge: 'Gerado', set: { dust: 50 }, recipe: 'Partículas e riscos aleatórios, novos a cada quadro.' },
  { key: 'halation', name: 'HALATION', hint: 'Brilho avermelhado nas luzes', badge: 'Gerado', set: { halation: 50 }, recipe: 'Brilho avermelhado ao redor das luzes fortes.' },
  { key: 'leak', name: 'LIGHT LEAK', hint: 'Vazamento de luz nas bordas', badge: 'Gerado', set: { leak: 55 }, recipe: 'Vazamento de luz quente que passa pelas bordas.' },
  { key: 'vinheta', name: 'VINHETA', hint: 'Escurece as bordas', badge: 'Gerado', set: { vignette: 45 }, recipe: 'Escurece as bordas do quadro.' }
];
// Onde baixar overlays 8mm gratuitos. Nada disso fica no Workbench: você baixa, põe na pasta Overlays e eles aparecem aqui.
export const PACKS_8MM = [
  { name: 'Film Looks', url: 'https://shop.filmlooks.com/', what: 'Scans reais de Super 8 e 16 mm: leaders, light leaks, poeira e riscos. Tem packs gratuitos e pagos.' },
  { name: 'Hyper Projector', url: 'https://hyperprojector.gumroad.com/l/yOnWz', what: 'Grão 8 mm Kodak em 4K, preço livre (pode baixar por 0).' },
  { name: 'Dissolve', url: 'https://dissolve.com/goodies', what: 'Grão 8 mm filmado em película, em quatro intensidades. Grátis com cadastro.' },
  { name: 'Vecteezy', url: 'https://www.vecteezy.com/free-videos/8mm-film-overlay', what: 'Muitos overlays 8 mm. A versão grátis pede crédito ao autor.' }
];
// Texturelabs: texturas grátis (uso comercial ok), mas a licença proíbe colocar dentro de app. Você baixa e põe na pasta Overlays.
export const TEXTURELABS = [['Film', 681], ['Grunge', 663], ['Paper', 666], ['Lens Effects', 688], ['Atmosphere', 744], ['Details', 719], ['Ink/Paint', 669], ['Fabric', 675], ['Concrete', 693], ['Glass', 732], ['Water', 735], ['Metal', 697]].map(([name, ct]) => ({ name, url: 'https://texturelabs.org?ct=' + ct }));
export const BLENDS = ['screen', 'overlay', 'multiply', 'soft-light'];
export const BLEND_LABEL = ['Screen (clareia)', 'Overlay (contraste)', 'Multiplicar (escurece)', 'Luz suave'];
export const ANIM_LABEL = ['parada', 'tremida de filme', 'deslizando'];
export const OVERLAY = { key: 'overlay', name: 'OVERLAY', hint: 'Vídeo da tua biblioteca, com modo de mistura', badge: 'Arquivo' };

export const CINEMA = [
  { key: 'cdd', name: 'CIDADE DE DEUS', dir: 'Dir. Fernando Meirelles', look: 'super8-35' },
  { key: 'aflp', name: 'AMOR À FLOR DA PELE', dir: 'Dir. Wong Kar-wai', look: '35' },
  { key: 'moon', name: 'MOONLIGHT', dir: 'Dir. Barry Jenkins', look: '16' }
];
export const CINEMA_SITES = [['Film Grab', 'https://film-grab.com/?s='], ['Flim', 'https://flim.ai/'], ['Movies in Color', 'https://moviesincolor.com/?s=']];

export const PLATFORMS = [
  { key: 'youtube', label: 'YouTube · longo', ratio: '16:9', density: 0.2, res: '1080p' },
  { key: 'tiktok', label: 'TikTok · cortes', ratio: '9:16', density: 0.5, res: '1080p' },
  { key: 'instagram', label: 'Instagram · trechos', ratio: '4:5', density: 0.35, res: '1080p' }
];

export const TEXT_VARIANTS = { tarja: 'Tarja', legenda: 'Legenda' };

// ---------- itens ----------
let seq = 0;
export const newId = () => 'f' + Date.now().toString(36) + (++seq);
export const techOf = (key) => TECH.find((t) => t.key === key);
export const texOf = (key) => TEXTURES.find((t) => t.key === key);

const defParams = (defs) => Object.fromEntries(defs.map((p) => [p.k, p.def]));

export function newTech(key, a, duration) {
  const t = techOf(key);
  const item = { id: newId(), kind: 'tec', key, name: t.name, a: r2(a), b: r2(Math.min(duration, a + t.len)), params: defParams(t.params), kf: t.kf.map((k) => ({ ...k })),
    sfx: t.sfx ? { key: t.sfx.key, off: t.sfx.off, vol: t.sfx.vol } : null, why: 'Adicionado por você no playhead.', auto: false, accepted: true };
  return syncLen(item);
}
export function newLang(ref, a, duration) {
  return { id: newId(), kind: 'tec', key: 'lang', name: ref.name.toUpperCase(), slug: ref.slug, hint: ref.hint, a: r2(a), b: r2(Math.min(duration, a + 2)), params: {}, kf: [], sfx: null,
    why: 'Marcado por você: aqui entra um plano de ' + ref.name + '.', auto: false, accepted: true };
}
export function newTexture(key, a, duration) {
  const t = texOf(key);
  return { id: newId(), kind: 'tx', key, name: t.name, a: r2(a), b: r2(duration), params: { ...t.set }, kf: [], sfx: t.sfx ? { key: t.sfx.key, off: 0, vol: t.sfx.vol } : null,
    why: 'Adicionado por você.', auto: false, accepted: true };
}
export function newOverlay(libId, name, a, duration) {
  const img = /\.(png|jpe?g|webp|gif|bmp|tiff?|avif)$/i.test(name);
  return { id: newId(), kind: 'ov', key: 'overlay', name: img ? 'TEXTURA' : 'OVERLAY', lib: libId, file: name, a: r2(a), b: r2(duration), params: { opacity: img ? 45 : 60, scale: 100, speed: 100, blend: img ? 1 : 0, anim: img ? 1 : 0 }, kf: [], sfx: null,
    credit: { required: true, creator: '' }, why: 'Arquivo da tua pasta Overlays, em modo Screen e em loop sobre o vídeo.', auto: false, accepted: true };
}
export function newText(variant, a, duration) {
  const tarja = variant === 'tarja';
  return { id: newId(), kind: 'tt', key: variant, name: TEXT_VARIANTS[variant], a: r2(a), b: r2(Math.min(duration, a + 3)), params: { text: tarja ? 'Título da tarja' : 'Texto da legenda', sub: tarja ? 'Subtítulo' : '' }, kf: [], sfx: null,
    why: 'Adicionado por você.', auto: false, accepted: true };
}
export function newSound(key, a, duration) {
  const s = SOUNDS.find((x) => x.key === key) || SOUNDS[0];
  return { id: newId(), kind: 'sx', key: s.key, name: s.name, a: r2(a), b: r2(Math.min(duration, a + s.dur)), params: {}, kf: [], sfx: { key: s.key, off: 0, vol: -8 }, why: 'Som avulso.', auto: false, accepted: true };
}

// parâmetros que mexem no comprimento do item (Duração em quadros, tempo parado)
export function syncLen(item) {
  if (item.kind !== 'tec') return item;
  const t = techOf(item.key); if (!t) return item;
  for (const p of t.params) {
    if (p.len === true) item.b = r2(item.a + item.params[p.k] / FPS);
    else if (p.len === 's') item.b = r2(item.a + item.params[p.k]);
  }
  return item;
}

export const paramDefs = (item) => {
  if (item.kind === 'tec') return (techOf(item.key) || { params: [] }).params;
  if (item.kind === 'tx') return Object.keys(item.params).map((k) => ({ k, label: TEXKEYS[k] || k, min: 0, max: 100, def: 0, unit: '%' }));
  if (item.kind === 'mk') return [{ k: 'feather', label: 'Borda suave', min: 0, max: 100, def: 25, unit: '%' }, { k: 'amount', label: item.key === 'blur' ? 'Desfoque' : 'Intensidade', min: 0, max: 100, def: 75, unit: '%' }];
  if (item.kind === 'ov') return [{ k: 'opacity', label: 'Opacidade', min: 0, max: 100, def: 60, unit: '%' }, { k: 'blend', label: 'Mistura', min: 0, max: 3, def: 0, unit: 'blend' }, { k: 'anim', label: 'Movimento', min: 0, max: 2, def: 0, unit: 'anim' }, { k: 'scale', label: 'Escala', min: 50, max: 200, def: 100, unit: '%' }, { k: 'speed', label: 'Velocidade', min: 25, max: 300, def: 100, unit: '%' }];
  return [];
};
export const CURVES = ['linear', 'ease out', 'ease in-out', 'crash (rápido)'];
export function fmtParam(def, v) {
  if (def.unit === 'dir') return DIRS[Math.round(v)] || '';
  if (def.unit === 'blend') return BLEND_LABEL[Math.round(v)] || '';
  if (def.unit === 'anim') return ANIM_LABEL[Math.round(v)] || '';
  if (def.unit === 'curve') return CURVES[Math.round(v)] || '';
  if (def.unit === '%') return Math.round(v) + '%';
  if (def.unit === '°') return Math.round(v) + '°';
  if (def.unit === '') return String(Math.round(v));
  if (def.unit === '×') return Math.round(v) + ' × ' + Math.round(v);
  if (def.unit === 'px') return Math.round(v) + ' px';
  if (def.unit === 'corner') return ['canto superior esquerdo', 'canto superior direito', 'canto inferior esquerdo', 'canto inferior direito'][Math.round(v)] || '';
  if (def.unit === 's') return String(Number(v).toFixed(def.dec == null ? 1 : def.dec)).replace('.', ',') + ' s';
  return Math.round(v) + ' ' + def.unit;
}
export const pctOf = (def, v) => clamp((v - def.min) / (def.max - def.min)) * 100;

export const recipeOf = (item) => {
  if (item.kind === 'tec' && (item.key === 'lang' || item.key === 'dolly')) return 'Marcador de linguagem: ' + (item.hint || 'câmera deslizando') + '. Não altera a imagem, é o lembrete de filmar ou montar esse trecho assim. A referência abre no Eyecandy.';
  if (item.kind === 'tec') { const t = techOf(item.key); return t ? t.recipe : ''; }
  if (item.kind === 'tx') { const t = texOf(item.key); return t ? t.recipe : ''; }
  if (item.kind === 'ov') return 'Arquivo da tua pasta Overlays por cima do vídeo, no modo de mistura escolhido' + (item.name === 'TEXTURA' ? ', com movimento quadro a quadro pra parecer filmado' : ', em loop') + '. O arquivo não fica no Workbench.';
  if (item.kind === 'mk') return { mask: 'Escurece tudo fora da forma e isola o que está dentro.', blur: 'Desfoca o que está dentro da forma. Inverter desfoca o fundo e deixa a forma nítida.', crop: 'Corta tudo fora da forma (fica preto), com borda suave.', spot: 'Escurece em volta e dá uma luz quente no que está dentro.' }[item.key];
  if (item.kind === 'tt') return item.key === 'tarja' ? 'Barra com título e subtítulo no terço de baixo do quadro.' : 'Legenda centralizada no pé do quadro.';
  return 'Som sintetizado no navegador, sem arquivo.';
};
export const kindLabel = (item) => ({ mk: 'Máscara no vídeo · keyframes', tec: item.key === 'dolly' || item.key === 'lang' ? 'Marcador · linguagem' : 'Camada de ajuste · técnica', tx: 'Camada de ajuste · textura e lente', ov: 'Overlay em vídeo', tt: 'Texto', sx: 'Som avulso' }[item.kind]);

// ---------- matemática do efeito ----------
// força 0..1 do efeito em p (0..1 ao longo do item), pelos keyframes
export function envelope(item, p) {
  const k = item.kf && item.kf.length ? [...item.kf].sort((a, b) => a.x - b.x) : null;
  if (!k) return 1;
  const x = clamp(p) * 100;
  let y;
  if (x <= k[0].x) y = k[0].y;
  else if (x >= k[k.length - 1].x) y = k[k.length - 1].y;
  else { let i = 0; while (x > k[i + 1].x) i++; const u = (x - k[i].x) / ((k[i + 1].x - k[i].x) || 1); y = k[i].y + (k[i + 1].y - k[i].y) * u; }
  return clamp((KF_BASE - y) / (KF_BASE - KF_PEAK));
}
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

// Estado visual dos efeitos ativos em t. Devolve { zoom, blurPx, dx, dy, flash, rate, skipTo, freezeAt, bw, split, active:[ids] }
export function fxState(items, t, W = 1) {
  const o = { zoom: 1, blur: 0, dir: [0, 0], offset: [0, 0], flash: 0, rate: 1, skipTo: null, freeze: null, bw: 0, split: null, active: [], looks: [] };
  for (const it of items) {
    if (it.kind !== 'tec' || t < it.a || t >= it.b) continue;
    const p = clamp((t - it.a) / Math.max(0.001, it.b - it.a));
    const e = envelope(it, p);
    o.active.push(it.id);
    if (it.key === 'whip') {
      const d = Math.round(it.params.dir); const v = [[-1, 0], [0, -1], [1, 0], [0, 1]][d] || [1, 0];
      o.blur = Math.max(o.blur, (it.params.blur / 100) * e); o.dir = v;
      o.offset = [v[0] * e * 0.12, v[1] * e * 0.12]; // fração do quadro
    } else if (it.key === 'flash') o.flash = Math.max(o.flash, (it.params.bright / 100) * e);
    else if (it.key === 'zoom') {
      const c = Math.round(it.params.curve); const u = clamp(p / 0.7);
      const k = c === 0 ? u : c === 1 ? easeOut(u) : c === 2 ? easeInOut(u) : easeOut(clamp(p / 0.12));
      o.zoom *= 1 + (it.params.scale / 100 - 1) * k;
    } else if (it.key === 'speed') {
      const len = it.b - it.a; const tin = Math.min(it.params.in, len / 2); const tout = Math.min(it.params.out, len / 2);
      const dt = t - it.a; let k = 1;
      if (dt < tin) k = dt / tin; else if (dt > len - tout) k = (it.b - t) / tout;
      o.rate = 1 + (it.params.max / 100 - 1) * easeInOut(clamp(k));
    } else if (it.key === 'jump') o.skipTo = it.b;
    else if (it.key === 'freeze') { o.freeze = it.a; o.bw = it.params.bw / 100; }
    else if (it.key === 'split') o.split = { pos: it.params.pos / 100 };
    else if (it.key === 'slow' || it.key === 'fast') o.rate *= it.params.rate / 100;
    else if (it.key !== 'lang' && it.key !== 'dolly') o.looks.push({ key: it.key, e, p, dt: t - it.a, len: it.b - it.a, params: it.params, id: it.id });
  }
  return o;
}

// estado das texturas ativas em t: parâmetros somados (máximo por chave)
export function textureState(items, t) {
  const o = {};
  for (const it of items) if (it.kind === 'tx' && t >= it.a && t < it.b) for (const [k, v] of Object.entries(it.params)) o[k] = Math.max(o[k] || 0, v);
  return o;
}

// duração de saída: o jump cut tira trechos
export function outDuration(items, duration) {
  let cut = 0; for (const it of items) if (it.kind === 'tec' && it.key === 'jump') cut += Math.max(0, Math.min(duration, it.b) - it.a);
  return Math.max(0, duration - cut);
}

// ---------- Auto-FX ----------
const STYLE_LOOK = { cdd: 'super8-35', aflp: '35', moon: '16' };
const fmtT = (t) => { const tt = Math.round(t * 10); return String(Math.floor(tt / 600)).padStart(2, '0') + ':' + String(Math.floor((tt % 600) / 10)).padStart(2, '0') + ',' + (tt % 10); };

// scenes: [{a,b}], cands: [{t,score}] (pode ser vazio), styleKey: cdd|aflp|moon|..., platformKey
export function suggest({ scenes, cands = [], duration, platformKey = 'tiktok', styleKey = 'cdd', segs = [] }) {
  const plat = PLATFORMS.find((p) => p.key === platformKey) || PLATFORMS[1];
  const cuts = scenes.slice(1).map((s, i) => {
    const c = cands.reduce((best, x) => (!best || Math.abs(x.t - s.a) < Math.abs(best.t - s.a) ? x : best), null);
    return { t: s.a, i, score: c && Math.abs(c.t - s.a) < 0.6 ? c.score : 0.5, next: s.b - s.a, prev: scenes[i].b - scenes[i].a };
  });
  const want = cuts.length ? Math.max(1, Math.round(cuts.length * plat.density)) : 0;
  const picked = [];
  for (const c of [...cuts].sort((a, b) => b.score - a.score)) {
    if (picked.length >= want) break;
    if (picked.every((p) => Math.abs(p.t - c.t) >= 2)) picked.push(c);
  }
  picked.sort((a, b) => a.t - b.t);
  const order = ['whip', 'flash', 'zoom', 'whip', 'speed'];
  const items = [];
  picked.forEach((c, n) => {
    let key = order[n % order.length];
    if (key === 'speed' && c.next < 3) key = 'whip';
    if (key === 'zoom' && c.next < 1.5) key = 'flash';
    const t = techOf(key);
    let a = c.t; let it;
    if (key === 'whip') a = Math.max(0, c.t - 0.13);
    if (key === 'speed') a = c.t + 0.5;
    it = newTech(key, a, duration);
    if (key === 'zoom') it.b = r2(Math.min(duration, c.t + 1.5));
    if (key === 'speed') it.b = r2(Math.min(duration, a + Math.min(2.5, c.next - 0.7)));
    const how = { whip: 'a troca de plano aguenta um whip pan', flash: 'um quadro branco marca a virada', zoom: 'um zoom de ênfase dá peso pra cena que entra', speed: 'a cena é longa o bastante pra acelerar e voltar' }[key];
    const phrase = phraseNear(segs, c.t);
    it.why = 'Corte de cena de C' + (c.i + 1) + ' para C' + (c.i + 2) + ' em ' + fmtT(c.t) + (phrase ? ', logo depois da frase “' + phrase + '”' : ' (nota ' + String(r2(c.score)).replace('.', ',') + ')') + ': ' + how + '.';
    it.auto = true; it.accepted = false;
    items.push(it);
  });
  // jump cut nas pausas longas da fala (só com transcrição)
  if (platformKey !== 'youtube') for (const p of pauses(segs, 1.2, platformKey === 'tiktok' ? 4 : 2)) {
    if (items.some((x) => x.a < p.b && x.b > p.a)) continue;
    const j = newTech('jump', p.a, duration); j.b = p.b;
    j.why = 'Pausa de ' + String(r2(p.gap)).replace('.', ',') + ' s na fala em ' + fmtT(p.a) + ': o jump cut tira o respiro e deixa o ritmo do ' + (platformKey === 'tiktok' ? 'TikTok' : 'Instagram') + '.';
    j.auto = true; j.accepted = false; items.push(j);
  }
  // texturas pelo estilo
  const look = STYLE_LOOK[styleKey] || '35';
  const mid = cuts.length ? [...cuts].sort((a, b) => Math.abs(a.t - duration / 2) - Math.abs(b.t - duration / 2))[0].t : duration / 2;
  const mk = (key, a, b, why) => { const x = newTexture(key, a, b); x.why = why; x.auto = true; x.accepted = false; return x; };
  if (look === 'super8-35' && cuts.length) {
    items.push(mk('super8', 0, mid, 'O estilo do projeto pede cara de filme caseiro na primeira metade. O look muda no corte em ' + fmtT(mid) + '.'));
    items.push(mk('35mm', mid, duration, 'A segunda metade passa de caseiro pra cinema, no corte em ' + fmtT(mid) + '.'));
  } else items.push(mk(look === '16' ? '16mm' : '35mm', 0, duration, 'Look escolhido pelo estilo de referência do projeto.'));
  return items;
}
export const countSuggested = (items) => ({
  fx: items.filter((i) => i.auto && !i.accepted && i.kind === 'tec').length,
  tx: items.filter((i) => i.auto && !i.accepted && i.kind === 'tx').length,
  sfx: items.filter((i) => i.auto && !i.accepted && i.sfx).length
});
export { fmtT as fmtClock, r1, r2 };
