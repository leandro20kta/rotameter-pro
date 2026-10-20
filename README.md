# RotaMeter PRO — projeto privado

Aplicação de demonstração de percursos GPS, estimativa em euros para carro/mota e relatórios PDF/GPX. **Não é taxímetro homologado nem licença para transporte remunerado.**

## Estado da versão V9 — 20 de outubro de 2026

A implementação-fonte V9 foi preparada num pacote separado, ainda **não carregado neste repositório**. Este README e a [nota da V9](docs/ESTADO_V9.md) não equivalem à publicação do código. A versão web permite testes no Safari, mas não mantém GPS de modo fiável com o ecrã bloqueado.

A fonte nativa experimental iOS utiliza Core Location para gravar posições fora do `WKWebView`, sincroniza pontos ao regressar e inclui um widget Live Activity para ecrã bloqueado e Dynamic Island. Não foi compilada/assinada no Xcode nem testada num iPhone físico. GPS contínuo pode ser interrompido pelo iOS, especialmente após fecho forçado. Orientação vocal nativa em segundo plano e janela flutuante sobre outras apps **não estão prontas**.

## Importar o pacote V9

Descarregue o pacote completo da conversa ChatGPT, extraia-o no computador e execute `scripts/publicar-github.ps1` no PowerShell com Git instalado e sessão GitHub autorizada. O script clona este repositório privado, copia o projeto e faz commit e push para a branch `main` sem forçar histórico. Também é possível enviar manualmente as pastas `web`, `ios-native`, `qa`, `scripts` e `.github`.

Depois de importar, confirme que `web/app.js`, `ios-native/RotaMeterNative/BackgroundGPSRecorder.swift` e `ios-native/RotaMeterLiveWidget/RotaMeterLiveWidget.swift` estão presentes. O GitHub Pages para um repositório privado depende do plano da conta; o código web pode ser publicado noutro alojamento HTTPS. Para instalar a aplicação nativa no iPhone, é necessário macOS, Xcode, Apple Team e testes físicos.

A documentação de auditoria acompanha o pacote V9, e os limites atuais estão em [docs/ESTADO_V9.md](docs/ESTADO_V9.md).