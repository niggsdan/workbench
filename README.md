# Workbench

Editor de vídeo integrado, direto no navegador. O vídeo fica no teu computador, nada é enviado.

## Onde está
Três áreas navegáveis no topo, como no preview aprovado:

**Editar**
- Rail de ferramentas: Briefing, Transcrição, Cortes, Reenquadrar, Tarja, Legendas, Motion, Sons, Cor e Auto-FX. Cada ícone leva pra parte certa ou executa a ação.
- **Material** em árvore (Falas, Cenas, Overlays, Outros) com Drive, link da pasta, upload, pasta do computador e arrastar/soltar. Qualquer tipo de arquivo entra e tem download. O decodificador universal (ffmpeg.wasm) converte o que o navegador não toca.
- **Efeitos**: Técnicas (Whip pan, Speed ramp, Flash cut, Zoom, Freeze frame, Jump cut, Split screen, Dolly), Cinema (referências com link pro Film Grab, Flim e Movies in Color) e Textura (Super 8, 16 mm, 35 mm, VHS, grão, poeira, halation, light leak, vinheta, overlay).
- **Monitor** com prévia real de efeitos, cor e textura, plataformas (YouTube, TikTok, Instagram), formatos 9:16, 1:1, 4:5 e 16:9, e paleta da cena atual × referência.
- **Detector de cenas**, **Auto-FX** (sugere efeitos nos cortes mais fortes, texturas pelo estilo e sons, com o motivo de cada um) e **timeline** por faixas: ideias, cortes, FX, textura, overlay, texto, SFX, grade por cena, cenas, vídeo e áudio. Itens arrastáveis, com Lâmina e Ímã.
- **Inspetor** com motivo, parâmetros, keyframes, som do efeito, receita, e Aceitar, Trocar e Apagar.

**Cor**
- Grade de verdade por grupo de cenas (G1…Gn, agrupados por cor automaticamente) e grade geral por cima.
- Nós em série, em paralelo e camadas: Primária (rodas lift, gamma, gain e offset, contraste, pivô, temperatura, matiz, saturação, realces e sombras), Curvas, Pele e Céu por qualificador, e Halation.
- Visualizador com Atual, Referência e Dividir; waveform, vectorscope e histograma; álbum de stills; paleta; importação e exportação de LUT .cube; copiar e colar grade.

**Entrega**
- Destinos por plataforma com formato e corte (vídeo inteiro, por ideia ou por cena).
- Render de verdade no navegador, com o mesmo desenho da prévia, em MP4 ou MOV (H.264 + AAC), em 720p, 1080p ou 1440p.
- XML (Premiere e DaVinci Resolve), EDL, créditos e projeto Workbench.

O projeto salva sozinho neste navegador e pode ser retomado na tela inicial. Salvar projeto baixa o .json e você continua editando.

## Rodar
Não precisa de build. Sirva a pasta com qualquer servidor estático e abra no Chrome ou Edge:

```
python3 -m http.server 8000   # depois abra http://localhost:8000
```

No GitHub Pages funciona do mesmo jeito (o repositório precisa ser público no plano grátis).

## Testes
```
npm test
```
Cobrem as operações de cena, o histórico e a lógica do detector (Node 20+, sem dependências).

## Como está organizado
| Arquivo | O que faz |
|---|---|
| `js/project.js` | Operações puras de cena (dividir, juntar, mover corte, enquadramento) e salvar/validar projeto |
| `js/history.js` | Pilha de Desfazer/Refazer (60 passos, gesto contínuo vira um passo só) |
| `js/detect.js` | Nota de cada corte e escolha por sensibilidade |
| `js/sampler.js` | Lê o vídeo no navegador e mede a diferença entre quadros |
| `js/media.js`, `js/library.js` | Tipo de arquivo, papel pela pasta (Falas/Cenas/Overlays), lista do Material |
| `js/sources.js` | Entrada de arquivos, pastas (inclusive arrastadas) |
| `js/convert.js` | Teste "o navegador toca?" e conversão pelo ffmpeg.wasm |
| `js/drive.js` | Google Drive (login, listar, baixar) |
| `vendor/ffmpeg/` | ffmpeg.wasm local (GPL-2.0-or-later, veja o README da pasta) |
| `js/app.js` | Tela e ligação de tudo |

## Google Drive
O login do Google exige um **ID do cliente OAuth** seu (é gratuito e fica só no teu navegador):
1. Em console.cloud.google.com crie um projeto e ative a **Google Drive API**.
2. Em **APIs e serviços > Credenciais**, crie um **ID do cliente OAuth** do tipo **App da Web**.
3. Em **Origens JavaScript autorizadas** coloque `https://niggsdan.github.io` (e `http://localhost:8000` pra testar).
4. Na tela de consentimento, adicione teu e-mail como usuário de teste.
5. No Workbench, **Google Drive** > cole o ID do cliente > **Conectar**. Só pede leitura (`drive.readonly`).

Sem login, dá pra baixar o arquivo do Drive no computador e adicioná-lo por **Arquivos**/**Pasta** (o Drive for Desktop mostra o Drive como pasta).

## Limites conhecidos
- A conversão roda no navegador, sem aceleração de hardware: ProRes/4K/HEVC pesado demora (a prévia sai em 720p). Vídeos que o navegador já toca não passam por isso.
- O login do Drive ainda não foi testado com um ID de cliente real.
- A posição do corte tem margem de até ~0,1 s. Falta refino quadro a quadro.
- "Rosto" ainda enquadra no centro; "Manual" funciona.
- Limiares de sensibilidade calibrados só com vídeo de teste.
- Vídeo longo demora pra analisar.
- O projeto salvo não guarda o vídeo: ao abrir, você escolhe o vídeo de novo.
- O render é em tempo real (1 min de vídeo leva cerca de 1 min por arquivo, mais a conversão). A aba precisa ficar aberta e na frente.
- A transcrição ainda não está nesta versão: a faixa A1 está reservada, e as ideias são marcadas à mão.
- "Rosto" ainda enquadra no centro.

## Próximos passos
1. Transcrição e cortes por ideia/plataforma, Auto-FX, aba Cor, export MP4/MOV.
2. Refino do corte quadro a quadro e análise mais rápida (WebCodecs + Worker).
3. Proxies pra edição sem lag em material pesado.
