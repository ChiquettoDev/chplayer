<p align="center"><img src="docs/assets/banner.svg" alt="CHPlayer — estudo de caso de um aplicativo de mídia multiplataforma" width="100%"></p>

# CHPlayer

**Aplicativo de mídia multiplataforma com reprodução, controle remoto pela TV, salas privadas e distribuição de atualizações.**

Projeto de portfólio de [João Chiquetto / ChiquettoDev](https://github.com/ChiquettoDev). Este repositório apresenta a arquitetura, decisões técnicas e módulos selecionados do produto. Desenvolvimento realizado com apoio de ferramentas de IA; o escopo público e as limitações estão descritos abaixo.

`React Native` · `Expo` · `Kotlin` · `Google Cast` · `Electron` · `webOS` · `BrightScript` · `Deno` · `PostgreSQL / Supabase`

## O problema

Organizar navegação e reprodução de mídia em diferentes tipos de dispositivo, mantendo preferências, acesso e distribuição coerentes. Um celular precisa de interação por toque e controle Cast; um computador exige janela responsiva e teclado; uma TV precisa de foco e navegação por controle remoto.

## Funcionalidades desenvolvidas

- Catálogo com busca, favoritos, fontes alternativas, filmes e episódios por temporada.
- Reprodução local e recuperação do progresso.
- Google Cast no Android, com descoberta ativa no Wi-Fi e controle de play/pausa, volume, canais e avanço/retrocesso de 20 segundos.
- Salas privadas por convite, chat e sincronização controlada pelo anfitrião.
- Ativação de acesso, processamento de pedidos e entrega por e-mail no servidor.
- Página de atualização com arquivo, versão e instruções específicos de cada plataforma.
- Correções e testes de leitores de catálogo para caminhos, parâmetros de URL e identificação de títulos.

## Plataformas e versões do produto documentadas

| Plataforma | Tecnologia | Versão documentada |
|---|---|---|
| Android | React Native / Expo + Kotlin | 0.3.8 |
| Windows / Linux | Electron | 0.5.5 |
| LG TV | Aplicativo webOS | 0.4.5 |
| Roku | SceneGraph / BrightScript | 0.4.4 |

Esses números descrevem os pacotes do produto. Este repositório contém amostras revisadas para portfólio, não os instaladores completos nem um catálogo público de conteúdo.

## Arquitetura

```mermaid
flowchart LR
  A[Android / PC / LG / Roku] --> B[Catálogo configurado]
  A --> C[Supabase Edge Function]
  C --> D[(PostgreSQL)]
  E[Webhook de compra] --> C
  C --> F[Serviço de e-mail]
  A --> G[Manifesto de versões]
  G --> H[Página de atualização]
  A --> I[Salas privadas e chat]
  I --> C
  J[Android] --> K[Google Cast na rede Wi-Fi]
```

[Arquitetura e fluxo dos módulos](docs/architecture.md) · [Decisões e desafios](docs/engineering.md) · [Validação e limites](docs/validation.md)

## Código para explorar

| Área | Onde começar |
|---|---|
| Interface Android | [App.js](src/android/App.js) |
| Descoberta de TVs | [CastDiscovery.js](src/android/CastDiscovery.js) e [ponte Kotlin](src/android/native/CastDiscoveryPackage.kt) |
| Reprodução remota | [TVPlayback.js](src/android/TVPlayback.js) |
| Leitura de catálogos | [playlist.cjs](src/android/playlist.cjs) e [saimo.cjs](src/android/saimo.cjs) |
| Salas e chat | [Rooms.js](src/android/Rooms.js) |
| Electron / IPC | [main.cjs](src/desktop/main.cjs) e [preload.cjs](src/desktop/preload.cjs) |
| Servidor e dados | [index.mjs](src/server/index.mjs) e [migrações](src/server/migrations) |
| Atualização por dispositivo | [lógica da página](src/site/updates-page.js) e [Roku](src/roku/UpdateController.brs) |

## Executar os testes

Requer Node.js 22 ou superior. Os testes usam o executor nativo do Node e não precisam de instalar dependências:

```bash
git clone https://github.com/ChiquettoDev/chplayer.git
cd chplayer
npm test
npm run check:server
```

São **13 testes automatizados** de parsers e conversão de mídia Cast. Eles usam dados sintéticos e não acessam catálogos, contas ou dispositivos reais. A integração contínua executa os mesmos comandos.

## Aprendizados

Separar transporte, interpretação de dados e interface; tratar variações de formato sem quebrar URLs; sincronizar players sem reaplicar eventos antigos; preservar limites de acesso no servidor; adaptar interação a toque, mouse e controle remoto; e distribuir versões diferentes por plataforma.

## Escopo, autoria e referências

A base de referência Saimo foi estudada com a ferramenta [REA](https://github.com/morluto/rea). Este repositório não apresenta bundles de referência ou bibliotecas de terceiros como autoria própria. Os módulos selecionados mostram adaptações e integrações do projeto CHPlayer. Os nomes de formatos e testes de regressão foram preservados para documentar problemas reais de compatibilidade.

Não há fontes de vídeo, filmes, episódios, chaves de acesso ou credenciais de produção nesta publicação. Links a serviços oficiais não representam extração ou retransmissão de seus catálogos. Consulte [o escopo da amostra](src/README.md) e [os avisos de autoria](NOTICE.md).
