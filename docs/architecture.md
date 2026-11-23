# Arquitetura e navegação no código

## Android

App.js concentra os componentes de tela e o estado da biblioteca. saimo-feed.js baixa arquivos com limite de tamanho, timeout e cache; saimo.cjs interpreta índice, fichas, destaques e episódios. playlist.cjs interpreta listas importadas e normaliza itens. storage.js persiste favoritos/progresso e alterna arquivos de cache. Player.js conecta expo-video aos controles e ao fluxo de transmissão.

CastDiscovery.js chama NativeModules.CHCastDiscovery. O pacote Kotlin registra a ponte; o módulo usa o seletor do CastContext, MediaRouter em busca ativa e MulticastLock. A busca tem timeout e limpeza no ciclo de vida. Os dispositivos são obtidos do SDK Cast e selecionados pelo identificador. TVPlayback.js carrega mídia no receptor, recebe progresso e oferece os comandos. cast-media.cjs trata formato, posição e associação de eventos à mídia correta.

Rooms.js envia comandos create/read/sync/message para a função do servidor. O anfitrião envia estado; convidados calculam a posição esperada e ajustam o player. Isso usa polling, não uma implementação de streaming de vídeo entre os participantes.

## Servidor

createHandler em src/server/index.mjs recebe ambiente e função de rede, o que separa configuração de código. As rotas tratam webhooks, instalação, ativação, status, download e salas. Os segredos vêm do ambiente. As migrações criam tabelas e funções chplayer_* chamadas por RPC. O cliente não recebe a credencial de serviço do Supabase.

As amostras mantêm validação de tipos, tamanho do corpo, tokens, evento/produto e limites de uso. Não há dados reais de pedidos ou clientes no repositório.

## Windows/Linux e LG

No PC, main.cjs cria a janela e valida IPC; preload.cjs expõe uma superfície limitada à página. desktop.js/CSS adaptam a interface a mouse/teclado. chplayer.js integra ativação e salas; updates.js consulta a própria plataforma. A interface-base compilada foi excluída desta publicação, portanto esses módulos não iniciam sozinhos.

Na LG, a integração roda em webOS e usa o navegador da plataforma para a página de atualização. O produto valida a origem de mensagens do frame de consulta de versões. As amostras publicadas focam as integrações CHPlayer.

## Roku e atualizações

O produto Roku usa XML/SceneGraph para componentes e BrightScript para eventos e Tasks. O controlador de atualização recebe o resultado do Task e adia o diálogo durante reprodução. Atualizar abre instruções/endereço específicos de Roku; não tenta instalar um APK Android.

A página do site seleciona a plataforma, lê seu manifesto e verifica integridade dos arquivos; o produto Android usa montagem por partes. Os endereços de produção foram trocados por domínios de exemplo nesta amostra.
