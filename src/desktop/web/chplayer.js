/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Integração CHPlayer sobre a interface de TV/PC: ativação, salas, chat, sincronização e links dos serviços oficiais. Consome a função do Supabase.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
(function () {
  'use strict';
  var origin = 'https://PROJECT_ID.supabase.co/functions/v1/chplayer';
  var token = localStorage.getItem('chplayer-installation') || '';
  var room = null; roomControls();
  /**
 * roomControls — Impede que um convidado controle a reprodução do anfitrião.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: toggle, document.querySelector, document.getElementById.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function roomControls() {
    var guest = !!room && !room.host;
    document.documentElement.classList.toggle('desktop-room-guest', guest);
    if (!video) return;
    video.controls = !guest && window.chplayerState && window.chplayerState.currentScreen === 'player';
    var play = document.querySelector('#desktop-controls button:nth-child(2)');
    if (play) play.disabled = guest;
    var seek = document.getElementById("desktop-seek");
    if (seek) seek.disabled = guest;
  }
  var polling = false;
  var started = false;
  var busy = false;
  var overlay;
  var video = document.getElementById('tv-video');

  /**
 * request — Envia uma requisição ao servidor configurado neste módulo.
 * Entradas: route; data.
 * Operações presentes no corpo: then, fetch, JSON.stringify, Object.assign, response.json.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function request(route, data) {
    return fetch(origin + '/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ token: token }, data || {}))
    }).then(function (response) {
      if (!response.ok) throw new Error(response.status === 404
        ? 'Sala expirada, convite inválido ou acesso inativo.'
        : 'Não foi possível conectar. Verifique a conexão e a ativação.');
      return response.json();
    });
  }

  var style = document.createElement('style');
  style.textContent = '#ch-gate{position:absolute;inset:0;z-index:99999;background:#100c1e;display:flex;align-items:center;justify-content:center;font:28px Arial;color:#fff}' +
    '.ch-card{width:1000px;padding:50px;border-radius:25px;background:#211830;display:flex;flex-direction:column;gap:24px}' +
    '.ch-card input,.ch-card button,#ch-room button{font:26px Arial;padding:18px;border-radius:12px;border:2px solid #aa8ce5;background:#2d2242;color:#fff}' +
    '.ch-card input{user-select:text!important;-webkit-user-select:text!important;outline:auto}' +
    '.ch-card :focus,#ch-room :focus{outline:4px solid white!important}' +
    '#ch-room{position:absolute;right:24px;top:88px;z-index:1000;display:flex;gap:12px}' +
    '#ch-room-message{max-height:280px;overflow:auto;user-select:text!important;-webkit-user-select:text!important;font-size:24px;white-space:pre-wrap}';
  document.head.appendChild(style);

  /**
 * element — Cria um elemento HTML e, quando informado, preenche seu texto.
 * Entradas: tag; text.
 * Operações presentes no corpo: document.createElement.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function element(tag, text) {
    var node = document.createElement(tag);
    if (text) node.textContent = text;
    return node;
  }
  /**
 * input — Cria um campo HTML identificado por rótulo.
 * Entradas: label; type.
 * Operações presentes no corpo: element, field.setAttribute.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function input(label, type) {
    var field = element('input');
    field.placeholder = label;
    field.setAttribute('aria-label', label);
    field.type = type || 'text';
    return field;
  }
  /**
 * button — Cria um botão e associa a ação de clique.
 * Entradas: label; action.
 * Operações presentes no corpo: element.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function button(label, action) {
    var control = element('button', label);
    control.onclick = action;
    return control;
  }
  /**
 * dialog — Cria o painel de diálogo usado pela integração.
 * Entradas: title; closeable.
 * Operações presentes no corpo: overlay.remove, element, card.appendChild, overlay.appendChild, appendChild, button.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function dialog(title, closeable) {
    if (overlay) overlay.remove();
    overlay = element('div');
    overlay.id = 'ch-gate';
    var card = element('div');
    card.className = 'ch-card';
    card.appendChild(element('h1', title));
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    if (closeable) card.appendChild(button('Voltar ao filme', closeDialog));
    return card;
  }
  /**
 * closeDialog — Etapa auxiliar closeDialog: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: overlay.remove.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function closeDialog() {
    if (overlay) overlay.remove();
    overlay = null;
  }
  document.addEventListener('keydown', function (event) {
    if (!overlay) {
      if (room && !room.host && window.chplayerState &&
          window.chplayerState.currentScreen === 'player' &&
          [13, 19, 37, 39, 415, 413, 417, 412, 10252].indexOf(event.keyCode) >= 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    event.stopImmediatePropagation();
    if ([38, 40].indexOf(event.keyCode) >= 0) {
      event.preventDefault();
      var fields = [].slice.call(overlay.querySelectorAll('input,button'));
      var next = fields.indexOf(document.activeElement) + (event.keyCode === 40 ? 1 : -1);
      fields[(next + fields.length) % fields.length].focus();
    }
    if (event.keyCode === 13 && document.activeElement.tagName === 'INPUT') {
      var submit = overlay.querySelector('button[data-submit]');
      if (submit) submit.click();
    }
  }, true);

  /**
 * activation — Etapa auxiliar activation: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: message.
 * Operações presentes no corpo: video.pause, dialog, card.appendChild, element, input, button, test, trim, finally, catch.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function activation(message) {
    video.pause();
    var card = dialog('Ativar CHPlayer');
    card.appendChild(element('p', 'Informe a chave recebida por e-mail. Cada chave ativa um aparelho.'));
    var key = input('Chave de ativação', 'password');
    card.appendChild(key);
    var status = element('p', message || '');
    var submit = button('Ativar', function () {
      if (busy) return;
      if (!/^[A-Za-z0-9_-]{43}$/.test(key.value.trim())) {
        status.textContent = 'Confira a chave de ativação.';
        return;
      }
      busy = true;
      status.textContent = 'Verificando…';
      ensureToken().then(function () {
        return request('activate', { key: key.value.trim() });
      }).then(start).catch(function (error) {
        status.textContent = error.message;
      }).finally(function () { busy = false; });
    });
    submit.setAttribute('data-submit', 'true');
    card.appendChild(submit);
    card.appendChild(status);
    key.focus();
  }

  /**
 * ensureToken — Etapa auxiliar ensureToken: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: Promise.resolve, then, request, localStorage.setItem.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function ensureToken() {
    if (token) return Promise.resolve();
    return request('installation').then(function (result) {
      token = result.token;
      localStorage.setItem('chplayer-installation', token);
    });
  }
  /**
 * start — Etapa auxiliar start: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: closeDialog, window.chplayerStart, addRoomButton, setInterval, catch, request, roomControls, activation.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function start() {
    closeDialog();
    if (!started) {
      window.chplayerStart();
      started = true;
      addRoomButton();
      setInterval(function () {
        request('status').catch(function () {
          room = null; roomControls();
          activation('Conecte-se e confirme a ativação para continuar.');
        });
      }, 60000);
    }
  }
  /**
 * roomRequest — Etapa auxiliar roomRequest: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: command; fields.
 * Operações presentes no corpo: request, Object.assign.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function roomRequest(command, fields) {
    return request('room', Object.assign({ command: command }, fields || {}));
  }
  /**
 * movieId — Converte título/ano do filme para o identificador de sala do Android.
 * Entradas: item.
 * Operações presentes no corpo: JSON.stringify, String.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function movieId(item) {
    return 'saimo:movies:' + JSON.stringify([item.title, String(item.year || '')]);
  }
  /**
 * addRoomButton — Adiciona os acessos de sala e catálogos oficiais à interface.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: element, bar.appendChild, button, dialog, card.appendChild, openOfficialCatalog, launch, showOfficial, on, appendChild.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function addRoomButton() {
    var bar = element('div');
    bar.id = 'ch-room';
    bar.appendChild(button('Sala privada', roomDialog));
    var official = button('Catálogos gratuitos', function () {
      var card = dialog('Catálogos gratuitos · players oficiais', true);
      card.appendChild(element('p', 'O conteúdo abre no serviço oficial, com suas próprias regras e disponibilidade.'));
      /**
 * launch — Etapa auxiliar launch: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: url.
 * Operações presentes no corpo: openOfficialCatalog, launch.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function launch(url) {
        if (window.chplayerNative && window.chplayerNative.openOfficialCatalog) window.chplayerNative.openOfficialCatalog(url);
        else if (window.webOSDev) window.webOSDev.launch({ id: window.webOSDev.APP.BROWSER, params: { target: url } });
      }
      card.appendChild(button('Pluto TV', function () { launch('https://pluto.tv/br/'); }));
      card.appendChild(button('Itaú Cultural Play', function () { launch('https://www.itauculturalplay.com.br/'); }));
    });
    /**
 * showOfficial — Etapa auxiliar showOfficial: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function showOfficial() { official.style.display = window.chplayerState.currentScreen === 'settings' ? '' : 'none'; }
    showOfficial(); window.chplayerState.on('screen-changed', showOfficial);
    bar.appendChild(official);
    document.getElementById('app').appendChild(bar);
  }
  /**
 * roomDialog — Monta o painel para criar/entrar em sala e conversar.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: dialog, element, card.appendChild, button, finally, catch, then, roomRequest, movieId, roomControls.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function roomDialog() {
    var card = dialog(room ? 'Sala privada · Chat' : 'Assistir em grupo', true);
    var status = element('p');
    /**
 * error — Etapa auxiliar error: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: problem.
 * Operações presentes no corpo: cálculos/retorno sem chamadas.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function error(problem) { status.textContent = problem.message; }
    if (!room) {
      var state = window.chplayerState;
      if (state.currentScreen === 'player' && state.currentVOD && !state.currentVOD.isSeries) {
        card.appendChild(button('Criar sala deste filme', function () {
          if (busy) return;
          busy = true;
          roomRequest('create', { movie: movieId(state.currentVOD) }).then(function (result) {
            room = result; roomControls();
            roomDialog();
          }).catch(error).finally(function () { busy = false; });
        }));
      }
      var link = input('Cole o convite da sala');
      card.appendChild(link);
      var join = button('Entrar em sala', function () {
        var match = /^(?:chplayer:\/\/sala\/)?([A-Za-z0-9_-]{43})\/?$/.exec(link.value.trim());
        if (!match || busy) { status.textContent = 'Confira o link de convite.'; return; }
        busy = true;
        roomRequest('read', { code: match[1] }).then(function (result) {
          var identity = JSON.parse(result.movie.slice('saimo:movies:'.length));
          var item = { id: 'f_' + identity[0], title: identity[0], year: identity[1], letra: /^[a-z]/i.test(identity[0]) ? identity[0][0].toUpperCase() : '#', isSeries: false };
          window.chplayerState.setScreen('player', { vod: item });
          room = result; roomControls();
          roomDialog();
        }).catch(error).finally(function () { busy = false; });
      });
      join.setAttribute('data-submit', 'true');
      card.appendChild(join);
    } else {
      card.appendChild(element('p', room.host ? 'Você controla a reprodução. Convite válido por 12 horas.' : 'A reprodução acompanha o anfitrião.'));
      var invite = input('Convite privado');
      invite.value = 'chplayer://sala/' + room.code;
      invite.readOnly = true;
      invite.onfocus = function () { invite.select(); };
      card.appendChild(invite);
      var messages = element('div');
      messages.id = 'ch-room-message';
      card.appendChild(messages);
      showMessages();
      var name = input('Seu nome');
      name.maxLength = 32;
      name.value = sessionStorage.getItem('chplayer-chat-name') || '';
      var text = input('Mensagem');
      text.maxLength = 400;
      card.appendChild(name);
      card.appendChild(text);
      var send = button('Enviar mensagem', function () {
        if (busy || !name.value.trim() || !text.value.trim()) return;
        busy = true;
        sessionStorage.setItem('chplayer-chat-name', name.value.trim());
        roomRequest('message', { code: room.code, name: name.value.trim(), text: text.value.trim() })
          .then(function (result) { room = result; roomControls(); text.value = ''; showMessages(); })
          .catch(error).finally(function () { busy = false; });
      });
      send.setAttribute('data-submit', 'true');
      card.appendChild(send);
      card.appendChild(button('Sair da sala', function () { room = null; roomControls(); closeDialog(); }));
    }
    card.appendChild(status);
  }
  /**
 * showMessages — Atualiza a lista visível de mensagens da sala.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: document.getElementById, join, map.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function showMessages() {
    var messages = document.getElementById('ch-room-message');
    if (!messages || !room) return;
    messages.textContent = room.messages.map(function (entry) {
      return entry.name + ' — ' + entry.text;
    }).join('\n') || 'Envie a primeira mensagem.';
    messages.scrollTop = messages.scrollHeight;
  }

  // Poll only while a room is open. The Android app uses the same two-second cadence.
  setInterval(function () {
    if (!room || polling || video.readyState < 1) return;
    var current = window.chplayerState;
    if (!current || current.currentScreen !== 'player' || !current.currentVOD ||
        current.currentVOD.isSeries || movieId(current.currentVOD) !== room.movie) {
      room = null; roomControls();
      return;
    }
    polling = true;
    var code = room.code;
    var command = room.host ? 'sync' : 'read';
    roomRequest(command, { code: code, seconds: video.currentTime || 0, playing: !video.paused && !video.ended })
      .then(function (result) {
        if (!room || room.code !== code) return;
        room = result; roomControls();
        if (!room.host) {
          var state = room.playback;
          var position = state.seconds + (state.playing ? Math.max(0, room.now - state.at) / 1000 : 0);
          if (Math.abs(video.currentTime - position) > 1.5) video.currentTime = position;
          if (state.playing && video.paused) video.play().catch(function () {});
          if (!state.playing && !video.paused) video.pause();
        }
        showMessages();
      }).catch(function (error) {
        if (room && !room.host) video.pause();
        var target = document.getElementById('ch-room-message');
        if (target) target.textContent = error.message;
      }).finally(function () { polling = false; });
  }, 2000);

  ensureToken().then(function () { return request('status'); }).then(start).catch(function () { activation(); });
})();
