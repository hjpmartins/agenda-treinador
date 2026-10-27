# Clips de Jogo

App para gravar jogos de basquetebol com um telemóvel no tripé e tirar clips **durante** a gravação, sem a parar. Funciona **100% sem internet**.

- **Gravar** (telemóvel no tripé): grava o jogo inteiro, sem interrupções.
- **Comando** (tablet na mão): botões "clip dos últimos 10/20/30/60 s". Os clips passam sozinhos para o tablet.
- **Clips**: lista de clips e do jogo completo. Podes vê-los, guardá-los na galeria e partilhá-los.

## Estado

| Fase | Conteúdo | Estado |
|---|---|---|
| 1 | Gravação contínua + cortes locais (botões de teste no próprio telemóvel) | ✅ Android |
| 2 | Emparelhamento por QR + ligação offline + modo Comando (tablet Android) | ✅ a testar |
| 3 | Envio automático dos clips para o tablet + lista no tablet | ✅ a testar |
| 4 | Robustez: gravação com ecrã bloqueado, Wi-Fi sempre acordado, fila e último telemóvel guardados no tablet | ✅ a testar |

> **iPhone/iPad:** o motor de gravação para iOS ainda não está feito. Nesta versão a app abre em iOS, mas o botão "Gravar" fica desativado. Mais abaixo está o que vai ser preciso para instalar em iPhone/iPad.

---

## Instalar no Android (sem computador)

O APK é compilado automaticamente pelo GitHub sempre que há alterações nesta pasta e publicado como
**Release** `clips-jogo-v<versão>` (separador **Releases** do repositório, à direita na página inicial).

**Primeira instalação**

1. No telemóvel, abre a página **Releases** do repositório no browser.
2. Na versão mais recente ("Clips de Jogo x.y.z"), em **Assets**, toca em **`clips-jogo-x.y.z.apk`**.
3. Abre o ficheiro descarregado. O Android pede autorização para "instalar apps desconhecidas" a partir do browser. Autoriza e instala.

**Atualizações (a partir da própria app, com internet)**

- Ao abrir a app, se houver versão nova, aparece um cartão **"Nova versão … disponível"** no ecrã inicial, com o que mudou.
  Também podes carregar em **Procurar atualizações** (no fundo do ecrã inicial).
- **Atualizar agora** → descarrega → o Android mostra o ecrã de instalação → **Atualizar**.
- Da primeira vez, o Android pede para autorizar o Clips de Jogo a instalar apps: **Abrir definições** → ativa
  **"Permitir desta fonte"** → volta atrás. Em alguns telemóveis a app fecha nesse momento: abre-a outra vez e carrega em
  **Atualizar agora** (o download já feito é reaproveitado).
- A atualização instala por cima e não apaga gravações, clips nem a ligação ao tablet. Atualiza o telemóvel **e** o tablet.

A versão instalada aparece no fundo do ecrã inicial. Os APKs também ficam em **Actions** → execução → **Artifacts** (30 dias).

## Testar a Fase 1 (só com o telemóvel)

1. Abre a app → **Gravar** → **Permitir** (câmara e microfone).
2. Põe o telemóvel na horizontal (a app roda sozinha) e escolhe **1080p** ou **720p**.
3. Carrega no botão vermelho. O cronómetro começa e aparecem os avisos de bateria, espaço e temperatura.
4. Durante a gravação, carrega em **15s / 25s / 45s / 60s** para criar clips dos últimos N segundos. O contador mostra "x prontos · y a processar". Cada clip fica pronto 2–4 segundos depois do pedido.
5. **Ecrã de repouso** apaga o ecrã para poupar bateria, mas a gravação continua. Toca no ecrã para o acordar.
6. **Parar gravação** → confirma. A app termina os clips pendentes e cria o vídeo completo (com barra de progresso).
7. **Ver clips**: reproduz, **Galeria** (guarda no rolo da câmara) ou **Partilhar** (WhatsApp, Drive…).

## Ligar o tablet (Fase 2)

1. **Telemóvel:** Gravar → **Ligar tablet**. Da primeira vez, autoriza "Dispositivos próximos" (ou Localização, em Android antigo). O telemóvel cria uma rede Wi-Fi própria, sem internet, e mostra um QR.
2. **Tablet:** Comando → aponta para o QR → confirma a janela do Android para ligar à rede do telemóvel.
3. O telemóvel passa a mostrar **"Tablet ligado"**, e o tablet mostra o cronómetro da gravação.
4. No tablet:
   - **Clip dos últimos 10/20/30/60 s:** o momento fica fixado no toque. Aparece um rascunho com **±5 s** no início e no fim e um nome opcional, que é enviado sozinho ao fim de 5 s (qualquer ajuste pausa a contagem).
   - **Marcar início / Marcar fim:** para jogadas longas.
   - A lista à direita mostra o estado de cada clip: "Na fila", "A processar" ou "Pronto".
5. Cada clip pronto é **copiado sozinho para o tablet** ("A transferir 40%" → "No tablet ✓"). Podes vê-lo, guardá-lo na galeria do tablet ou partilhá-lo logo no ecrã Comando. Ficam também em **Ver gravações e clips → Recebidos**, mesmo depois de desligar.
6. **Ecrã bloqueado / outra app:** a gravação continua (aparece a notificação "A gravar o jogo"). Ao voltar à app, a pré-visualização reaparece. Nota: ao sair e voltar à app, a câmara reconfigura-se e pode perder-se uma fração de segundo de imagem — durante o jogo, prefere o **Ecrã de repouso**.
7. **Reiniciar a app do tablet:** no Comando aparece **"Ligar ao último telemóvel"** (sem ler o QR outra vez, se o telemóvel continuar com a mesma rede — por exemplo, o Ponto de acesso). Os pedidos que estavam "Na fila" continuam lá.
8. Se a ligação cair, a gravação continua. Os pedidos ficam "Na fila" e são enviados quando o tablet voltar a ligar-se, com os tempos certos.

### Analisar clips no tablet (motivos, desenhar, cortar, desconto de tempo)

- **Motivo de cada clip** (um por clip): ao pedir o clip no Comando (fila de motivos no painel do clip), na **barra
  flutuante** (os motivos aparecem ~6 s depois de pedir — tocar é opcional), ou depois, tocando em "+ motivo" na lista.
  A lista de motivos edita-se em "Motivo… → Editar lista".
- **▶ Ver** abre o leitor de análise: velocidade (0,25x / 0,5x / 1x / 2x), imagem a imagem (◀ 1 / 1 ▶), −3 s e barra para
  arrastar.
- **✏ Desenhar**: com a imagem parada, seta, círculo ou traço livre, em amarelo, vermelho ou branco; desfazer/apagar.
  Podes desenhar em vários momentos do mesmo clip; ao reproduzir, a imagem **para em cada desenho** (▶ para continuar).
  Os desenhos ficam guardados (marcas amarelas na barra).
- **Zoom**: dois dedos para aproximar e afastar; com zoom, um dedo arrasta a imagem. Dois toques rápidos aproximam
  nesse ponto (ou voltam ao normal). Também há os botões **🔍+ / 🔍−**; "🔍 … · Repor" volta ao normal. O zoom fica
  guardado no clip e **vai no vídeo enviado** (versão "Editado"); dá para desenhar com zoom.
- **✂ Cortar**: aparecem duas **pegas laranja** na barra — a da esquerda é o início, a da direita o fim. Arrasta-as e a
  imagem acompanha a pega; "▶ Ver o corte" mostra o resultado. O clip passa a ver-se só nessa parte (o ficheiro
  original não muda); "Repor" volta ao clip inteiro.
- **Título**: toca no nome do clip (na lista, no Comando ou no topo do leitor) para escrever um título. Ao pedir o clip
  no Comando também há o campo "Título". Ao enviar, o título vai como texto da mensagem e como nome do ficheiro.
- **Enviar** (↗ Enviar no leitor, ou Partilhar): se o clip tiver corte, desenhos ou zoom, escolhe-se **Editado** ou
  **Original**. Depois:
  - **Enviar como vídeo** — WhatsApp, YouTube, Galeria… O WhatsApp comprime os vídeos: **toca em HD** antes de enviar.
  - **Enviar como ficheiro · qualidade total** — no WhatsApp chega como documento e não perde qualidade (toca-se para
    ver).

  O editado sai sempre na qualidade máxima do clip (1080p se for HD); em cada desenho a imagem fica **parada 4 s com o
  desenho por cima** (sem som). Para as jogadoras se reconhecerem, usa o **zoom** na zona da jogada antes de enviar.
- **YouTube**: logo depois de enviado o YouTube mostra só 360p; o HD aparece quando acabar de processar (num jogo
  inteiro pode demorar horas).
- **Tipo + / −** (positivo a azul, negativo a vermelho): no painel do clip acabado de pedir (bloco "TIPO"), na barra
  flutuante, ou depois nos botões **+** e **−** de cada clip na lista. O clip fica com o fundo dessa cor.
- **Desconto** (botão no Comando): clips deste jogo agrupados por motivo; toca num motivo e os clips passam seguidos.
- Em **Ver gravações e clips → Recebidos**, cada jogo tem "Ver seguidos" por motivo, para a análise durante a semana.
- **Enviar vários de uma vez**: Ver gravações e clips → **Selecionar clips para enviar** → toca nos clips (ou **Todos**
  / **Todos deste jogo**) → **Enviar (N)**. Os que têm corte ou desenhos vão na versão com desenhos.

### Jogadoras (plantel)

- **Plantel**: na Agenda do Treinador (no tablet), ecrã **Plantel → "Enviar para Clips de Jogo"** — abre esta app e
  importa número e nome das jogadoras. Também se edita à mão: ecrã inicial → **Plantel**.
- **Marcar jogadoras num clip** (várias): no painel do clip acabado de pedir (motivos e jogadoras em blocos separados),
  na **barra flutuante** (painel por baixo da barra: tipo, motivos e jogadoras; fecha com **✓ OK**, por baixo do tipo, ou 8 s depois
  do último toque), ou depois em "+ jogadora" na lista / no leitor.
- **Ver gravações e clips**: em cada jogo há **Por jogadora** (só os clips desse jogo); no topo, **Por jogadora · todos os
  jogos** junta os jogos guardados. Toca numa jogadora → **▶ Ver seguidos** ou
  **Enviar todos** (WhatsApp…): os que têm corte ou desenhos vão na versão com desenhos.

### Iniciar e parar a gravação a partir do tablet

Para deixar o telemóvel no tripé (ex.: na bancada) antes do jogo e só começar a gravar no início:

1. No telemóvel: **Gravar** → **Ligar tablet** → lê o QR com o tablet. Deixa o telemóvel **neste ecrã** (podes usar o
   **Ecrã de repouso**; não bloqueies o telemóvel). Liga-o a uma powerbank: a câmara fica ligada à espera.
2. No tablet aparece **"Pronto a gravar"** e o botão **● Iniciar gravação**. No início do jogo, carrega nele.
3. No fim, **■ Parar** (pede confirmação). O vídeo completo é criado no telemóvel.

Se o telemóvel não estiver no ecrã Gravar, o tablet diz "Abre o ecrã Gravar no telemóvel".

### Onde ficam os vídeos

- Só dentro da app (telemóvel: `Android/data/pt.clipsjogo.app/files/sessions/`; tablet: memória interna da app).
  Não aparecem na Galeria nem vão para a nuvem.
- Para guardar um vídeo: **Galeria** (copia para a galeria do aparelho) ou **Partilhar** (WhatsApp, YouTube, Drive…).
- **Ficam só os últimos 3 jogos**, no telemóvel e no tablet: no fim de cada gravação (telemóvel) ou quando chega o
  primeiro clip de um jogo novo (tablet), o mais antigo é apagado. Em "Ver gravações e clips", o jogo que vai ser apagado
  a seguir mostra o aviso **"Será apagado no próximo jogo"**.
- Desinstalar a app ou "Limpar dados" apaga tudo; as atualizações não apagam nada.

### Som

- O **vídeo completo do jogo tem som**. Os **clips não têm som** (são para ver), nem as cópias leves nem os vídeos
  enviados "com desenhos" (assim as paragens nos desenhos duram sempre o tempo certo).

### Calor e bateria

- **Modo espera** (ecrã Gravar, antes de começar): apaga o ecrã e desliga a câmara até a gravação começar — o telemóvel
  pode ficar no tripé muito tempo sem aquecer. O tablet continua a poder iniciar a gravação (demora ~2 s a mais, para a
  câmara acertar foco e exposição).
- **Ecrã de repouso** (a gravar): ecrã preto com o brilho no mínimo.
- Se o telemóvel aquecer muito: tira a capa, evita sol direto, e considera **720p** (bastante menos esforço).
  Carregar ao mesmo tempo também aquece; usa a powerbank só se a bateria não chegar.

### Pausa (intervalo)

- **❚❚ Pausa** (no telemóvel, ao lado de Parar, ou no Comando do tablet): deixa de gravar e **desliga a câmara** — não
  ocupa espaço nem aquece. O tempo do jogo fica parado.
- **▶ Retomar**: a câmara liga-se (~2 s para acertar foco e exposição) e a gravação continua **no mesmo jogo**, com o
  tempo a continuar de onde parou. O vídeo completo fica sem o intervalo.
- Durante a pausa não se pedem clips (o tablet mostra "Gravação em pausa (intervalo)").
- Se levares o tablet para longe (ex.: balneário) e a ligação cair, ao voltar carrega em **↻ Voltar a ligar** no Comando
  (o Android não volta sozinho à rede do telemóvel).

### Ver a câmara a partir do tablet

- No Comando, **📷 Ver câmara** mostra o que o telemóvel está a filmar, com uma imagem nova de 1,5 em 1,5 s: serve
  para confirmar o enquadramento (ninguém à frente, ninguém mexeu no tripé) sem ir à bancada.
- Não é vídeo, por isso não aquece mais o telemóvel. Só há imagem com o ecrã Gravar aberto no telemóvel e a câmara
  ligada (não funciona no modo espera nem na pausa).

### Rever o jogo e fazer clips depois

- Com o tablet ligado ao telemóvel (por exemplo em casa: telemóvel em **Gravar → Ligar tablet**, pode ficar no modo
  espera), no Comando carrega em **▶ Rever jogo** e escolhe o jogo.
- O vídeo completo passa **a partir do telemóvel** (não é copiado para o tablet). Tens ▶/❚❚, −10 s/−3 s/+3 s/+10 s,
  velocidade e a barra para andar no vídeo.
- **15s / 25s / 45s / 60s** fazem o clip dos últimos segundos a partir de onde estás (ex.: aos 5:20, "15s" faz o clip
  5:05–5:20). **Início / Fim** marca um clip à mão.
- Depois de pedires, aparece o painel para o título, tipo +/−, motivo e jogadoras. O clip é cortado no telemóvel e
  copiado para o tablet: fica em **Ver gravações e clips**, junto dos clips desse jogo.

### Distância e qualidade da ligação

- No Comando, o aviso **"Wi-Fi bom/razoável/fraco · -62 dBm · 2,4 GHz · 35 ms"** mostra o sinal do tablet, a banda,
  o tempo de resposta do telemóvel e as falhas nos últimos ~30 s. Verde = bom; amarelo = no limite; vermelho = muda os
  aparelhos de sítio. Usa-o para escolher onde pôr o telemóvel e o tablet antes do jogo.
- Para mais alcance, põe o **Ponto de acesso** do telemóvel em **2,4 GHz** (Definições → Ponto de acesso → Banda) e o
  telemóvel alto no tripé, acima das cabeças.
- **Copiar clips para o tablet**: "Logo que prontos" (normal) ou "Quando eu pedir" — durante o jogo a ligação fica só
  para os pedidos; no intervalo ou no fim, carrega em **Copiar agora (N)**.
- **Original (1080p)** ou **Leve (720p, ~4x menor)**: na cópia leve, o telemóvel prepara uma versão mais pequena de cada
  clip só para ver no banco ("A preparar (leve)" → "A transferir"). O clip em qualidade máxima fica sempre no telemóvel.
  Se a cópia leve falhar, o tablet recebe o original.

### Barra flutuante (estatísticas e clips no mesmo tablet)

Para usar outra app em ecrã inteiro (ex.: estatísticas) e pedir clips ao mesmo tempo:

1. No Comando, já ligado ao telemóvel, carrega em **Barra flutuante**.
2. Da primeira vez, o Android pede **"Mostrar sobre outras apps"** para o Clips de Jogo: ativa e volta à app; carrega outra vez em **Barra flutuante**.
3. A app vai para trás e aparece uma barra pequena por cima de tudo: **`● 12:34` `15s` `25s` `45s` `60s` `Início` `↗`**.
   - **15s/25s/45s/60s**: pede logo o clip dos últimos segundos (o cronómetro mostra "✓ 25s").
   - **Início** → **Fim**: marca o início e depois o fim do clip. Toque longo cancela a marca.
   - **Arrastar o cronómetro** muda a barra de sítio; **um toque no cronómetro** encolhe-a (fica só o cronómetro) ou expande-a.
   - **HD / Leve**: qualidade da cópia dos clips para o tablet (toca para trocar; a app passa a usar a mesma).
   - **↗** volta à app de clips (a barra esconde-se enquanto estás nela e reaparece quando sais).
   - "·1" ao lado do cronómetro = pedidos à espera de serem enviados ao telemóvel.
4. Para desligar, abre a app e carrega em **Barra flutuante: ligada**.

Os clips pedidos pela barra aparecem na lista do Comando. Enquanto a barra está visível, os clips prontos vão sendo copiados para o tablet em segundo plano; ao voltar à app ficam logo "No tablet ✓".

> Notas:
> - Se o "Ponto de acesso" (hotspot) normal do telemóvel estiver ligado, desliga-o: o Android não deixa ter os dois ao mesmo tempo.
> - A rede muda de nome sempre que é criada. Se saíres do ecrã Gravar, tens de voltar a ler o QR.

O protocolo de teste completo, para confirmar que os cortes caem no momento certo, está em [`docs/TESTES.md`](docs/TESTES.md).

---

## Como funciona

### Gravação contínua em segmentos

```
Câmara (Camera2) ──► Encoder H.264 por hardware (1 keyframe/s) ──► SegmentMuxer ──► seg_00000.mp4
Microfone ────────► Encoder AAC ─────────────────────────────────┘                  seg_00001.mp4  (2 s cada)
                                                                                     seg_00002.mp4 …
```

- O encoder **nunca para**. De 2 em 2 segundos, sempre num keyframe, o `SegmentMuxer` fecha o ficheiro atual e abre o seguinte, por isso não se perdem frames.
- O som segue para o ficheiro certo pelo seu timestamp, sem micro-cortes entre segmentos.
- Cada segmento fechado é um MP4 válido, que já se pode ler e cortar enquanto a gravação continua.
- Se a app fechar à força ou a bateria acabar, os segmentos ficam no disco e a lista mostra **"Recuperar vídeo"**.

### Cortes sem re-codificar

- Um clip `[início, fim]` (em tempo de gravação) junta os segmentos necessários e copia as amostras H.264/AAC diretamente, sem re-codificar. É rápido (menos de 1 s para 30 s de vídeo) e não aquece o telemóvel.
- O clip começa no keyframe anterior ao início pedido, no máximo ~1 s antes. Nunca corta o início da jogada.
- Se o fim pedido ainda não estiver gravado, o clip fica "à espera" até o segmento fechar.

### Vídeo completo

- Quando paras, a app junta todos os segmentos num MP4 normal (também sem re-codificar) e apaga os segmentos.
- O jogo inteiro fica **num só ficheiro**, mesmo acima de 4 GB: os segmentos são juntos por `Mp4Concat` (MP4 com offsets de 64 bits, sem re-codificar), porque o MediaMuxer do Android não passa dos 4 GB. O ficheiro é verificado no fim; se falhar, a app volta ao método antigo e divide em partes de ~3,5 GB (`parte1`, `parte2`…).

### Espaço e bateria

| Qualidade | Espaço por hora | Notas |
|---|---|---|
| 1080p / 30 fps | ~4,5 GB | por defeito |
| 720p / 30 fps | ~2,3 GB | para telemóveis com pouco espaço |

- O aviso de espaço já conta com o vídeo completo criado no fim, que precisa temporariamente do dobro do espaço.
- Num jogo inteiro recomenda-se um powerbank ligado ao telemóvel.

---

## Estrutura

```
clips-jogo/
├── App.tsx                        # navegação: Início → Gravar / Clips
├── src/
│   ├── screens/                   # HomeScreen, RecordScreen, ClipsScreen
│   ├── components/ui.tsx          # botões, chips, cartões (tema escuro)
│   ├── lib/clipRange.ts           # cálculo dos intervalos (últimos N s, ±5 s, marcas)
│   ├── lib/format.ts
│   └── theme.ts
├── modules/clip-engine/           # módulo nativo (Expo Modules API)
│   ├── index.ts                   # API em TypeScript
│   └── android/src/main/java/pt/clipsjogo/engine/
│       ├── ClipEngine.kt          # coordenador: estado, sessões, fila de cortes
│       ├── ClipEngineModule.kt    # ponte para JavaScript
│       ├── CameraPreviewView.kt   # pré-visualização
│       ├── Storage.kt             # sessões/clips em JSON
│       ├── core/CutPlanner.kt     # lógica pura (testada): que segmentos cortar
│       └── media/                 # Camera2, encoders, SegmentMuxer, ClipCutter
├── tests/                         # testes JS (node --test)
└── docs/TESTES.md                 # protocolo de teste em dispositivo real
```

## Desenvolvimento

Requisitos: Node 22, JDK 17 e Android Studio (SDK Android).

```bash
cd clips-jogo
npm install
npm run typecheck && npm test        # verificações rápidas
npx expo run:android                 # compila e instala no telemóvel ligado por USB
npm run android:apk                  # APK release em android/app/build/outputs/apk/release/
```

- As pastas `android/` e `ios/` são geradas (`expo prebuild`) e não vão para o Git.
- A configuração nativa está em `app.json` e em `modules/clip-engine`.
- Testes do motor nativo (Kotlin): `cd android && ./gradlew :clip-engine:testDebugUnitTest`.

## iPhone / iPad (fase 4)

O motor iOS vai usar `AVCaptureSession` + `AVAssetWriter` em modo segmentado (MP4 fragmentado) e cortes passthrough com `AVAssetExportSession`. Para instalar em iPhone/iPad, quem tiver o dispositivo vai precisar de:

- **Opção A, com Mac:** Xcode e uma conta Apple.
  - Com a conta gratuita, a app expira ao fim de 7 dias e tem de ser reinstalada.
  - Com o Apple Developer Program (99 €/ano), dura um ano e pode ser distribuída por TestFlight.
- **Opção B, sem Mac:** `eas build -p ios` (compilação na cloud da Expo). Exige o Apple Developer Program pago. Depois, instala-se por TestFlight ou por link interno.

A app pede as permissões de câmara, microfone e **Rede local** (obrigatória no iOS para ligar ao tablet). Os textos estão em `app.json`.
