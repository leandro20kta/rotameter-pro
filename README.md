# RotaMeter PRO V8.1 — Código em importação

**Estado atual:** O repositório privado já está criado. Para colocar o projeto completo aqui, descarregue o ficheiro `RotaMeter_PRO_V8_1_IMPORTAR_GITHUB.zip` da conversa e carregue-o em **Add file → Upload files** na raiz do repositório. Não descompacte o ZIP nesta etapa. O workflow `Importar pacote V8.1` irá descompactá-lo, guardar os ficheiros e eliminar o ZIP automaticamente. Se GitHub Actions estiver desativado, ative-o em **Settings → Actions** e execute o workflow manualmente. Confira depois as pastas `web/`, `ios-native/` e `qa/`.

# RotaMeter PRO V8.1 — Premium White

Versão **beta de demonstração** de um estimador de custos de deslocação com GPS para carro e mota. A interface usa mapa claro, marcador vetorial pequeno (carro e mota), rotas planeadas separadas das posições GPS reais, paragens, discriminação por etapa e relatório PDF/GPX.

**O software não é taxímetro legalmente homologado, fatura, recibo fiscal nem licença para transporte remunerado.** Os valores iniciais por carro/mota são exemplos configuráveis, não preços oficiais de Portugal. Informe os parâmetros antes da viagem. Em caso de interrupção GPS, a distância pode ficar subestimada.

## Testar na web (iPhone/Android/PC)

1. Descompacte o ZIP WEB; carregue a pasta completa (com `index.html` na raiz) em um serviço HTTPS de hospedagem estática, por exemplo [Netlify Drop](https://app.netlify.com/drop). Não introduza o ZIP num chatbot/Agent.
2. Abra o URL HTTPS no Safari, autorize a **Localização precisa** e confirme o texto `V8.1 · PREMIUM WHITE · GPS`.
3. Escolha Carro ou Mota **antes de iniciar**; ajuste as tarifas de exemplo em **Configurar**.
4. Toque **Iniciar viagem** antes de sair do ponto de origem. Pode registar a recolha, várias paragens, editar o nome das paragens e visualizar o valor estimado.
5. Em **Finalizar e PDF**, descarregue ou partilhe o relatório. O mapa com ruas no PDF é **opcional**: depende de internet e das bibliotecas externas; caso não carregue, o PDF inclui um esquema do trajeto e pode exportar GPX.
6. No iPhone: Safari → Partilhar → **Adicionar ao ecrã principal**. A instalação web não confere permissões nativas de GPS em segundo plano.

## Dados e privacidade

A sessão e as viagens são guardadas **localmente no navegador**; não é necessário criar conta. Evite limpar os dados do Safari durante uma viagem. Faça cópias do PDF/GPX de cada percurso. O armazenamento local é limitado; o histórico não é um backup de longo prazo. A pesquisa de destinos e as prévias de estradas enviam os parâmetros necessários aos serviços públicos Photon e OSRM. Os mosaicos cartográficos são obtidos pelo OpenFreeMap/OpenStreetMap.

## O que acontece ao sair da aplicação

A versão WEB guarda a sessão e procura retomá-la com o mesmo identificador quando a página é recarregada. Porém, **iOS/Safari podem suspender completamente a geolocalização quando o ecrã fica bloqueado ou o app fica em segundo plano**; não há forma segura de contornar isso com um PWA. Trechos sem GPS ficam identificados, e não são cobrados como quilómetros presumidos.

O código-fonte da versão **nativa experimental** está em `ios-native/`; necessita **Mac, Xcode, assinatura e testes reais** antes de ser instalável. Inclui um esqueleto Core Location para guardar posições em segundo plano, sujeitas às permissões e regras do iOS. Não inclui suporte pronto para Live Activities/Dynamic Island, nem para janela sobreposta a outros apps (não é possível criar uma janela flutuante arbitrária no iOS).

## Publicar no GitHub

O projeto foi preparado para um repositório próprio chamado `rotameter-pro`. Crie um **repositório privado vazio** em [github.com/new](https://github.com/new) com esse nome. Depois:

```sh
git init
git add .
git commit -m "RotaMeter PRO V8.1 - GPS, relatórios e auditoria"
git branch -M main
git remote add origin https://github.com/SEU_UTILIZADOR/rotameter-pro.git
git push -u origin main
```

É possível publicar somente os ficheiros de `web/` como site estático, num provedor HTTPS. Antes de torná-lo público como produto, audite licenças, proteção de dados, disponibilidade/limites dos serviços de mapas, legislação aplicável e a precisão metrológica.

## Estado da V8.1

- [x] Cabeçalho, mapa claro e layout responsivo 9:16 / 16:9
- [x] Marcadores pequenos e distintos para carro/mota
- [x] Perfil de tarifa independente por veículo, fixado por viagem
- [x] Filtro GPS contra precisão baixa e saltos improváveis
- [x] Persistência da viagem após recarregar a página com o mesmo ID
- [x] Registo de recolha, paragens e identificação manual; identificação automática por POI **não garantida**
- [x] PDF e GPX, com custos e etapas detalhados
- [x] Código-fonte experimental para Core Location iOS
- [ ] Teste com iPhone físico, ecrã bloqueado e música em segundo plano
- [ ] Validação dos serviços externos do mapa e das manobras em estrada real
- [ ] Versão iOS compilada e assinada (IPA/TestFlight)
- [ ] Live Activity/Lock Screen e indicadores de navegação fora da app
- [ ] Backend de mapas/roteamento com SLA e quota para uso comercial
- [ ] Testes jurídicos/metrológicos e revisão de armazenamento privado

Consultar também `AUDITORIA.md`.