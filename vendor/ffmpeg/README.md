# ffmpeg.wasm (decodificador universal)

Cópia local do **ffmpeg.wasm 0.12.10**, servida pelo próprio site pra não depender de CDN.

- `index.js`, `classes.js`, `worker.js`, `const.js`, `errors.js`, `types.js`, `utils.js`: pacote `@ffmpeg/ffmpeg` (MIT).
- `ffmpeg-core.js` e `ffmpeg-core.wasm`: pacote `@ffmpeg/core` (build ESM, versão single-thread), licença **GPL-2.0-or-later** (inclui x264 e outras bibliotecas do FFmpeg).

Código-fonte e licenças: https://github.com/ffmpegwasm/ffmpeg.wasm e https://ffmpeg.org/legal.html

O Workbench só usa isso quando o navegador não toca o arquivo (ProRes, AVI, MXF, WMV, HEVC sem suporte...). A conversão roda no computador da pessoa; nada é enviado.
