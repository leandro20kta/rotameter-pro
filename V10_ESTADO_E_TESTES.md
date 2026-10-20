# RotaMeter PRO — versão V10 (2026-10-20)

## Situação confirmada
- Repositório privado criado e documentação presente.
- Código completo V10 disponível num pacote ZIP da conversa; ainda não carregado integralmente no repositório.
- Aplicação web para testes HTTPS em iPhone e Android.
- Fonte experimental de aplicação nativa para iOS 17+ baseada em Core Location e Live Activities.
- V10: leitura dos pontos GPS nativos em blocos, e ponte JS → iOS para voz de manobras da rota planeada.

## Testes executados
- Sintaxe JavaScript e análise sintática Swift: passaram.
- Motor GPS simulado: distância, espera, paragens, rejeição de saltos e deduplicação passaram.
- Ponte simulada iOS/Web: início, troca de aplicação, sincronização, pausa manual passaram.
- Envio simulado de manobras para o módulo de voz nativo: passou.

## O que NÃO está aprovado como pronto
- Não há build iOS compilado, assinado e testado fisicamente em segundo plano.
- A voz nativa, o GPS com ecrã bloqueado e a Live Activity precisam de validação real no iPhone.
- A versão web não garante localização contínua com o ecrã bloqueado.
- Não existe janela flutuante arbitrária sobre outras apps no iOS.
- Não há app nativa Android nem publicação Google Play / Apple App Store.
- Não há navegação com trânsito e alertas em tempo real iguais aos do Waze.
- Não há contas, partilha GPS entre pessoas nem transferência de condução; estes recursos exigem requisitos, autenticação e consentimento.
- Não é taxímetro homologado nem licença de transporte de passageiros.

## Próximas ações
Importar o código, compilar e testar num iPhone físico com Spotify aberto, ecrã bloqueado e rede intermitente. Antes de um beta público, selecionar serviço de rotas adequado ao uso comercial e validar privacidade, segurança e legislação.
