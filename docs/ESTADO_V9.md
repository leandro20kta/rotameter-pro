# RotaMeter PRO V9 — GPS nativo e continuidade

## Situação em 20/10/2026

A implementação V9 encontra-se em preparação fora do repositório e será enviada num pacote separado. **Este documento não significa que o código V9 já esteja publicado nem que exista uma aplicação iOS instalada.**

### Implementado no pacote de desenvolvimento
- Protótipo web preserva a viagem em armazenamento local ao mudar de página/recarregar, mas não mede GPS de modo fiável com o iPhone bloqueado.
- Código Swift para Core Location e gravação independente do WKWebView, com dados por identificador de viagem.
- Recuperação de lotes de localizações e deduplicação; pausa manual distinta da passagem a segundo plano.
- Estrutura de Live Activity para ecrã bloqueado e Dynamic Island, sujeita a compilação e permissão no iPhone.
- Mapa MapLibre, modos carro/mota, paragens, exportação PDF e GPX, com limitações documentadas.

### Falta validar/entregar para produção
- Compilar e assinar no Xcode em macOS, testar em iPhone real com Spotify aberto e ecrã bloqueado.
- Testar precisão GPS, bateria, recuperação depois de falta de rede e publicação externa.
- Instruções de voz em segundo plano e integração real com rotas comerciais.
- Apple TestFlight / App Store, avaliação jurídica e metrológica e serviços de mapas com SLA.
- A janela flutuante arbitrária sobre outras aplicações não é disponibilizada ao público pelo iOS; Live Activity é a alternativa suportada.

O RotaMeter NÃO é um taxímetro homologado, não produz recibo fiscal e não é autorização para transporte remunerado de passageiros.