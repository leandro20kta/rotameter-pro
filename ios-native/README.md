# RotaMeter PRO V9 — projeto iOS nativo (Xcode 16+, iOS 17+)

A **versão web** não consegue manter o GPS em segundo plano no iPhone. Esta pasta é uma implementação-fonte de um invólucro nativo SwiftUI/WebKit com localização Core Location independente da página e Live Activity opcional. **Ainda não foi compilada num Mac nem validada em iPhone físico.** Não corresponde a um IPA pronto nem a um aplicativo publicado.

## Para compilar

1. Num **Mac** com Xcode e uma equipa de assinatura Apple configurada, instale XcodeGen (`brew install xcodegen`) e abra o Terminal nesta pasta.
2. Execute `xcodegen generate`, depois abra `RotaMeterNative.xcodeproj` no Xcode.
3. Em Signing & Capabilities, selecione a sua Apple Team no alvo **RotaMeterNative** e na extensão **RotaMeterLiveWidget** e use IDs de bundle que lhe pertençam.
4. Confirme no Info.plist gerado a descrição de localização `When In Use` e `Always and When In Use`, o background mode `location` e `NSSupportsLiveActivities=true`.
5. Execute no iPhone físico. Abra a app, autorize Localização **Precisa**, inicie a viagem **com a app em primeiro plano**, depois abra a música e bloqueie o ecrã. Verifique, por comparação com referência, se os quilómetros continuam a aumentar e se a Live Activity aparece no ecrã bloqueado/Dynamic Island conforme o dispositivo e as definições.

## Arquitetura

- `BackgroundGPSRecorder.swift`: singleton nativo Core Location. Cada percurso `RM...` grava NDJSON num ficheiro por viagem no Application Support, acessível após o primeiro desbloqueio, para recuperar pontos no regresso à app. Não depende do `WKWebView` estar ativo.
- `RotaMeterWebScreen.swift`: ponte JavaScript ↔ Swift para localização, iniciar, pausa manual, retomar, terminar e sincronizar posições por timestamp. Não reinicia a viagem ao mudar de aplicação.
- `Shared/TripActivityAttributes.swift` e `RotaMeterLiveWidget/`: Live Activity com estado e distância acumulada **do sistema nativo**. Não é uma janela Picture-in-Picture arbitrária. Para a tocar, o iOS abre a aplicação.
- `www/`: versão web, com GPS nativo por ponte, mapa e relatório PDF/GPX.

## Restrições e testes pendentes

O iOS decide quando suspender processos e **encerrar a aplicação à força pode interromper a localização**. A autorização e o background mode não são garantia absoluta. Uso de GPS em segundo plano aumenta consumo da bateria. A permissão pode ser retirada nas Definições. A Live Activity tem regras e duração próprias.

A distância nativa na Live Activity é orientativa. O valor do relatório continua a ser calculado pelo motor web **após importar os pontos originais**, aplicando filtros de precisão, não pela Live Activity. A rota e o custo podem ficar incompletos se faltarem fixos GPS. A sincronização é limitada a lotes de 400 pontos para evitar bloquear o interface.

**Falta implementar navegação vocal nativa robusta em segundo plano** e validar cálculo de manobras e integração de voz. A versão experimental não inclui Android nativo, CarPlay, serviço de mapas com SLA comercial, recibos fiscais ou taxímetro certificado.

Não testado/assinado por falta de macOS/Xcode neste ambiente. Ver `../AUDITORIA.md` para critérios de aceitação antes de venda.
