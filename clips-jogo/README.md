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
4. Durante a gravação, carrega em **10s / 20s / 30s / 60s** para criar clips dos últimos N segundos. O contador mostra "x prontos · y a processar". Cada clip fica pronto 2–4 segundos depois do pedido.
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
- Acima de ~3,5 GB divide em partes (`parte1`, `parte2`…), porque ficheiros maiores dão problemas em muitas apps e leitores. Em 1080p, isso é cerca de 45 min por parte.

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
