/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Lógica da página pública de atualização: seleciona a plataforma, mostra instruções e verifica o arquivo disponibilizado. Não é o atualizador interno do aplicativo.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
(function(){
'use strict';
var releases={},selected='',busy=false;
var field=document.getElementById('platform'),release=document.getElementById('release'),download=document.getElementById('download'),status=document.getElementById('status'),progress=document.getElementById('progress');
var instructions={
android:['Baixe o APK no próprio Android. Aguarde a preparação do arquivo terminar.','Abra o arquivo APK baixado e confirme Atualizar. Se o Android pedir permissão para instalar deste navegador, siga a solicitação do sistema.','Mantenha o aplicativo anterior instalado: use a atualização por cima para conservar a ativação e as preferências.'],
windows:['Feche o CHPlayer no computador Windows.','Abra o ZIP baixado e extraia seu conteúdo dentro da pasta do CHPlayer, onde fica CHPlayer.exe. Confirme a substituição de resources/app.asar.','Abra o CHPlayer novamente. Não apague os outros arquivos da pasta.'],
linux:['Feche o CHPlayer no computador Linux.','Abra o ZIP baixado e extraia seu conteúdo dentro da pasta do CHPlayer, onde fica o executável CHPlayer. Confirme a substituição de resources/app.asar.','Abra o CHPlayer novamente. Não apague os outros arquivos da pasta.'],
lg:['Baixe o pacote IPK em um computador. Ele é específico para LG webOS.','Mantenha o Developer Mode ativo e a TV cadastrada na ferramenta webOS CLI. Instale o novo IPK usando ares-install no mesmo aplicativo.','Abra o CHPlayer na TV. O arquivo não é um APK de Android. Este pacote continua em modo de desenvolvimento.'],
roku:['Baixe o ZIP em um computador; não extraia o arquivo para enviá-lo ao Roku.','Com o Developer Mode ativo, abra no navegador o endereço do instalador de desenvolvimento do Roku, entre com rokudev e sua senha e envie o novo ZIP.','A instalação substitui o canal de desenvolvimento atual. Abra o CHPlayer no Roku. Este pacote ainda não é uma publicação da loja Roku.']};
/**
 * safeFile — Etapa auxiliar safeFile: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: file.
 * Operações presentes no corpo: test, file.includes.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function safeFile(file){return typeof file==='string'&&/^\/updates\/[a-zA-Z0-9_.\/-]+$/.test(file)&&!file.includes('..');}
/**
 * render — Etapa auxiliar render: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: nenhuma declarada.
 * Operações presentes no corpo: document.getElementById, toFixed, forEach, document.createElement, list.appendChild, help.appendChild, set, history.replaceState.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
function render(){
 selected=field.value;var item=releases[selected];release.hidden=!item;status.textContent='';progress.hidden=true;if(!item)return;
 document.getElementById('title').textContent='CHPlayer para '+item.name+' · '+item.version;
 document.getElementById('notes').textContent=item.notes;
 document.getElementById('size').textContent=(item.bytes/1048576).toFixed(1)+' MB · '+(selected==='android'?'APK para Android':selected==='lg'?'Pacote IPK para LG webOS':selected==='roku'?'Canal ZIP para Roku':'Atualização dos arquivos do aplicativo');
 var list=document.getElementById('instructions');list.textContent='';instructions[selected].forEach(function(text){var li=document.createElement('li');li.textContent=text;list.appendChild(li);});
 var help=document.getElementById('help');help.textContent='';if(selected==='lg'||selected==='roku'){var a=document.createElement('a');a.textContent='Guia oficial de instalação '+item.name;a.href=selected==='lg'?'https://webostv.developer.lge.com/develop/getting-started/developer-mode-app':'https://developer.roku.com/dev/docs/developer-setup';a.target='_blank';a.rel='noopener';help.appendChild(a);}
 download.textContent='Baixar para '+item.name;var url=new URL(location.href);url.searchParams.set('platform',selected);history.replaceState(null,'',url);
}
field.addEventListener('change',render);
/**
 * sha — Etapa auxiliar sha: recebe os argumentos abaixo e coordena as operações listadas. Consulte o corpo para as condições específicas.
 * Entradas: bytes.
 * Operações presentes no corpo: join, map, Array.from, digest, padStart, v.toString.
 * Localização de chamadas e importações: veja docs/architecture.md.
 */
async function sha(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(function(v){return v.toString(16).padStart(2,'0');}).join('');}
download.addEventListener('click',async function(){
 if(busy)return;var item=releases[selected];if(!item)return;
 if(!item.parts){if(!safeFile(item.file)){status.textContent='Arquivo indisponível.';return;}var link=document.createElement('a');link.href=item.file;link.download=item.file.split('/').pop();document.body.appendChild(link);link.click();link.remove();return;}
 busy=true;download.disabled=true;field.disabled=true;progress.hidden=false;status.textContent='Preparando o APK do Android… mantenha esta página aberta.';
 try{
  var chunks=[],received=0;
  for(var i=0;i<item.parts.length;i++){
   var part=item.parts[i];if(!safeFile(part.file))throw Error();var response=await fetch(part.file);if(!response.ok)throw Error();var bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==part.bytes||await sha(bytes)!==part.sha256)throw Error();chunks.push(bytes);received+=bytes.length;progress.value=Math.round(received/item.bytes*100);status.textContent='Preparando APK: '+progress.value+'%';
  }
  var full=new Uint8Array(received),offset=0;chunks.forEach(function(bytes){full.set(bytes,offset);offset+=bytes.length;});if(received!==item.bytes||await sha(full)!==item.sha256)throw Error();
  var blob=new Blob([full],{type:'application/vnd.android.package-archive'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=item.filename;document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},60000);status.textContent='Download do APK iniciado. Abra o arquivo no Android e confirme Atualizar.';
 }catch(error){status.textContent='Não foi possível preparar o arquivo. Confira a conexão e tente novamente.';}finally{busy=false;download.disabled=false;field.disabled=false;}
});
fetch('/updates/releases.json?t='+Date.now()).then(function(r){if(!r.ok)throw Error();return r.json();}).then(function(data){releases=data;var requested=new URLSearchParams(location.search).get('platform');var agent=navigator.userAgent;field.value=Object.prototype.hasOwnProperty.call(instructions,requested)?requested:/Android/i.test(agent)?'android':/Web0S|webOS/i.test(agent)?'lg':/Windows/i.test(agent)?'windows':/Linux/i.test(agent)?'linux':'';document.getElementById('loading').textContent='';render();}).catch(function(){document.getElementById('loading').textContent='Não foi possível carregar as versões. Recarregue a página em alguns instantes.';});
})();
