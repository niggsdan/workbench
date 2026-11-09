# Workbench

Editor de vídeo integrado, direto no navegador. O vídeo fica no teu computador, nada é enviado.

## Onde está
Tela **Editar**:
- **Material**: adicione qualquer tipo de arquivo (vídeo, áudio, imagem, outros) por **Arquivos**, **Pasta**, **Google Drive**, **Link do Drive** ou arrastando pra tela. Pastas chamadas Falas, Cenas e Overlays são separadas sozinhas. Todo arquivo tem **Baixar**.
- **Decodificador universal**: se o navegador não toca o formato (ProRes, AVI, MXF, WMV, HEVC sem suporte...), o ffmpeg dentro do navegador converte pra um MP4 leve, só pra prévia e análise. O original fica intacto e a versão convertida também pode ser baixada.
- **Detector de cenas**, controle por formato (9:16, 1:1, 4:5, 16:9), timeline, **Desfazer / Refazer em botão** e **salvar/abrir projeto (.json)**.

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
- Ainda não exporta.

## Próximos passos
1. Transcrição e cortes por ideia/plataforma, Auto-FX, aba Cor, export MP4/MOV.
2. Refino do corte quadro a quadro e análise mais rápida (WebCodecs + Worker).
3. Proxies pra edição sem lag em material pesado.
