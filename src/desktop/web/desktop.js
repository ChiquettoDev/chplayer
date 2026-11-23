/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Adaptação da interface para mouse/teclado e tamanhos de janela do PC. Reaproveita chplayerState e as telas de player.js.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
(function () {
  'use strict';
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = './desktop.css'; document.head.appendChild(css);
  const titles = {home:'Início',live:'TV ao vivo',ondemand:'Filmes e séries',search:'Buscar',favorites:'Favoritos',events:'Eventos',radios:'Rádios',settings:'Configurações',ficha:'Detalhes',player:'Assistindo',minhas:'Minhas listas',addons:'Complementos',guide:'Programação'};
  /**
 * node — Etapa auxiliar node: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: tag; text.
 * Operações presentes no corpo: document.createElement.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function node(tag, text) { const el = document.createElement(tag); if (text) el.textContent = text; return el; }
  /**
 * button — Cria um botão e associa a ação de clique.
 * Entradas: text; action.
 * Operações presentes no corpo: node.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function button(text, action) { const el = node('button', text); el.type='button'; el.onclick=action; return el; }
  /**
 * fullscreen — Etapa auxiliar fullscreen: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: fullscreen, document.exitFullscreen, catch, requestFullscreen.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function fullscreen() {
    if (window.chplayerNative && window.chplayerNative.fullscreen) { window.chplayerNative.fullscreen(); return; }
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  window.addEventListener('keydown',e=>{
    if(document.getElementById('ch-gate'))return;
    if(e.target.matches('input,textarea')){e.stopImmediatePropagation();return;}
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button]')){e.preventDefault();e.stopImmediatePropagation();e.target.click();}
  },true);
  const timer = setInterval(() => {
    if (!window.chplayerApp) return;
    clearInterval(timer);
    const app=window.chplayerApp, state=window.chplayerState, video=document.getElementById('tv-video');
    const live=app.screens.get('live'), drawer=live.drawer;
    const toolbar=node('div'); toolbar.id='desktop-toolbar';
    const heading=node('span'); heading.id='desktop-heading';toolbar.appendChild(heading);
    const search=node('input');search.id='desktop-search';search.type='search';search.placeholder='Buscar canais, filmes e séries';search.setAttribute('aria-label',search.placeholder);toolbar.appendChild(search);
    search.addEventListener('input',()=>{if(state.currentScreen!=='search')state.setScreen('search');const view=app.screens.get('search');view.currentQuery=search.value;view.updateQueryDisplay();view.scheduleSearch();search.focus();});
    toolbar.appendChild(button('Tela cheia ⛶',fullscreen));document.getElementById('app').appendChild(toolbar);
    const controls=node('div');controls.id='desktop-controls';controls.hidden=true;
    controls.appendChild(button('← Voltar',()=>state.setScreen(state.currentScreen==='player'?'ficha':'home')));
    const play=button('Pausar',()=>{if(document.documentElement.classList.contains('desktop-room-guest'))return;video.paused?video.play().catch(()=>{}):video.pause();});controls.appendChild(play);
    const sources=button('Fontes',()=>{if(state.currentScreen==='live')live.openCurrentChannelSources();});controls.appendChild(sources);
    const list=button('Canais',()=>{drawer.isOpen()?live.fecharPainel():live.abrirPainel();update();});controls.appendChild(list);
    const volume=node('input');volume.id='desktop-volume';volume.type='range';volume.min=0;volume.max=1;volume.step=.05;volume.value=video.volume;volume.setAttribute('aria-label','Volume');volume.oninput=()=>{video.volume=Number(volume.value);video.muted=false;};controls.appendChild(volume);
    controls.appendChild(button('⛶',fullscreen));const status=node('span');status.id='desktop-status';status.textContent='F11: tela cheia · Esc: voltar';controls.appendChild(status);document.getElementById('app').appendChild(controls);
    video.addEventListener('play',()=>play.textContent='Pausar');video.addEventListener('pause',()=>play.textContent='Reproduzir');
    /**
 * update — Etapa auxiliar update: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: toggle, drawer.isOpen, document.getElementById, contains.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function update(){
      const playing=state.currentScreen==='player';
      const isLive=state.currentScreen==='live';
      heading.textContent=titles[state.currentScreen]||'CHPlayer';
      document.documentElement.classList.toggle('desktop-playing',playing);
      document.documentElement.classList.toggle('desktop-live-panel',isLive&&drawer.isOpen());
      controls.hidden=!isLive;list.hidden=!isLive;
      sources.hidden=!isLive;
      const label=document.getElementById('menu-tab-on_demand')?.querySelector('span');if(label)label.textContent='Filmes e séries';
      video.controls=playing&&!document.documentElement.classList.contains('desktop-room-guest');
      play.disabled=document.documentElement.classList.contains('desktop-room-guest');
    }
    state.on('screen-changed',()=>{update();if(state.currentScreen==='search')search.focus();});
    state.on('tela-cheia',()=>queueMicrotask(update));
    for (const view of app.screens.values()) {
      if (!view.sourceModal || !view.sourceModal.getElement) continue;
      const content=view.sourceModal.getElement().querySelector('.tv-modal-content');
      if(content) { const close=button('Fechar',()=>view.sourceModal.close());close.className='desktop-close';content.prepend(close); }
    }
    /**
 * accessible — Etapa auxiliar accessible: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: forEach, document.querySelectorAll, el.setAttribute.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function accessible(){
      document.querySelectorAll('.nav-focusable:not([role])').forEach(el=>{if(el.tagName!=='INPUT'){el.setAttribute('role','button');el.tabIndex=0;}});
    }
    accessible();new MutationObserver(accessible).observe(document.getElementById('tv-screens-container'),{childList:true,subtree:true});
    const originalDraw=drawer.desenhar.bind(drawer);
    drawer.desenhar=function(){
      originalDraw();
      // Desktop player.js renders the full category; retain the existing tuning callbacks.
      const selected=drawer.foco, first=drawer.topo;
      for(const [i,row]of [...drawer.listaEl.children].entries()){
        row.onclick=()=>{const channel=drawer.filtrados[first+i];if(channel){live.tuneChannel(channel);drawer.foco=first+i;drawer.mostrarInfo();update();}};
        row.oncontextmenu=e=>{e.preventDefault();live.openChannelSources(drawer.filtrados[first+i]);};
      }
      for(const [i,chip]of [...drawer.chipsEl.children].entries())chip.onclick=()=>{drawer.secao=i;drawer.filtrar();drawer.desenhar();};
      drawer.foco=selected;
      drawer.listaEl.querySelector('.foco')?.scrollIntoView({block:'nearest'});
      update();
    };
    document.addEventListener('keydown',e=>{
      if(e.target.matches('input,textarea')||document.getElementById('ch-gate'))return;
      if(e.key===' '&&(state.currentScreen==='player'||state.currentScreen==='live')){e.preventDefault();play.click();e.stopImmediatePropagation();}
      if(e.key==='f'&&['live','player'].includes(state.currentScreen)){e.preventDefault();fullscreen();}
    },true);
    update();
  },100);
})();
