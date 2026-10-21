# RotaMeter PRO — estado de entrega V13 (21/10/2026)

## Publicação e builds comprovados
- [x] Código V13 de Android e iOS no branch `main`.
- [x] **iOS Simulator:** build nativo com Live Activity aprovado no GitHub Actions: https://github.com/leandro20kta/rotameter-pro/actions/runs/39519104963
- [x] **Android Debug APK:** build nativo aprovado e artefacto `RotaMeter-PRO-V13-Android-Debug-APK` disponível em https://github.com/leandro20kta/rotameter-pro/actions/runs/39519039054
- [x] GPS Android num foreground service separado da interface, notificação persistente e mini-janela opcional com autorização de sobreposição.
- [x] iOS Core Location em segundo plano e Live Activity com distância e estado, sujeito a permissões do aparelho.
- [x] Android API 36 com Android Gradle Plugin 8.13.2.
- [x] Testes simulados de cálculo, sincronização, recuperação de lotes GPS, paragens, voz e mapa PDF.
- [x] Site web V12.1 publicado: https://leandro20kta.github.io/rotameter-pro/

## Bloqueios ainda abertos
- [ ] **Teste real em iPhone** com ecrã bloqueado, Spotify, chamada e diferentes condições GPS.
- [ ] **Teste real em Android** da notificação, recolha de GPS e mini-janela com permissão explícita.
- [ ] IPA iOS assinado e instalável num iPhone físico. O build aprovado é para simulador e não é instalável diretamente pelo Safari.
- [ ] AAB Android de distribuição, chave de assinatura e revisão Google Play.
- [ ] Apple App Store: Apple Developer Team, assinatura, TestFlight e revisão.
- [ ] Serviço de mapas e rotas com termos aptos ao uso comercial, política de privacidade final e auditoria de precisão.

## Limitações incontornáveis
Uma versão web não pode garantir GPS em segundo plano no iOS. A Live Activity da Apple não é uma janela flutuante arbitrária sobre outras apps. Não é possível garantir execução após encerramento forçado e nem substituir certificação metrológica/autorizações de transporte. O RotaMeter continua a ser um **estimador beta, não taxímetro homologado**.

**Status correto:** código e builds de simulador/debug concluídos; validação física e aprovação das lojas pendentes.
