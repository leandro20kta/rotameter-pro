# RotaMeter PRO V11 — Plataforma partilhada (beta)

Atualizado em 20 de outubro de 2026. O repositório continua privado.

## Decisões
- Não implementar localização ou alertas de outros utilizadores próximos.
- Interface e motor de cálculo únicos em HTML, CSS e JavaScript, destinados a web, iOS e Android.
- Código-fonte da V11 preparado nos pacotes entregues na conversa; **ainda não carregado integralmente neste repositório**.
- iOS: SwiftUI/WebKit + Core Location para registo de viagens com a app em segundo plano + estrutura de Live Activity.
- Android: Kotlin/WebViewAssetLoader + foreground service de localização, com notificação e ficheiro NDJSON local, associado à viagem iniciada pelo utilizador.
- Permissões de localização apenas para a finalidade central de medição e navegação; sem monitorização de terceiros.

## Relatório PDF
- Mapa de ruas quando há cartografia disponível; traçado GPS real sobreposto, início/fim e paragens numeradas.
- Se não houver serviço de mapa, mostrar **esquema GPS com interrupções**; nunca simular ruas não observadas.
- Detalhes por etapa: horários, quilómetros, espera, custo e paragens.
- Nomes extraídos de pontos de interesse são sugestões que precisam de confirmação.

## Testes simulados executados
- `node --check` no JavaScript: passou.
- Sintaxe do AndroidManifest: passou.
- Fluxos de GPS simulado, veículo, paragens, finalização, PDF e recuperação após reload: passaram.
- Ponte Android simulada, envio de comandos e sincronização, troca de visibilidade: passaram.
- PDF offline e mapa GPS esquemático: gerados e inspecionados.

## Bloqueios antes da comercialização
- Compilar o Android no Android Studio e iOS no Xcode e corrigir eventuais falhas de build.
- Testar segundo plano, bloqueio, chamadas, Spotify, bateria, falhas GPS e duração em iPhone e Android físicos.
- Finalizar política de privacidade RGPD e divulgação de localização, fornecedores de mapas aptos a uso comercial.
- Assinar AAB/APK e IPA; criar contas nas lojas e submeter para revisão.
- Validar legislação sobre transporte remunerado e homologação; **RotaMeter não é taxímetro homologado**.

O código da V11 é uma base para a transição, não uma confirmação de aprovação na App Store ou Google Play.