/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Aviso de atualização da plataforma. Usa a versão instalada e a entrada correspondente em releases.json; não deve comparar versões de plataformas diferentes.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
(function () {
  'use strict';
  var current = '0.4.5', pending = null, dismissed = '', checking = false;
  var page = 'https://chplayer.example.com/atualizar.html?platform=lg';
  /**
 * newer — Compara versão publicada com a instalada.
 * Entradas: version.
 * Operações presentes no corpo: test, map, version.split, current.split.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function newer(version) {
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return false;
    var a = version.split('.').map(Number), b = current.split('.').map(Number);
    for (var i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
  }
  /**
 * show — Exibe o aviso quando a interface permite.
 * Entradas: release.
 * Operações presentes no corpo: document.getElementById, document.createElement, overlay.setAttribute, overlay.appendChild, card.appendChild, launch, overlay.remove, previous.focus, appendChild, update.focus.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function show(release) {
    if (dismissed === release.version || document.getElementById('ch-update')) return;
    if ((window.chplayerState && window.chplayerState.currentScreen === 'player') || document.getElementById('ch-gate')) { pending = release; return; }
    pending = null;
    var previous = document.activeElement;
    var overlay = document.createElement('div'); overlay.id = 'ch-update'; overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
    var card = document.createElement('section'); overlay.appendChild(card);
    var title = document.createElement('h2'); title.textContent = 'Nova versão para sua TV LG'; card.appendChild(title);
    var text = document.createElement('p'); text.textContent = 'CHPlayer ' + release.version + ' está disponível.'; card.appendChild(text);
    var update = document.createElement('button'); update.textContent = 'Atualizar';
    update.onclick = function () {
      if (window.webOSDev && window.webOSDev.launch) {
        window.webOSDev.launch({id:window.webOSDev.APP.BROWSER, params:{target:page}, onFailure:function(){text.textContent='Abra no celular ou computador: '+page;}});
      } else text.textContent = 'Abra no celular ou computador: ' + page;
    }; card.appendChild(update);
    var close = document.createElement('button'); close.textContent = 'Fechar';
    close.onclick = function () { dismissed = release.version; overlay.remove(); if (previous) previous.focus(); }; card.appendChild(close);
    document.body.appendChild(overlay); update.focus();
  }
  window.addEventListener('keydown', function (event) {
    var overlay = document.getElementById('ch-update'); if (!overlay) return;
    event.stopImmediatePropagation();
    var buttons = overlay.querySelectorAll('button');
    if ([37,38,39,40,9].indexOf(event.keyCode) >= 0) { event.preventDefault(); (document.activeElement === buttons[0] ? buttons[1] : buttons[0]).focus(); }
    if (event.keyCode === 13) { event.preventDefault(); if (document.activeElement && document.activeElement.click) document.activeElement.click(); }
    if ([27,461,10009].indexOf(event.keyCode) >= 0) { event.preventDefault(); buttons[1].click(); }
  }, true);
  /**
 * check — Consulta se há atualização disponível.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: document.createElement, frame.setAttribute, setTimeout, clearTimeout, window.removeEventListener, frame.remove, finish, newer, show, window.addEventListener.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function check() {
    if (checking) return; checking = true;
    // The TV app has a different origin. Read public version data through an
    // isolated frame; accept only messages from this exact frame and Site.
    var frame = document.createElement('iframe');
    frame.style.display = 'none'; frame.setAttribute('aria-hidden','true');
    var timer = setTimeout(finish,15000);
    /**
 * finish — Etapa auxiliar finish: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: clearTimeout, window.removeEventListener, frame.remove.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function finish() { clearTimeout(timer);window.removeEventListener('message',receive);frame.remove();checking=false; }
    /**
 * receive — Etapa auxiliar receive: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: event.
 * Operações presentes no corpo: finish, newer, show.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function receive(event) {
      if(event.origin !== 'https://chplayer.example.com' || event.source !== frame.contentWindow) return;
      if(!event.data || event.data.type !== 'chplayer-versions') return;
      var release = event.data.releases && event.data.releases.lg;
      finish();
      if(release && newer(release.version)) show(release);
    }
    window.addEventListener('message',receive);
    frame.src = 'https://chplayer.example.com/updates/version-bridge.html?t='+Date.now();
    document.body.appendChild(frame);
  }
  var style = document.createElement('style'); style.textContent='#ch-update{position:absolute;left:0;top:0;width:1920px;height:1080px;z-index:100001;background:#080a14ed;display:flex;align-items:center;justify-content:center;color:white;font:32px/1.6 Arial}#ch-update section{width:1050px;padding:60px;border-radius:24px;background:#191c2d}#ch-update h2{font-size:42px;margin-bottom:24px}#ch-update p{margin-bottom:30px;overflow-wrap:anywhere}#ch-update button{font:30px Arial;padding:20px 36px;margin-right:20px;background:#7060ef;border:3px solid transparent;border-radius:14px;color:white}#ch-update button:focus{outline:4px solid white!important}';document.head.appendChild(style);
  check();setInterval(check,21600000);setInterval(function(){if(pending)show(pending);},2000);
})();
