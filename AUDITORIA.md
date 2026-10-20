# Auditoria técnica — RotaMeter PRO V8.1

Data: 20/10/2026. Resultado: **beta funcional para testes simulados; não pronta para venda ou condução sem validação real**.

| Prioridade | Área | Achado e tratamento | Estado |
| --- | --- | --- | --- |
| P0 | GPS em segundo plano | Um site/PWA iOS não tem garantia de localização contínua quando suspenso. Fonte SwiftUI/Core Location separada, sujeita a autorização de background e compilação no Mac. | **Pendente teste físico** |
| P0 | Janela sobreposta no iOS | Janela flutuante arbitrária sobre Spotify e outros apps não é suportada. Live Activities / Lock Screen requerem implementação nativa separada. | **Não implementado** |
| P1 | Recarregar página durante viagem | Sessão recuperada com ID, quilómetros e paragens, sem criar nova viagem; intervalos sem sinal assinalados e não presumidos. | **Testado em simulação** |
| P1 | Lote duplicado de GPS nativo | Filtragem por timestamp original e deduplicação; carrega leituras em ordem. | **Testado em simulação** |
| P1 | Salto GPS | Fix com baixa precisão ou velocidade incompatível não aumenta quilómetros. | **Testado em simulação** |
| P1 | Carro/mota | Marcadores SVG pequenos e alternância de modelo/perfil de valor. | **Testado na interface simulada** |
| P1 | Paragem e custos | Espera após tolerância, paragem manual/automática, nomes editáveis, etapas com tempos e custos no PDF. | **Testado em simulação** |
| P1 | PDF e GPX | PDF validado, 3 páginas no cenário ensaiado; cartografia real incluída apenas quando serviços externos respondem. | **PDF local validado** |
| P1 | Navegação rodoviária | Uso de um serviço OSRM de demonstração. Não inclui garantia de trânsito em tempo real nem restrições específicas da mota. | **Limitação conhecida** |
| P1 | Persistência de histórico | `localStorage` tem quotas e pode perder dados se for limpo. Necessária futura migração para IndexedDB ou armazenamento mais robusto. | **Pendente para produto** |
| P2 | Performance do mapa | Cache de tiles reduzida, estilo claro sem edifícios 3D por defeito; visualização 3D sob escolha. | **Teste online pendente** |
| P2 | Performance da interface | Evitada a reconstrução da linha de eventos a cada atualização sem mudança de dados e carregamento desnecessário do SVG do veículo. | **Testado em simulação** |
| P1 | Privacidade/compliance | O GPS preciso revela rotas pessoais, parceiros/fornecedores externos recebem solicitações de mapa e pesquisa. Requer política de privacidade, retenção, licença e revisão de RGPD. | **Pendente para venda** |

## Testes efetuados

- Sintaxe dos scripts JavaScript verificada com `node --check`.
- Browser controlado com HTML/CSS/JS **do próprio projeto**, geolocalização simulada e sem acesso aos servidores externos: GPS permitido, 47 m simulados, troca para mota, 1 paragem nomeada, recarga da página, mesmo identificador e distância guardada, finalização, botão fechar e exportação PDF. Sem exceções JavaScript, sem overflow horizontal em 390 × 844 e 852 × 393.
- Lote de GPS nativo simulado com 12,18 m, 25 segundos de espera após tolerância, paragem automática e duplicação evitada.
- Relatório PDF com 3 páginas inspecionado. **O traçado é esquemático no teste sem internet**.

## Não testado e não afirmado

- Funcionamento com GPS e mapas reais no iPhone do utilizador.
- Continuidade com o ecrã bloqueado, no Spotify, após chamadas, notificações, bloqueio de processo ou *force-quit*.
- Precisão do GPS em túneis, estradas sinuosas, rotundas, tráfego intenso e cidades densas.
- Compilação e assinatura nativa iOS neste ambiente (sem Xcode/macOS).
- Disponibilidade/licença comercial dos servidores de roteamento públicos e reverse-geocoding com nomes de estabelecimentos.
- Taxímetro legal homologado e autorização de prestação de transporte remunerado.

### Condições de lançamento comercial

Aplicativo iOS nativo testado em iPhone; arquitetura de dados persistente; navegação com serviço de rotas adequado a carro e mota; privacidade e RGPD; termos e licenças dos dados geográficos; auditoria de medições e regras de transporte local. A criação de conta no GitHub, a publicação na web e o teste de estrada ainda são passos distintos, não concluídos por este ZIP.