# Amostras de implementação

Esta pasta contém módulos selecionados do CHPlayer, organizados para leitura técnica. **Não é uma distribuição completa compilável do produto.** Os identificadores e endereços de produção foram substituídos por exemplos.

- android: UI React Native, leitores de catálogo, Cast, salas, persistência e testes puros. `native` contém a ponte Kotlin.
- desktop: processo principal/preload Electron e adaptações próprias da interface.
- lg: integração webOS de ativação, salas e atualização.
- roku: controlador e consulta de atualização BrightScript.
- server: função Deno e migrações SQL para pedidos, licenças e salas.
- site: página/lógica de atualização por plataforma.

Não estão incluídos APKs, catálogo de mídia, vídeos, dados de compradores, chaves, configuração de produção, SDKs ou bundles compilados de referência. Em PC/LG, as amostras pressupõem os objetos da interface-base descritos na arquitetura e não iniciam isoladamente. Os testes puros de parser/Cast podem ser executados da raiz com `npm test`.
