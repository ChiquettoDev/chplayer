# Validação e limites

## Reproduzível nesta amostra

`npm test` executa 13 testes com node:test e node:assert: importação de listas, URLs relativas, deduplicação, categorias, agrupamento de episódios, links abreviados, parâmetros de legenda, correção da entrada misturada, conversão de mídia Google Cast e limites de avanço/retrocesso.

`npm run check:server` verifica sintaxe do módulo de servidor. O workflow GitHub Actions executa ambos com Node 22. A existência desse workflow não significa que todos os clientes de dispositivo sejam compilados pelo CI.

## Verificado na área do produto

A rodada documentada gerou APK Android assinado, pacote de atualização Electron, IPK LG e ZIP Roku. Os arquivos oferecidos para as cinco plataformas tiveram tamanhos/hashes verificados. Também houve testes simulados dos controles Cast, descoberta e aviso de atualização.

## Ainda exige dispositivo/serviços reais

A última rodada de descoberta Cast não teve conexão a TV física validada. Os pacotes Windows/LG/Roku não foram executados em aparelhos reais nessa rodada. Codecs, isolamento de rede, disponibilidade da fonte e compatibilidade do receptor continuam exigindo teste de integração. Uma resposta HTTP de mídia não prova a reprodução integral do conteúdo.

Esta amostra não contém o ambiente completo de produção, SDKs, assinatura, infraestrutura provisionada ou bundles de referência. Portanto, os módulos de interface não constituem uma demonstração instalável a partir deste repositório.
