/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Telas e estado do Android. index-production.js monta ActivationApp; após ativar, Library carrega catálogos e abre Player.js. Aqui ficam navegação, favoritos, busca e seleção de episódios.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, FlatList, Image, Keyboard, Linking, Pressable, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { groupCatalog, httpUrl, matchesSearch, parseFeed } from './playlist.cjs';
import Player from './Player';
import appConfig from './app.json';
import officialCatalogs from './official-catalogs.json';
import { useUpdateNotice } from './Updates';
import { inviteCode, roomClient } from './Rooms';
import { fetchText, loadSaimoFeed, loadSaimoTitle } from './saimo-feed';
import { INITIAL, loadLibrary, saveFeed, savePreferences } from './storage';

const C = {
  bg: '#0A0A0F', panel: '#15151F', field: '#1E1E2D', line: '#2D2D3D', text: '#FFFFFF',
  muted: '#ADB0C2', accent: '#A5A6FF', primary: '#4F46E5', live: '#FF8C99', error: '#FFB4BD',
};
const TABS = [
  ['live', 'tv', 'TV'],
  ['favorites', 'heart', 'Favoritos'],
  ['catalog', 'films', 'Filmes'],
  ['settings', 'settings', 'Ajustes'],
];
const ICONS = {
  tv: require('./assets/ui/tv.png'),
  heart: require('./assets/ui/heart.png'),
  films: require('./assets/ui/films.png'),
  settings: require('./assets/ui/settings.png'),
  search: require('./assets/ui/search.png'),
  filter: require('./assets/ui/filter.png'),
  refresh: require('./assets/ui/refresh.png'),
  grid: require('./assets/ui/grid.png'),
};
const FILTERS = [['all', 'Tudo'], ['movies', 'Filmes'], ['series', 'Séries']];
const SCOPE = { live: 'Canais ao vivo', catalog: 'Filmes e séries' };
const MAX_BYTES = 24 * 1024 * 1024;
const EMPTY_MEDIA = [];
const ICON = require('./assets/adaptive.png');

/**
 * Icon — Desenha um ícone da interface.
 * Entradas: { name, color = C.text, size = 22 }.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function Icon({ name, color = C.text, size = 22 }) {
  return <Image source={ICONS[name]} style={{ width: size, height: size, tintColor: color }} />;
}

/**
 * RoundAction — Renderiza uma ação circular com estado de seleção.
 * Entradas: { icon, label, onPress, selected = false, disabled = false }.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function RoundAction({ icon, label, onPress, selected = false, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.roundAction, selected && s.buttonSelected, disabled && s.dim]}
    >
      <Icon name={icon} />
    </Pressable>
  );
}

/**
 * Action — Renderiza um botão reutilizado nas telas.
 * Entradas: { label, onPress, selected, disabled = false, icon }.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function Action({ label, onPress, selected, disabled = false, icon }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.button, selected && s.buttonSelected, (pressed || disabled) && s.dim]}
    >
      {icon && <Icon name={icon} color={selected ? C.text : C.muted} size={16} />}
      <Text style={[s.buttonText, !selected && icon && s.muted]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Artwork — Mostra a imagem do item ou uma alternativa quando ela falta.
 * Entradas: { item, style }.
 * Operações presentes no corpo: useState, setFailed.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function Artwork({ item, style }) {
  const [failedUrl, setFailed] = useState(null);
  return (
    <View style={[s.art, style]}>
      <Text style={s.artGlyph}>{item.section === 'live' ? '▣' : '▷'}</Text>
      {!!item.artwork && failedUrl !== item.artwork && (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: item.artwork }}
          resizeMode={item.section === 'live' ? 'contain' : 'cover'}
          onError={() => setFailed(item.artwork)}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

/**
 * Star — Mostra e aciona a marcação de favorito.
 * Entradas: { saved, onPress, floating = false }.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function Star({ saved, onPress, floating = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      accessibilityState={{ selected: saved }}
      onPress={onPress}
      style={[s.star, floating && s.floatingStar]}
    >
      {saved ? <Text style={s.starText}>♥</Text> : <Icon name="heart" size={21} />}
    </Pressable>
  );
}

/**
 * Channel — Renderiza um cartão de canal ao vivo.
 * Entradas: { item, number, saved, onPress, onFavorite }.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function Channel({ item, number, saved, onPress, onFavorite }) {
  return (
    <View style={s.channel}>
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Artwork item={item} style={s.channelArt} />
        <View style={s.channelCopy}>
          <Text style={s.itemTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.muted} numberOfLines={1}>{item.group}</Text>
          <Text style={s.live}>●  AO VIVO</Text>
        </View>
      </Pressable>
      <Text style={s.channelNumber}>{number}</Text>
      <Star saved={saved} onPress={onFavorite} floating />
    </View>
  );
}

/**
 * Poster — Renderiza um cartão de filme/série.
 * Entradas: { item, saved, onPress, onFavorite, inRail = false }.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function Poster({ item, saved, onPress, onFavorite, inRail = false }) {
  return (
    <View style={[s.poster, inRail && s.railPoster]}>
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Artwork item={item} style={s.posterArt} />
        <View style={s.posterText}>
          <Icon name={item.section === 'series' ? 'tv' : 'films'} size={15} />
          <Text style={s.itemTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.muted} numberOfLines={1}>
            {item.year || item.displayYear || (item.section === 'series' ? 'Série' : item.group)}
          </Text>
        </View>
      </Pressable>
      <Star saved={saved} onPress={onFavorite} floating />
    </View>
  );
}

/**
 * Details — Exibe detalhes e permite escolher temporada e episódio.
 * Entradas: { item, saved, progress, onBack, onFavorite, onPlay, loading, error, onRetry }.
 * Operações presentes no corpo: map, useState, useEffect, BackHandler.addEventListener, onBack, listener.remove, join, filter, seasons.map, setSeason.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function Details({ item, saved, progress, onBack, onFavorite, onPlay, loading, error, onRetry }) {
  const seasons = item.episodes
    ? [...new Set(item.episodes.map((entry) => entry.season ?? 1))]
    : [];
  const [season, setSeason] = useState(seasons[0]);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => listener.remove();
  }, [onBack]);

  return (
    <ScrollView contentContainerStyle={s.details}>
      <View style={s.detailsTop}>
        <Action label="‹ Voltar" onPress={onBack} />
        <Star saved={saved} onPress={onFavorite} />
      </View>
      <Artwork item={item} style={s.detailArt} />
      <Text accessibilityRole="header" style={s.heading}>{item.title}</Text>
      <Text style={s.muted}>{[item.year || item.displayYear, item.group].filter(Boolean).join(' · ')}</Text>
      {!!item.description && <Text style={s.body}>{item.description}</Text>}
      {loading ? (
        <ActivityIndicator accessibilityLabel="Carregando fontes" color={C.accent} />
      ) : error ? (
        <>
          <Text accessibilityRole="alert" style={s.error}>{error}</Text>
          <Action label="Tentar novamente" onPress={onRetry} />
        </>
      ) : item.episodes ? (
        <>
          <Text style={s.sectionTitle}>Episódios</Text>
          <View style={[s.pills, s.wrap]}>
            {seasons.map((value) => (
              <Action key={value} label={`Temporada ${value}`} selected={value === season} onPress={() => setSeason(value)} />
            ))}
          </View>
          {item.episodes.filter((entry) => (entry.season ?? 1) === season).map((entry, index) => (
            <Pressable key={entry.id} accessibilityRole="button" onPress={() => onPlay(entry)} style={s.episode}>
              <Text style={s.playGlyph}>▶</Text>
              <View style={s.grow}>
                <Text style={s.itemTitle} numberOfLines={2}>{entry.episodeTitle || entry.title}</Text>
                <Text style={s.muted}>
                  {['Episódio ' + (entry.episode ?? index + 1), progress[entry.id] && 'Continuar'].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : <Action label={progress[item.id] ? '▶  Continuar assistindo' : '▶  Assistir agora'} selected onPress={() => onPlay(item)} />}
    </ScrollView>
  );
}

/**
 * SourceCard — Exibe importação e estado de uma fonte de catálogo.
 * Entradas: { scope, feed, importing, notice, onImport, onReset, onRefresh }.
 * Operações presentes no corpo: useState, onImport, setAddress, onReset, onRefresh.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function SourceCard({ scope, feed, importing, notice, onImport, onReset, onRefresh }) {
  const [address, setAddress] = useState(feed?.address ?? '');
  return (
    <View style={s.sourceCard}>
      <Text accessibilityRole="header" style={s.sectionTitle}>{SCOPE[scope]}</Text>
      <Text style={s.body}>
        {scope === 'live' ? 'Adicione uma lista M3U ou um catálogo TXT de canais.'
          : 'Adicione uma lista M3U de vídeos ou um catálogo JSON com temporadas e episódios.'}
      </Text>
      <Text style={s.muted}>
        {feed ? `${feed.items.length} itens · ${feed.address ? 'Fonte por URL' : 'Arquivo local'}` : 'Catálogo remoto do Saimo'}
      </Text>
      <TextInput
        accessibilityLabel={`URL da fonte de ${SCOPE[scope]}`}
        style={s.input}
        placeholder="https://…"
        placeholderTextColor={C.muted}
        value={address}
        onChangeText={setAddress}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <View style={[s.pills, s.wrap]}>
        <Action
          label={feed?.address === address && address ? 'Atualizar lista' : 'Importar URL'}
          onPress={() => onImport(scope, address, false)}
          disabled={!!importing}
          selected
        />
        <Action label="Escolher arquivo" onPress={() => onImport(scope, '', true)} disabled={!!importing} />
        {feed
          ? <Action label="Usar fonte do Saimo" onPress={() => { setAddress(''); onReset(scope); }} disabled={!!importing} />
          : <Action label="Atualizar fonte do Saimo" onPress={() => onRefresh(scope)} disabled={!!importing} />}
      </View>
      {importing === scope && <ActivityIndicator color={C.accent} />}
      {notice && <Text accessibilityRole="alert" style={notice.error ? s.error : s.body}>{notice.text}</Text>}
    </View>
  );
}

/**
 * OfficialCatalogs — Abre os serviços gratuitos nos seus players oficiais.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: useState, setError, Linking.openURL, officialCatalogs.map, open.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function OfficialCatalogs() {
  const [error, setError] = useState('');
  /**
 * open — Etapa auxiliar open: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: service.
 * Operações presentes no corpo: setError, Linking.openURL.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function open(service) {
    try { setError(''); await Linking.openURL(service.url); }
    catch { setError('Não foi possível abrir o catálogo. Confira a conexão e tente novamente.'); }
  }
  return (
    <View style={s.sourceCard}>
      <Text accessibilityRole="header" style={s.sectionTitle}>Catálogos gratuitos</Text>
      <Text style={s.body}>Abra mais opções de filmes, séries e canais nos serviços oficiais. A reprodução acontece no aplicativo ou site de cada serviço.</Text>
      {officialCatalogs.map((service) => (
        <View key={service.id} style={{ gap: 8 }}>
          <Text style={s.body}>{service.description}</Text>
          <Action label={`Abrir ${service.name} ↗`} onPress={() => open(service)} />
        </View>
      ))}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </View>
  );
}

/**
 * usesSaimo — Verifica se a categoria usa o catálogo padrão.
 * Entradas: library; scope.
 * Operações presentes no corpo: some.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function usesSaimo(library, scope) {
  const hasLegacy = library.items.some((item) => scope === 'live' ? item.section === 'live' : item.section !== 'live');
  return !library.feeds[scope]?.items && (library.feeds[scope]?.default || !hasLegacy);
}

/**
 * getMedia — Seleciona os itens importados ou remotos da categoria.
 * Entradas: library; scope; remote.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function getMedia(library, scope, remote) {
  const select = (item) => scope === 'live' ? item.section === 'live' : item.section !== 'live';
  const feed = library?.feeds[scope];
  const legacy = library?.items.filter(select);
  return feed?.items ?? (!feed && legacy?.length ? legacy : remote?.items ?? EMPTY_MEDIA);
}

/**
 * readFeed — Lê arquivo/endereço importado e passa o conteúdo ao leitor de listas.
 * Entradas: address; fromFile.
 * Operações presentes no corpo: getDocumentAsync, Math.max, file.text, httpUrl, fetchText.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function readFeed(address, fromFile) {
  if (fromFile) {
    const selection = await getDocumentAsync({ copyToCacheDirectory: true });
    if (selection.canceled) return null;
    const asset = selection.assets[0];
    const file = new File(asset.uri);
    if (Math.max(asset.size ?? 0, file.size) > MAX_BYTES) throw new Error('O arquivo pode ter até 24 MB.');
    return { contents: await file.text() };
  }

  const url = httpUrl(address);
  if (!url) throw new Error('Informe um endereço HTTP ou HTTPS válido.');
  return { ...await fetchText(url), address: url };
}

/**
 * Library — Controla navegação, listas, busca, favoritos e abertura do reprodutor.
 * Entradas: { origin, token }.
 * Operações presentes no corpo: useState, useUpdateNotice, useMemo, roomClient, useEffect, inviteCode, setInvite, setTab, setJoinOpen, setJoinError.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function Library({ origin, token }) {
  const [library, setLibrary] = useState(null);
  const [tab, setTab] = useState('live');
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState(null);
  const [query, setQuery] = useState('');
  const [searchOpen, showSearch] = useState(false);
  const [filtersOpen, showFilters] = useState(false);
  const [onlyFavorites, showOnlyFavorites] = useState(false);
  const [busy, setBusy] = useState(null);
  const [notices, setNotices] = useState({});
  const [storageError, setStorageError] = useState(false);
  const [playing, setPlaying] = useState(null);
  useUpdateNotice(!!playing);
  const [roomLaunch, setRoomLaunch] = useState(null);
  const [invite, setInvite] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const requestRoom = useMemo(() => origin?.endsWith('/functions/v1/chplayer') && roomClient(origin, token), [origin, token]);

  useEffect(() => {
    if (!requestRoom) return;
    /**
 * receive — Etapa auxiliar receive: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: url.
 * Operações presentes no corpo: inviteCode, setInvite, setTab, setJoinOpen, setJoinError.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function receive(url) {
      if (!url?.startsWith('chplayer://sala/') || !inviteCode(url)) return;
      setInvite(url);
      setTab('catalog');
      setJoinOpen(true);
      setJoinError(null);
    }
    let mounted = true;
    Linking.getInitialURL().then((url) => { if (mounted) receive(url); }).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => receive(url));
    return () => { mounted = false; subscription.remove(); };
  }, [requestRoom]);

  /**
 * joinRoom — Etapa auxiliar joinRoom: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: inviteCode, setJoining, setJoinError, requestRoom, loadSaimoFeed, find, loadSaimoTitle, setRoomLaunch, Date.now, setPlaying.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function joinRoom() {
    const code = inviteCode(invite);
    if (!code || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const room = await requestRoom('read', { code });
      const feed = remote.catalog ?? await loadSaimoFeed('catalog', false);
      const movie = feed.items.find((item) => item.id === room.movie && item.section === 'movies');
      if (!movie) throw new Error('O filme da sala não está disponível no catálogo.');
      const playable = await loadSaimoTitle(movie);
      setRoomLaunch({ room, serial: Date.now() });
      setPlaying(playable);
      setJoinOpen(false);
      setInvite('');
    } catch (error) {
      setJoinError(error.message);
    } finally {
      setJoining(false);
    }
  }
  const [details, setDetails] = useState(null);
  const [detailResult, setDetailResult] = useState(null);
  const [remote, setRemote] = useState({});
  const [remoteStatus, setRemoteStatus] = useState({});
  const remotePending = useRef(new Set());
  const playRequest = useRef(0);

  useEffect(() => {
    loadLibrary().then(setLibrary).catch(() => {
      setStorageError(true);
      setLibrary(INITIAL);
    });
  }, []);

  const favoriteIds = library?.favorites;
  const progress = library?.progress;
  useEffect(() => {
    if (!favoriteIds || !progress || favoriteIds === INITIAL.favorites) return;
    savePreferences(favoriteIds, progress).catch(() => setStorageError(true));
  }, [favoriteIds, progress]);

  /**
 * refreshSaimo — Etapa auxiliar refreshSaimo: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: scope; refresh = true.
 * Operações presentes no corpo: has, add, setRemoteStatus, loadSaimoFeed, setRemote, delete.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function refreshSaimo(scope, refresh = true) {
    if (remotePending.current.has(scope)) return;
    remotePending.current.add(scope);
    setRemoteStatus((current) => ({ ...current, [scope]: 'loading' }));
    try {
      const feed = await loadSaimoFeed(scope, refresh);
      setRemote((current) => ({ ...current, [scope]: feed }));
      setRemoteStatus((current) => ({ ...current, [scope]: 'ready' }));
    } catch {
      setRemoteStatus((current) => ({ ...current, [scope]: 'error' }));
    } finally {
      remotePending.current.delete(scope);
    }
  }

  useEffect(() => {
    if (!library) return;
    const scopes = tab === 'favorites' ? ['live', 'catalog'] : [tab];
    for (const scope of scopes) {
      if ((scope === 'live' || scope === 'catalog') && usesSaimo(library, scope) && !remoteStatus[scope]) {
        refreshSaimo(scope, false);
      }
    }
  }, [library, tab, remoteStatus]);

  useEffect(() => {
    if (!details?.saimo) return;
    let cancelled = false;
    loadSaimoTitle(details).then((item) => {
      if (!cancelled) setDetailResult({ request: details, item });
    }).catch((error) => {
      if (!cancelled) setDetailResult({ request: details, error: error.message });
    });
    return () => { cancelled = true; };
  }, [details]);

  const detail = detailResult?.request === details ? detailResult : null;
  const live = useMemo(() => getMedia(library, 'live', remote.live), [library?.feeds, library?.items, remote.live]);
  const vod = useMemo(() => getMedia(library, 'catalog', remote.catalog), [library?.feeds, library?.items, remote.catalog]);
  const catalog = useMemo(() => groupCatalog(vod), [vod]);
  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const remoteRails = library && usesSaimo(library, 'catalog') ? remote.catalog?.rails : null;
  const favorites = useMemo(() => new Set(library?.favorites), [library?.favorites]);
  const channelNumbers = useMemo(() => new Map(live.map((item, index) => [item.id, index + 1])), [live]);
  const search = useDeferredValue(query);
  const groupItems = useMemo(() => tab === 'live' ? live : catalog.filter((item) => filter === 'all' || item.section === filter), [tab, live, catalog, filter]);
  const categories = useMemo(() => [...new Set(groupItems.map((item) => item.group))].sort((a, b) => a.localeCompare(b)), [groupItems]);
  const visible = useMemo(() => groupItems.filter((item) => (!category || item.group === category)
    && (tab !== 'live' || !onlyFavorites || favorites.has(item.id)) && matchesSearch(item, search)), [groupItems, category, tab, onlyFavorites, favorites, search]);
  const saved = useMemo(() => [...live, ...catalog].filter((item) => favorites.has(item.id) && matchesSearch(item, search)), [live, catalog, favorites, search]);
  const recent = useMemo(() => {
    const byId = new Map(vod.map((item) => [item.id, item]));
    return Object.entries(progress ?? {}).sort(([, a], [, b]) => b.updated - a.updated)
      .map(([id, state]) => byId.get(id) ?? (state.resume && { id, ...state.resume }))
      .filter(Boolean).slice(0, 8);
  }, [vod, progress]);
  const highlight = catalogById.get(remoteRails?.[0]?.ids[0]) ?? catalog.find((item) => item.featured) ?? catalog[0];
  const isOverview = tab === 'catalog' && !query.trim() && !category && filter === 'all';
  const playingIndex = playing?.section === 'live' ? live.findIndex((item) => item.id === playing.id) : -1;

  /**
 * changeTab — Etapa auxiliar changeTab: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: id.
 * Operações presentes no corpo: Keyboard.dismiss, setTab, setFilter, setCategory, setQuery, showSearch, showFilters, showOnlyFavorites, setDetails.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function changeTab(id) {
    Keyboard.dismiss();
    playRequest.current++;
    setTab(id);
    setFilter('all');
    setCategory(null);
    setQuery('');
    showSearch(false);
    showFilters(false);
    showOnlyFavorites(false);
    setDetails(null);
  }

  /**
 * toggleFavorite — Etapa auxiliar toggleFavorite: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: id.
 * Operações presentes no corpo: setLibrary, includes, filter.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function toggleFavorite(id) {
    setLibrary((state) => ({
      ...state, favorites: state.favorites.includes(id)
        ? state.favorites.filter((favorite) => favorite !== id)
        : [...state.favorites, id],
    }));
  }

  /**
 * saveProgress — Etapa auxiliar saveProgress: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: item; seconds; duration.
 * Operações presentes no corpo: setLibrary, Date.now, Object.keys, ids.sort.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function saveProgress(item, seconds, duration) {
    const { id } = item;
    setLibrary((state) => {
      const progress = { ...state.progress };
      if (seconds < 10 || (duration > 0 && seconds >= duration - 5)) {
        if (!progress[id]) return state;
        delete progress[id];
      } else {
        progress[id] = { seconds, updated: Date.now() };
        if (item.resume) {
          const { item: series, season, episode } = item.resume;
          progress[id].resume = { title: `T${season} E${episode}`, series: series.title, resume: item.resume };
        }
        // ponytail: cap the local resume history instead of growing it without bounds.
        const ids = Object.keys(progress);
        if (ids.length > 100) delete progress[ids.sort((a, b) => progress[a].updated - progress[b].updated)[0]];
      }
      return { ...state, progress };
    });
  }

  /**
 * importFeed — Etapa auxiliar importFeed: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: scope; address; fromFile.
 * Operações presentes no corpo: setBusy, setNotices, readFeed, parseFeed, saveFeed, setLibrary.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function importFeed(scope, address, fromFile) {
    setBusy(scope);
    setNotices((value) => ({ ...value, [scope]: null }));
    try {
      const response = await readFeed(address, fromFile);
      if (!response) return;
      if (response.contents.length > MAX_BYTES) throw new Error('A fonte pode ter até 24 MB.');
      const items = parseFeed(response.contents, response.baseUrl, scope);
      const feed = { items, address: response.address };
      await saveFeed(scope, feed);
      setLibrary((state) => ({ ...state, feeds: { ...state.feeds, [scope]: feed } }));
      setNotices((value) => ({ ...value, [scope]: { text: `${items.length} itens carregados.` } }));
    } catch (error) {
      const message = error.name === 'AbortError' ? 'A fonte demorou para responder.' : error.name === 'SyntaxError'
        ? 'O arquivo não tem um catálogo JSON válido.' : error.message;
      setNotices((value) => ({ ...value, [scope]: { text: message, error: true } }));
    } finally {
      setBusy(null);
    }
  }

  /**
 * resetFeed — Etapa auxiliar resetFeed: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: scope.
 * Operações presentes no corpo: setBusy, saveFeed, setLibrary, refreshSaimo, setNotices.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function resetFeed(scope) {
    setBusy(scope);
    try {
      await saveFeed(scope, null);
      setLibrary((state) => ({ ...state, feeds: { ...state.feeds, [scope]: { default: true } } }));
      refreshSaimo(scope);
      setNotices((value) => ({ ...value, [scope]: { text: 'Fonte padrão restaurada.' } }));
    } catch {
      setNotices((value) => ({ ...value, [scope]: { error: true, text: 'Não foi possível restaurar a fonte padrão.' } }));
    } finally {
      setBusy(null);
    }
  }

  /**
 * toggleSearch — Etapa auxiliar toggleSearch: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: Keyboard.dismiss, setQuery, showSearch.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function toggleSearch() {
    if (searchOpen) {
      Keyboard.dismiss();
      setQuery('');
    }
    showSearch(!searchOpen);
  }

  /**
 * refreshFeed — Etapa auxiliar refreshFeed: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: importFeed, usesSaimo, refreshSaimo, changeTab.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function refreshFeed() {
    const address = library?.feeds.catalog?.address;
    if (address) importFeed('catalog', address, false);
    else if (library && usesSaimo(library, 'catalog')) refreshSaimo('catalog');
    else changeTab('settings');
  }

  /**
 * playRecent — Etapa auxiliar playRecent: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: item.
 * Operações presentes no corpo: setPlaying, setNotices, loadSaimoTitle, find.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function playRecent(item) {
    if (item.url) {
      setPlaying(item);
      return;
    }
    const request = ++playRequest.current;
    setNotices((value) => ({ ...value, catalog: { text: 'Carregando a reprodução…' } }));
    try {
      const resolved = await loadSaimoTitle(item.resume?.item ?? item);
      if (request !== playRequest.current) return;
      const playable = item.resume ? resolved.episodes.find((entry) => entry.id === item.id) : resolved;
      if (!playable?.url) throw new Error('Esta fonte de reprodução está indisponível.');
      setNotices((value) => ({ ...value, catalog: null }));
      setPlaying(playable);
    } catch (error) {
      if (request === playRequest.current) {
        setNotices((value) => ({ ...value, catalog: { text: error.message, error: true } }));
      }
    }
  }

  /**
 * renderCard — Etapa auxiliar renderCard: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: item; inRail = false.
 * Operações presentes no corpo: favorites.has, toggleFavorite, channelNumbers.get, setPlaying, setDetails.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function renderCard(item, inRail = false) {
    const saved = favorites.has(item.id);
    const onFavorite = () => toggleFavorite(item.id);
    return item.section === 'live' ? (
      <Channel item={item} number={channelNumbers.get(item.id)} saved={saved} onFavorite={onFavorite} onPress={() => setPlaying(item)} />
    ) : (
      <Poster item={item} saved={saved} onFavorite={onFavorite} onPress={() => setDetails(item)} inRail={inRail} />
    );
  }

  /**
 * renderRail — Etapa auxiliar renderRail: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: label; section; ids.
 * Operações presentes no corpo: filter, ids.map, catalogById.get, catalog.filter, setFilter, showFilters, map, entries.slice, renderCard.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function renderRail(label, section, ids) {
    const entries = ids ? ids.map((id) => catalogById.get(id)).filter(Boolean)
      : catalog.filter((item) => item.section === section);
    if (!entries.length) return null;
    return (
      <View key={label} style={s.rail}>
        <View style={s.railTitle}>
          <Text style={s.sectionTitle}>{label}</Text>
          {!!section && entries.length > 3 && (
            <Pressable accessibilityRole="button" onPress={() => { setFilter(section); showFilters(true); }}>
              <Text style={s.link}>Ver todos ›</Text>
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.railContent}>
          {entries.slice(0, 16).map((item) => <View key={item.id}>{renderCard(item, true)}</View>)}
        </ScrollView>
      </View>
    );
  }

  const navTitle = tab === 'live' ? 'CHPlayer' : tab === 'catalog' ? 'Filmes & Séries'
    : TABS.find(([id]) => id === tab)[2];
  const filters = (
    <>
      {searchOpen && (
        <View style={s.searchWrap}>
          <TextInput
            autoFocus
            accessibilityLabel="Buscar na seção"
            style={s.input}
            placeholder={tab === 'live' ? 'Buscar canais…' : tab === 'catalog' ? 'Buscar filmes e séries…' : 'Buscar favoritos…'}
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
        </View>
      )}
      {tab === 'catalog' && filtersOpen && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
          {FILTERS.map(([id, label]) => (
            <Action key={id} label={label} selected={filter === id && !category} onPress={() => { setFilter(id); setCategory(null); }} />
          ))}
          {categories.map((name) => <Action key={name} label={name} selected={name === category} onPress={() => setCategory(category === name ? null : name)} />)}
        </ScrollView>
      )}
      {tab === 'live' && (
        <View style={s.filterStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
            <Action label="Todos" icon="grid" selected={!category && !onlyFavorites} onPress={() => { setCategory(null); showOnlyFavorites(false); }} />
            <Action label="Favoritos" icon="heart" selected={onlyFavorites} onPress={() => { setCategory(null); showOnlyFavorites(true); }} />
            {categories.map((name) => <Action key={name} label={name} icon="tv" selected={name === category} onPress={() => { setCategory(name); showOnlyFavorites(false); }} />)}
          </ScrollView>
        </View>
      )}
      {library && (tab === 'live' || tab === 'catalog') && usesSaimo(library, tab) && remoteStatus[tab] === 'loading' && (
        <Text style={[s.notice, s.muted]}>Carregando catálogo do Saimo…</Text>
      )}
      {library && (tab === 'live' || tab === 'catalog') && usesSaimo(library, tab) && remoteStatus[tab] === 'error' && (
        <View style={s.searchWrap}>
          <Text style={s.error}>O catálogo do Saimo está indisponível no momento.</Text>
          <Action label="Tentar atualizar" onPress={() => refreshSaimo(tab)} />
        </View>
      )}
      {tab === 'catalog' && notices.catalog && (
        <Text style={[s.notice, notices.catalog.error ? s.error : s.muted]}>{notices.catalog.text}</Text>
      )}
    </>
  );

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="light-content" />
      {storageError && <Text accessibilityRole="alert" style={[s.error, s.storage]}>O armazenamento local está indisponível.</Text>}
      {details && library ? (
        <Details
          key={`${details.id}:${detail?.item ? 'ready' : 'initial'}`}
          item={detail?.item ?? details}
          loading={!!details.saimo && !detail}
          error={detail?.error}
          onRetry={() => setDetails({ ...details })}
          progress={library.progress}
          saved={favorites.has(details.id)}
          onBack={() => setDetails(null)}
          onFavorite={() => toggleFavorite(details.id)}
          onPlay={setPlaying}
        />
      ) : (
        <>
          <View style={s.top}>
            <View style={s.grow}>
              {tab === 'settings' && <Image source={ICON} style={s.brandIcon} />}
              <Text accessibilityRole="header" style={s.heading}>{navTitle}</Text>
              {tab === 'live' && <Text style={s.muted}>{live.length} canais</Text>}
              {tab === 'catalog' && <Text style={s.muted}>{new Set(catalog.map((item) => item.group)).size} categorias · {catalog.length} títulos</Text>}
            </View>
            {tab !== 'settings' && (
              <View style={s.topActions}>
                <RoundAction icon="search" label="Buscar" onPress={toggleSearch} selected={searchOpen} />
                {tab === 'live' && <RoundAction icon="settings" label="Fontes de canais" onPress={() => changeTab('settings')} />}
                {tab === 'catalog' && (
                  <>
                    <RoundAction icon="filter" label="Filtrar catálogo" onPress={() => showFilters(!filtersOpen)} selected={filtersOpen} />
                    <RoundAction icon="refresh" label="Atualizar catálogo" onPress={refreshFeed} selected disabled={!!busy} />
                  </>
                )}
              </View>
            )}
          </View>
          {tab === 'catalog' && requestRoom && (
            <View style={s.searchWrap}>
              <Action label={joinOpen ? 'Fechar convite' : 'Entrar em sala'} onPress={() => setJoinOpen(!joinOpen)} />
              {joinOpen && <>
                <TextInput accessibilityLabel="Link da sala" placeholder="Cole o link da sala" placeholderTextColor={C.muted}
                  autoCapitalize="none" autoCorrect={false} style={s.input} value={invite} onChangeText={setInvite} />
                <Action label={joining ? 'Entrando…' : 'Entrar'} disabled={joining || !inviteCode(invite)} onPress={joinRoom} />
                {joinError && <Text accessibilityRole="alert" style={s.error}>{joinError}</Text>}
              </>}
            </View>
          )}
          {tab !== 'settings' && filters}
          {!library ? <ActivityIndicator style={s.grow} color={C.accent} /> : tab === 'settings' ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.list}>
              {Object.keys(SCOPE).map((scope) => (
                <SourceCard key={scope} scope={scope} feed={library.feeds[scope]?.items ? library.feeds[scope] : null} importing={busy} notice={notices[scope]} onImport={importFeed} onReset={resetFeed} onRefresh={refreshSaimo} />
              ))}
              <OfficialCatalogs />
              <Text style={s.muted}>CHPlayer · {appConfig.expo.version}</Text>
            </ScrollView>
          ) : isOverview ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.overview}>
              {!!highlight && (
                <Pressable accessibilityRole="button" onPress={() => setDetails(highlight)} style={s.hero}>
                  <Artwork item={highlight} style={StyleSheet.absoluteFill} />
                  <View style={s.heroCopy}>
                    <Text style={s.brand}>DESTAQUE</Text>
                    <Text numberOfLines={2} style={s.heroTitle}>{highlight.title}</Text>
                    <Text style={s.heroButton}>ⓘ  Ver detalhes</Text>
                  </View>
                </Pressable>
              )}
              {recent.length > 0 && (
                <View style={s.rail}>
                  <Text style={[s.sectionTitle, s.railTitle]}>Continuar assistindo</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.railContent}>
                    {recent.map((item) => (
                      <Action key={item.id} label={`▶ ${item.series ? item.series + ' · ' : ''}${item.episodeTitle || item.title}`} onPress={() => playRecent(item)} />
                    ))}
                  </ScrollView>
                </View>
              )}
              {remoteRails?.length ? remoteRails.map(({ title, ids }) => renderRail(title, null, ids)) : (
                <>
                  {renderRail('Filmes em destaque', 'movies')}
                  {renderRail('Séries em destaque', 'series')}
                </>
              )}
            </ScrollView>
          ) : (
            <FlatList
              key={tab}
              data={tab === 'favorites' ? saved : visible}
              numColumns={2}
              columnWrapperStyle={s.gridRow}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.list}
              ListEmptyComponent={<Text style={s.empty}>{query.trim() ? 'Nenhum resultado.' : tab === 'favorites' || onlyFavorites ? 'Seus favoritos aparecem aqui.' : 'Nenhum item nesta categoria.'}</Text>}
              renderItem={({ item }) => renderCard(item)}
            />
          )}
          <View style={s.nav}>
            {TABS.map(([id, glyph, label]) => (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: tab === id }}
                onPress={() => changeTab(id)}
                style={s.navItem}
              >
                <View style={[s.navIcon, tab === id && s.navActive]}><Icon name={glyph} color={tab === id ? C.text : C.muted} /></View>
                <Text style={[s.navLabel, tab === id && s.activeText]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {playing && (
        <Player
          key={roomLaunch?.serial ?? playing.id}
          item={playing}
          start={library.progress[playing.id]?.seconds ?? 0}
          onClose={() => { setPlaying(null); setRoomLaunch(null); }}
          initialRoom={roomLaunch?.room}
          request={requestRoom}
          onProgress={(seconds, duration) => saveProgress(playing, seconds, duration)}
          channelNav={playingIndex < 0 ? null : {
            previous: playingIndex > 0 ? () => setPlaying(live[playingIndex - 1]) : null,
            next: playingIndex + 1 < live.length ? () => setPlaying(live[playingIndex + 1]) : null,
          }}
        />
      )}
    </SafeAreaView>
  );
}

const INSTALLATION_KEY = 'chplayer-license-installation';

/**
 * licenseRequest — Envia um pedido de ativação/status ao servidor.
 * Entradas: origin; route; body.
 * Operações presentes no corpo: setTimeout, controller.abort, fetch, JSON.stringify, response.json, clearTimeout.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function licenseRequest(origin, route, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${origin}/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 403) return null;
    if (!response.ok) throw new Error('Servidor de ativação indisponível.');
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * LicenseGate — Exibe a ativação e mantém o token da instalação.
 * Entradas: { origin, instructions }.
 * Operações presentes no corpo: useState, useEffect, AsyncStorage.getItem, licenseRequest, setActiveToken, setTimeout, setMessage, setBusy, check, clearTimeout.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function LicenseGate({ origin, instructions }) {
  const [activeToken, setActiveToken] = useState(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let mounted = true;
    let timer;
    /**
 * check — Consulta se há atualização disponível.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: AsyncStorage.getItem, licenseRequest, setActiveToken, setTimeout, setMessage, setBusy.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function check() {
      try {
        const token = await AsyncStorage.getItem(INSTALLATION_KEY);
        const active = token && await licenseRequest(origin, 'status', { token });
        if (!mounted) return;
        setActiveToken(active ? token : null);
        if (active) timer = setTimeout(check, 60000);
        else if (token) setMessage('Ative este aparelho para continuar.');
      } catch {
        if (mounted) {
          setActiveToken(null);
          setMessage('Servidor de ativação indisponível. Verifique a conexão e tente novamente.');
        }
      } finally {
        if (mounted) setBusy(false);
      }
    }
    check();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [activeToken, origin]);

  /**
 * activate — Etapa auxiliar activate: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: setBusy, setMessage, AsyncStorage.getItem, licenseRequest, AsyncStorage.setItem, key.trim, setKey, setActiveToken.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function activate() {
    setBusy(true);
    setMessage(null);
    try {
      let token = await AsyncStorage.getItem(INSTALLATION_KEY);
      if (!token) {
        ({ token } = await licenseRequest(origin, 'installation', {}));
        await AsyncStorage.setItem(INSTALLATION_KEY, token);
      }
      const active = await licenseRequest(origin, 'activate', { token, key: key.trim() });
      if (active) {
        setKey('');
        setActiveToken(token);
      } else {
        setMessage('Chave inválida, revogada ou já vinculada a outro aparelho.');
      }
    } catch {
      setMessage('Não foi possível ativar. Verifique a conexão e a chave.');
    } finally {
      setBusy(false);
    }
  }

  if (activeToken) return <Library origin={origin} token={activeToken} />;
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.list}>
        <Image source={ICON} style={s.brandIcon} />
        <Text accessibilityRole="header" style={s.heading}>Ativar CHPlayer</Text>
        <Text style={s.muted}>{instructions}</Text>
        <TextInput
          accessibilityLabel="Chave de ativação"
          style={s.input}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          value={key}
          onChangeText={setKey}
        />
        <Action label="Ativar" disabled={busy || !/^[A-Za-z0-9_-]{43}$/.test(key.trim())} onPress={activate} />
        {busy && <ActivityIndicator color={C.accent} />}
        {message && <Text accessibilityRole="alert" style={s.error}>{message}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * App — Etapa auxiliar App: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export default function App() {
  return <SafeAreaProvider><Library /></SafeAreaProvider>;
}

/**
 * PilotApp — Etapa auxiliar PilotApp: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function PilotApp() {
  return <ActivationApp origin="http://127.0.0.1:8765" instructions="Piloto local. Informe a chave do pedido de teste." />;
}

/**
 * ActivationApp — Monta a biblioteca protegida pela ativação de produção.
 * Entradas: { origin, instructions = 'Informe a chave que você recebeu por e-mail.' }.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
export function ActivationApp({ origin, instructions = 'Informe a chave que você recebeu por e-mail.' }) {
  return <SafeAreaProvider><LicenseGate origin={origin} instructions={instructions} /></SafeAreaProvider>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  grow: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 8 },
  topActions: { flexDirection: 'row', gap: 6 },
  roundAction: { width: 39, height: 39, borderRadius: 20, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  brandIcon: { width: 54, height: 54, backgroundColor: C.panel, borderRadius: 15 },
  heading: { color: C.text, fontSize: 27, fontWeight: '900', letterSpacing: -0.6 },
  sectionTitle: { color: C.text, fontSize: 19, fontWeight: '800' },
  brand: { color: C.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  body: { color: C.text, fontSize: 14, lineHeight: 21 },
  muted: { color: C.muted, fontSize: 13, lineHeight: 19 },
  live: { color: C.live, fontWeight: '800', fontSize: 10, letterSpacing: 0.4, marginTop: 4 },
  error: { color: C.error, fontSize: 14 },
  storage: { padding: 12 },
  notice: { paddingHorizontal: 16, paddingBottom: 8 },
  input: {
    minHeight: 46, borderRadius: 12, paddingHorizontal: 14, backgroundColor: C.field,
    color: C.text, fontSize: 16, borderWidth: 1, borderColor: C.line,
  },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  filterStrip: { backgroundColor: C.panel, borderBottomWidth: 1, borderColor: C.line },
  filterScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  list: { paddingHorizontal: 14, paddingTop: 7, paddingBottom: 18, gap: 10 },
  gridRow: { gap: 12 },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexWrap: 'wrap' },
  overview: { paddingBottom: 20, gap: 20 },
  hero: { marginHorizontal: 15, borderRadius: 16, minHeight: 205, aspectRatio: 1.76, backgroundColor: C.panel, overflow: 'hidden', justifyContent: 'flex-end' },
  heroCopy: { padding: 15, gap: 8, backgroundColor: '#08080DC7' },
  heroTitle: { color: C.text, fontSize: 26, fontWeight: '900' },
  heroButton: { color: C.text, alignSelf: 'flex-start', backgroundColor: '#6366F1', borderRadius: 24, paddingVertical: 8, paddingHorizontal: 13, fontSize: 14, fontWeight: '800' },
  rail: { gap: 10 },
  railTitle: { paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  railContent: { paddingHorizontal: 15, gap: 8 },
  link: { color: C.accent, fontSize: 13, fontWeight: '700' },
  art: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.field, overflow: 'hidden' },
  artGlyph: { color: C.accent, fontSize: 27, fontWeight: '800' },
  channel: { flex: 0.5, backgroundColor: C.panel, borderRadius: 15, overflow: 'hidden' },
  channelArt: { width: '100%', aspectRatio: 1.75, backgroundColor: '#101019' },
  channelCopy: { padding: 11, gap: 3 },
  channelNumber: { position: 'absolute', left: 7, top: 7, color: C.text, backgroundColor: '#08080D', borderRadius: 8, fontSize: 12, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 4 },
  itemTitle: { color: C.text, fontWeight: '700', fontSize: 15 },
  star: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#08080DC7' },
  floatingStar: { position: 'absolute', right: 7, top: 7 },
  starText: { color: C.accent, fontSize: 23 },
  poster: { flex: 0.5, alignSelf: 'stretch', borderRadius: 15, overflow: 'hidden', backgroundColor: C.panel },
  railPoster: { width: 143, flex: undefined },
  posterArt: { width: '100%', aspectRatio: 0.67 },
  posterText: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, gap: 2, backgroundColor: '#08080DD9' },
  details: { paddingHorizontal: 16, paddingBottom: 28, gap: 14 },
  detailsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailArt: { width: '100%', aspectRatio: 1.85, borderRadius: 16 },
  episode: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderRadius: 12, padding: 12, gap: 12 },
  playGlyph: { color: C.accent, fontSize: 15 },
  sourceCard: { padding: 14, gap: 12, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  button: { flexDirection: 'row', gap: 6, minHeight: 38, borderRadius: 22, backgroundColor: C.field, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  buttonSelected: { backgroundColor: '#595BE5' },
  buttonText: { color: C.text, fontWeight: '700', fontSize: 13 },
  dim: { opacity: 0.6 },
  empty: { color: C.muted, textAlign: 'center', paddingVertical: 28 },
  nav: { borderWidth: 1, borderColor: C.line, flexDirection: 'row', marginHorizontal: 8, marginBottom: 3, padding: 5, gap: 4, backgroundColor: '#13131D', borderRadius: 28 },
  navItem: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navActive: { backgroundColor: '#6B57EE' },
  navIcon: { width: 50, height: 29, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: C.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  activeText: { color: C.text },
});
