# Workbench

Editor de vídeo integrado, direto no navegador. O vídeo fica no teu computador, nada é enviado.

## Onde está
Primeira versão da tela **Editar**: abrir vídeo, **salvar e abrir projeto (.json)**, **detector de cenas**, controle de cena em todos os formatos (9:16, 1:1, 4:5, 16:9), timeline e **Desfazer / Refazer em botão** (sem atalho de teclado).

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
| `js/project.js` | Operações puras de cena (dividir, juntar, mover corte, modo de enquadramento) e salvar/validar projeto |
| `js/history.js` | Pilha de Desfazer/Refazer (60 passos, gesto contínuo vira um passo só) |
| `js/detect.js` | Nota de cada corte e escolha por sensibilidade (mexer na sensibilidade não reanalisa o vídeo) |
| `js/sampler.js` | Lê o vídeo no navegador e mede a diferença entre quadros |
| `js/app.js` | Tela e ligação com o vídeo |

## Limites conhecidos
- A posição do corte tem margem de até ~0,1 s (amostragem por busca de quadro). Falta uma etapa de refino quadro a quadro.
- "Rosto" ainda enquadra no centro. Detecção de rosto entra depois; "Manual" já funciona.
- Os limiares de sensibilidade foram calibrados só com vídeo de teste. Precisam ser ajustados com material real.
- Vídeo longo demora pra analisar (o passo de amostragem cresce com a duração).
- O projeto salvo guarda as cenas, enquadramentos e sensibilidade, mas não o vídeo: ao abrir, você escolhe o vídeo de novo (se a duração não bater, ele reanalisa).
- Ainda não exporta.

## Próximos passos
1. Refino do corte quadro a quadro e análise mais rápida (WebCodecs + Worker).
2. Proxies leves pra edição sem lag (só se a prévia travar com material pesado).
3. Material (Drive e pasta local), transcrição, Auto-FX, aba Cor, export MP4/MOV.
