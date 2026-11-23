# Decisões e desafios de engenharia

## Um catálogo precisa ser interpretado antes de ser exibido

O aplicativo converte formatos externos para objetos internos. A separação entre fetch, parser e UI permite testar leitura com fixtures pequenas, sem rede. Um caso real foi corrigir fontes abreviadas contendo caminhos e query strings: a extensão precisa ser inserida no pathname, antes dos parâmetros. Os testes cobrem esse detalhe e impedem caminhos que escapem da base.

## Identidade editorial e URL disponível são verificações diferentes

Uma entrada misturava referências de duas produções. Corrigir apenas o link não garantia que o vídeo pertencia à série desejada. O leitor passou a normalizar identidade e filtrar referências; caches/progresso da entrada antiga foram migrados ou descartados. O teste usa IDs sintéticos de servidor e referências de metadados, sem incluir vídeos.

## Eventos de reprodução têm ciclo de vida

O player local precisa pausar quando a TV assume a mídia. Ao sair da sessão, a retomada deve respeitar o primeiro plano do aplicativo e os controles do anfitrião. Eventos de progresso da mídia anterior não podem sobrescrever a posição atual. Esse fluxo foi testado com clientes simulados.

## Descoberta de rede precisa de limpeza

A busca Cast usa APIs nativas e tem uma janela limitada. Fechar a tela ou ir para segundo plano deve retirar callbacks e liberar o lock. A interface oferece nova busca e orientações sobre Wi-Fi, VPN e Google Play Services. Bluetooth é tratado como saída de áudio do sistema, não como transporte de vídeo para qualquer TV.

## Atualização precisa preservar a plataforma

As versões são comparadas numericamente dentro de cada plataforma. A página recebe platform explicitamente e oferece o pacote correspondente. Um usuário de Roku não recebe o APK; um usuário Linux não precisa baixar o pacote Windows. O aviso é adiado durante vídeo e pode ser fechado.

## IA como ferramenta, sem confundir o escopo

O desenvolvimento e a documentação tiveram apoio de IA. O estudo de artefatos usou REA; partes da interface-base existiam como JavaScript compilado. O portfólio distingue integrações/adaptações próprias, bibliotecas e referências, e não atribui todo o produto do zero a uma implementação manual individual.
