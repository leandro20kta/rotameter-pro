# RotaMeter PRO V13 — Continuidade de viagem nativa (beta)

**ATENÇÃO: este pacote é CÓDIGO-FONTE para compilar, não um aplicativo iOS/Android já instalado, compilado, homologado ou validado num telefone físico.** O endereço GitHub Pages atual é a V12.1 WEB e **não consegue** manter GPS em segundo plano de forma garantida.

## O que a V13 prepara

### iPhone (iOS nativo)
- Core Location mantém registo independente do navegador durante uma viagem iniciada com a aplicação aberta, sujeito a permissões e regras do iOS.
- Usa Location Background Mode; fora da viagem passa a solicitar apenas a posição atual para não gastar bateria continuamente.
- Cada percurso tem registo local NDJSON, filtros, recuperação e sincronização de lotes superiores a 350 posições.
- Live Activity com quilómetros e estado no ecrã bloqueado e Dynamic Island, em aparelhos compatíveis; um toque abre o RotaMeter.
- Voz de orientação nativa e libertação da sessão de áudio para não bloquear permanentemente outras aplicações musicais.
- iOS **não permite** uma bolha arbitrária por cima do WhatsApp/Spotify. A Live Activity é o comportamento suportado.

### Android (app nativa)
- Serviço foreground de GPS com notificação visível e armazenamento local de cada viagem separado da WebView.
- Reinício pelo sistema do serviço interrompido sem pausa manual, sujeito à política de bateria do fabricante. Encerramento forçado pode parar tudo.
- Mini-janela sobre outros aplicativos com distância e atalho de volta ao RotaMeter: **apenas se o utilizador conceder a permissão especial de sobreposição**. Não é navegação 3D ou mapa integral sobre outros apps.
- Ao voltar ao aplicativo, a mini-janela desaparece e o mapa principal retorna.
- Atualização para API 36 / AGP 8.13.2 / Gradle 8.13 e workflow GitHub Actions para gerar APK de testes quando o código for enviado ao repositório.

## Testes desta etapa
- JavaScript: validação sintática.
- Swift: análise sintática (`swiftc -frontend -parse`, não equivale a uma compilação Xcode).
- AndroidManifest e configuração: validação estrutural, sem Android SDK local.
- Simulações Chromium/Playwright: iniciar, minimizar, manter estado, importar GPS em lotes, pausar, exportar mapa PDF por serviço simulado.
- Ainda **não** existe teste em iPhone/Android físico, APK/IPA assinado ou aceitação da App Store/Play Store.

## Para conseguir a função exigida num iPhone
1. Mac com Xcode e XcodeGen, abrir `ios-native/project.yml` via `xcodegen generate`.
2. Configurar assinatura Apple e IDs do bundle e Live Widget Extension.
3. Compilar e instalar no iPhone; autorizar GPS preciso e Live Activities.
4. Fazer teste real com Spotify, WhatsApp, ecrã bloqueado, chamada telefónica, paragens e PDF.

## Android
Abra `android-native` no Android Studio atual, com SDK 36. O workflow em `.github/workflows/android-build-v13.yml` cria um APK debug depois que o projeto completo estiver no GitHub. **APK debug não é AAB assinado para Google Play.**

## Privacidade e legalidade
O registo é apenas da viagem iniciada conscientemente pelo condutor. Não existem outros utilizadores próximos, rastreio de terceiros ou telemetria remota. Serviços públicos de mapas são apenas para beta; uso comercial exige revisão de termos e privacidade. **Não é taxímetro legalmente homologado** e o custo é uma estimativa configurável.
