# Clips de Jogo

App para gravar jogos de basquetebol com um telemóvel no tripé e tirar clips **durante** a gravação, sem a parar. Funciona **100% sem internet**.

- **Gravar** (telemóvel no tripé): grava o jogo inteiro, sem interrupções.
- **Comando** (tablet na mão): botões "clip dos últimos 10/20/30/60 s". *(Fase 2.)*
- **Clips**: lista de clips e do jogo completo. Podes vê-los, guardá-los na galeria e partilhá-los.

## Estado

| Fase | Conteúdo | Estado |
|---|---|---|
| 1 | Gravação contínua + cortes locais (botões de teste no próprio telemóvel) | ✅ Android |
| 2 | Emparelhamento por QR + ligação offline + modo Comando (tablet Android) | ✅ a testar |
| 3 | Envio automático dos clips para o tablet + lista no tablet | ⏳ |
| 4 | Robustez (reconexão, fila, serviço em segundo plano) + iOS | ⏳ |

> **iPhone/iPad:** o motor de gravação para iOS ainda não está feito. Nesta versão a app abre em iOS, mas o botão "Gravar" fica desativado. Mais abaixo está o que vai ser preciso para instalar em iPhone/iPad.

---

## Instalar no Android (sem computador)

O APK é compilado automaticamente pelo GitHub sempre que há alterações nesta pasta.

1. No GitHub, abre o repositório → separador **Actions** → workflow **"Clips de Jogo — APK Android"**.
2. Abre a execução mais recente que esteja verde (✓).
3. Em **Artifacts**, descarrega **`clips-jogo-<versão>`** (é um `.zip`) e extrai o `.apk`. A versão instalada aparece no fundo do ecrã inicial da app.
4. Passa o `.apk` para o telemóvel (cabo USB, Google Drive, e-mail…) e abre-o.
5. O Android pede autorização para "instalar apps desconhecidas" a partir dessa app (Ficheiros, Chrome…). Autoriza e instala.
6. Quando há uma versão nova, repete o processo. Instala por cima da anterior e não apaga as gravações.

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
5. Se a ligação cair, a gravação continua. Os pedidos ficam "Na fila" e são enviados quando o tablet voltar a ligar-se, com os tempos certos.

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
