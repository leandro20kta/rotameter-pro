# RotaMeter PRO — Android nativo (beta de compilação)

O projeto Android usa a **mesma UI web** de `../web`, instalada localmente em `app/src/main/assets`.

- A `MainActivity` mostra os recursos internos por `WebViewAssetLoader` no domínio HTTPS interno de recursos Android.
- A interface comunica por `RotaMeterAndroid.postMessage(JSON)`, compatível com a ponte existente de iOS.
- `GpsTripService` usa `LocationManager` e um **foreground service de localização** com notificação visível e registo NDJSON local separado da WebView. Não existe pedido de localização para analytics/publicidade.
- O condutor inicia o serviço enquanto a app está em primeiro plano, após autorização de localização precisa.
- Sincronização do percurso via `window.RotaMeterNative.ingestBatch`; preserva o ID e evita duplicar o que já foi processado.
- Pedidos de voz recebem lista de manobras da rota planeada e usam Android `TextToSpeech` (beta, ainda sem teste físico).

## Abrir e compilar
Abra `android-native/` no Android Studio com **JDK 17** e Android SDK 35. Sincronize o Gradle e teste num Android real com permissões concedidas. Ainda não há build AAB/APK testado, chave de assinatura ou revisão Play Console.

## Restrições
Android 14+ exige `FOREGROUND_SERVICE_LOCATION`; não iniciamos a partir do background. Não solicitamos `ACCESS_BACKGROUND_LOCATION` nesta etapa: uma viagem iniciada conscientemente em primeiro plano pode usar o serviço de localização em curso, sujeito às restrições de sistema e de fabricante. Se for necessária recuperação automática de localização após encerramento ou arranque, haverá revisão de permissões e política Play Store. O sistema pode interromper serviços, especialmente após encerramento forçado. O ícone e a notificação são indicativos, não uma sobreposição sobre outras aplicações.

**Privacidade:** o trajeto fica no armazenamento interno do dispositivo. Cartografia, rotas e pesquisa de destinos ainda dependem de serviços externos; rever termos, disponibilidade e política de privacidade antes da distribuição.
