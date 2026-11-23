/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Aviso de atualização da plataforma. Usa a versão instalada e a entrada correspondente em releases.json; não deve comparar versões de plataformas diferentes.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
(function () {
  'use strict';
  const manifestURL='https://chplayer.example.com/updates/releases.json';
  /**
 * newer — Compara versão publicada com a instalada.
 * Entradas: next; current.
 * Operações presentes no corpo: test, map, next.split, current.split.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function newer(next,current){
    if(!/^\d+\.\d+\.\d+$/.test(next)||!/^\d+\.\d+\.\d+$/.test(current))return false;
    const a=next.split('.').map(Number),b=current.split('.').map(Number);
    for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;
  }
  let checking=false,pending=null;
  window.addEventListener('keydown',event=>{
    const overlay=document.getElementById('ch-update');if(!overlay)return;
    event.stopImmediatePropagation();
    const buttons=overlay.querySelectorAll('button');
    if(event.key==='Escape'){event.preventDefault();buttons[1].click();}
    if(event.key==='Enter'&&document.activeElement?.tagName==='BUTTON'){event.preventDefault();document.activeElement.click();}
    if(event.key==='Tab'){event.preventDefault();(document.activeElement===buttons[0]?buttons[1]:buttons[0]).focus();}
  },true);
  /**
 * show — Exibe o aviso quando a interface permite.
 * Entradas: release.
 * Operações presentes no corpo: document.getElementById, sessionStorage.getItem, document.createElement, overlay.setAttribute, overlay.appendChild, card.appendChild, catch, openUpdatePage, actions.appendChild, sessionStorage.setItem.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function show(release){
    if(document.getElementById('ch-update')||sessionStorage.getItem('chplayer-dismiss-update')===release.version)return;
    const current=window.chplayerState;
    if(current&&current.currentScreen==='player'){pending=release;return;}
    pending=null;
    const previous=document.activeElement;
    const overlay=document.createElement('div');overlay.id='ch-update';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','ch-update-title');
    const card=document.createElement('section');overlay.appendChild(card);
    const title=document.createElement('h2');title.id='ch-update-title';title.textContent='Nova versão disponível';card.appendChild(title);
    const description=document.createElement('p');description.textContent='CHPlayer '+release.version+' está disponível. '+(release.notes||'');card.appendChild(description);
    const actions=document.createElement('div');card.appendChild(actions);
    const update=document.createElement('button');update.textContent='Atualizar';update.onclick=()=>window.chplayerNative.openUpdatePage().catch(()=>{description.textContent='Não foi possível abrir o navegador. Acesse chplayer-android.buffmile2.chatgpt.site/atualizar.html';});actions.appendChild(update);
    const close=document.createElement('button');close.textContent='Fechar';close.onclick=()=>{sessionStorage.setItem('chplayer-dismiss-update',release.version);overlay.remove();previous?.focus();};actions.appendChild(close);
    overlay.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape')close.click();if(event.key==='Tab'){event.preventDefault();(document.activeElement===update?close:update).focus();}});
    document.body.appendChild(overlay);update.focus();
  }
  /**
 * check — Consulta se há atualização disponível.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: version, fetch, Date.now, AbortSignal.timeout, platform, response.json, newer, show.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function check(){
    if(checking||!window.chplayerNative?.version)return;
    checking=true;
    try{
      const current=await window.chplayerNative.version();
      const response=await fetch(manifestURL+'?t='+Date.now(),{signal:AbortSignal.timeout(15000)});
      if(!response.ok)return;
      const platform=await window.chplayerNative.platform();
      const release=(await response.json())[platform];
      if(!release)return;
      if(typeof release.version==='string'&&newer(release.version,current)&&typeof release.notes==='string'&&release.notes.length<=1000)show(release);
    }catch{}finally{checking=false;}
  }
  const style=document.createElement('style');style.textContent='#ch-update{position:fixed;inset:0;z-index:100001;display:grid;place-items:center;background:#080a14c9;padding:24px;font:15px/1.6 Arial,sans-serif;color:#fff}#ch-update section{width:min(500px,100%);padding:30px;border-radius:18px;background:#191c2d;border:1px solid #ffffff24}#ch-update h2{font-size:24px;margin-bottom:14px}#ch-update p{color:#c2c8d8;margin-bottom:24px}#ch-update section>div{display:flex;gap:12px}#ch-update button{padding:11px 22px;border:1px solid #ffffff25;border-radius:9px;background:#7060ef;color:white;cursor:pointer;font:15px Arial}#ch-update button:last-child{background:#292c3d}#ch-update button:focus-visible{outline:2px solid white!important;outline-offset:3px}';document.head.appendChild(style);
  check();setInterval(check,6*60*60*1000);
  const ready=setInterval(()=>{if(!window.chplayerState)return;clearInterval(ready);window.chplayerState.on('screen-changed',()=>{if(pending)show(pending);});},500);
})();
