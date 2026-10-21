# Instalação do RotaMeter PRO V13 num iPhone físico (Windows)

**Estado:** compilação ARM64 de dispositivo físico aprovada em GitHub Actions. O IPA é **não assinado**. Não foi instalado ou validado num iPhone real.

## Obter os IPA
- GitHub Actions: https://github.com/leandro20kta/rotameter-pro/actions/runs/39550629174
- Artefacto `RotaMeter-PRO-iPhone-IPA-SEM-ASSINATURA`.
- Contém `RotaMeter_PRO_iPhone_GPS_TESTE_SEM_WIDGET_SEM_ASSINAR.ipa` (GPS primeiro) e `RotaMeter_PRO_iPhone_COM_WIDGET_SEM_ASSINAR.ipa` (extensão Live Activity; a assinatura gratuita pode não aceitar extensões).

## Teste com Windows e conta Apple gratuita
1. Instale Apple Devices ou os componentes oficiais necessários para USB no Windows e um instalador de IPA com assinatura pessoal, como o Sideloadly (https://sideloadly.io/). Leia a política e os requisitos da ferramenta antes de inserir a conta Apple.
2. Ligue o iPhone por cabo USB ao Windows; desbloqueie e selecione **Confiar**.
3. Selecione o IPA **GPS_TESTE_SEM_WIDGET** no programa, escolha o dispositivo e assine com a sua própria conta Apple (o programa pode solicitar autenticação de dois fatores). Nunca entregue a palavra-passe a terceiros.
4. No iPhone, aceite **Developer Mode** se solicitado (Definições > Privacidade e Segurança), e confie no perfil de desenvolvedor em Definições > Geral > VPN e Gestão de Dispositivos, quando necessário.
5. Abra a aplicação, autorize localização precisa, inicie uma viagem com o aplicativo visível.
6. Abra o Spotify durante alguns minutos, bloqueie o ecrã, ande por uma rota conhecida, regresse e termine a viagem. Compare o PDF e a distância com a rota realmente percorrida.

A Apple limita as assinaturas de contas gratuitas: normalmente precisam de ser renovadas após 7 dias. A disponibilidade de Live Activity, a execução GPS em segundo plano e compatibilidade em cada aparelho **não estão garantidas** sem teste físico. O IPA não é uma publicação da App Store/TestFlight, nem está aprovado para uso comercial.

**iPhone:** no iOS, não é possível criar uma janela arbitrária por cima de Spotify/WhatsApp. A Dynamic Island e a Live Activity (com o IPA completo e assinatura funcional) são os mecanismos compatíveis.

**GitHub Pages:** https://leandro20kta.github.io/rotameter-pro/ hospeda apenas a versão web V12.1; não suporta GPS persistente garantido quando se bloqueia o iPhone.
