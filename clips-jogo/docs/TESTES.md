# Protocolo de teste em dispositivo real

Objetivo: confirmar que **(1)** a gravação não tem falhas, **(2)** os clips cortam os momentos certos e **(3)** o vídeo completo fica bem, tudo **sem internet**.

## Preparação

- Telemóvel Android com a app instalada (ver README) e **modo de avião ligado** (prova que não depende de rede).
- Um segundo ecrã com um **cronómetro grande com décimas**: um portátil ou outro telemóvel, por exemplo num site de cronómetro aberto antes de desligar a rede, ou na app Relógio.
- Telemóvel no tripé (ou encostado), a filmar o cronómetro.

## Teste A — Fase 1 (só o telemóvel), 3–5 minutos

1. Põe o cronómetro a correr. Na app: **Gravar** → **1080p** → botão vermelho.
2. Anota a diferença entre o cronómetro e o tempo da app. Exemplo: cronómetro `00:07.4` quando a app mostra `0:00` → **desvio = 7,4 s**.
3. Durante a gravação, pede estes clips e anota **o tempo da app** no momento em que carregas:

   | # | Quando (tempo da app) | Botão | Clip esperado (tempo da app) |
   |---|---|---|---|
   | 1 | ~0:45 | 10s | 0:35 → 0:45 |
   | 2 | ~1:30 | 30s | 1:00 → 1:30 |
   | 3 | ~2:00 | 20s, logo seguido de 10s | 1:40 → 2:00 e 1:50 → 2:00 |
   | 4 | ~3:10 | 60s | 2:10 → 3:10 |
   | 5 | ~0:05 depois de ligar o **Ecrã de repouso** | 10s | (verifica que funciona com o ecrã apagado) |

4. Para aos ~4 min. Espera pelo vídeo completo.

### O que verificar

- [ ] Cada clip ficou **"Pronto"** 2–4 s depois do pedido, enquanto a gravação continuava.
- [ ] No início de cada clip, o cronómetro filmado mostra **(início esperado + desvio)**, com uma tolerância de **−1 s a +0,2 s**. O clip pode começar até 1 s antes, porque começa no keyframe anterior.
- [ ] No fim de cada clip, o cronómetro mostra **(fim esperado + desvio)**, com uma tolerância de ±0,3 s.
- [ ] O som está sincronizado (bate palmas em frente à câmara, de vez em quando).
- [ ] **Vídeo completo:** a duração bate com o cronómetro da app. Percorre-o à procura de saltos: as décimas do cronómetro filmado nunca devem saltar mais de ~0,1 s. Ouve a passagem entre segmentos (a cada 2 s) para confirmar que não há cliques nem cortes.
- [ ] **Galeria** e **Partilhar** funcionam com um clip e com o vídeo completo.
- [ ] O telemóvel não aqueceu de forma anormal (o aviso "Quente" não apareceu num teste curto).

## Teste B — Recuperação

1. Começa uma gravação e pede 1–2 clips.
2. Ao fim de ~1 min, **fecha a app à força** (apps recentes → deslizar).
3. Abre a app → **Ver gravações e clips**. A gravação aparece como "Interrompida".
4. Carrega em **Recuperar vídeo**. Ao fim de alguns segundos, reabre a lista: o vídeo completo deve ter até ao último segmento gravado (perde no máximo ~2 s).

## Teste C — Jogo longo (antes de usar a sério)

- Grava 60–90 min ligado a um powerbank, com o ecrã de repouso ativo. Pede ~20 clips ao longo do tempo.
- Verifica a bateria e a temperatura no fim, se o vídeo completo foi dividido em partes (1080p > ~45 min) e se todas as partes reproduzem.

## Fases seguintes

- **Fase 2/3:** repetir o Teste A com os pedidos feitos no **tablet**.
  - O tablet calcula os tempos com o relógio sincronizado com o telemóvel. A mesma tolerância tem de se manter.
  - Desligar o Wi-Fi do tablet a meio: os pedidos ficam em fila e são entregues quando a ligação voltar, com os tempos certos.
