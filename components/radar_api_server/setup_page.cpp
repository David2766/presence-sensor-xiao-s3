#include "setup_page.h"
#include "setup_page_i18n.h"

#ifndef PROGMEM
#define PROGMEM
#endif

namespace esphome {
namespace radar_api_server {

const char SETUP_PAGE[] PROGMEM = R"HTML(<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title></title>
<style>
:root{color-scheme:dark;--bg:#0b1117;--panel:#101923;--panel2:#152330;--text:#e8f0f6;--muted:#91a4b5;--line:#263849;--accent:#19b394;--danger:#e45757}
*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100dvh;background:linear-gradient(180deg,#0b1117,#0e161e);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--text);display:flex;align-items:center;justify-content:center;padding:clamp(14px,4vw,28px)}
.wrap{width:min(520px,100%)}.setup-topbar{display:flex;justify-content:flex-end;margin:0 0 8px}.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;box-shadow:0 18px 50px rgba(0,0,0,.35)}
.language-menu{position:relative;z-index:30}.language-menu-button{min-width:92px;height:36px;padding:0 12px;border:1px solid rgba(123,184,216,.24);border-radius:8px;background:rgba(17,24,32,.36);color:rgba(215,238,252,.82);font:inherit;font-size:13px;font-weight:700}.language-menu-button::after{content:"";display:inline-block;margin-left:8px;border-top:5px solid rgba(215,238,252,.68);border-right:4px solid transparent;border-left:4px solid transparent;vertical-align:middle}.language-menu-list{position:absolute;top:calc(100% + 7px);right:0;display:none;min-width:142px;gap:5px;padding:7px;border:1px solid rgba(123,184,216,.22);border-radius:8px;background:rgba(20,31,41,.98);box-shadow:0 14px 36px rgba(0,0,0,.34)}.language-menu-list.open{display:grid}.language-menu-list button{width:100%;min-height:32px;padding:0 10px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--text);font:inherit;text-align:left}.language-menu-list button.active{border-color:rgba(6,214,160,.42);background:rgba(6,214,160,.15);color:#9ff3d9}
.eyebrow{font-size:13px;color:var(--accent);font-weight:700;margin:0 0 8px}.title{font-size:25px;line-height:1.2;font-weight:800;margin:0 0 8px}.desc{font-size:14px;line-height:1.55;color:var(--muted);margin:0 0 18px}
.notice{margin:0 0 16px;padding:12px 13px;border:1px solid rgba(25,179,148,.28);border-radius:12px;background:rgba(25,179,148,.08);color:#b8f1e4;font-size:13px;line-height:1.45}
.status{display:grid;grid-template-columns:1fr auto;gap:8px 14px;margin:0 0 18px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#0d151d}.status span{font-size:13px;color:var(--muted)}.status b{font-size:13px;text-align:right}
label{display:block;font-size:13px;color:var(--muted);margin:14px 0 7px}.networks{display:grid;gap:8px;margin:8px 0 8px;max-height:36dvh;overflow-y:auto;overflow-x:hidden;padding-right:2px}.net{width:100%;max-width:100%;min-width:0;min-height:50px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);color:var(--text);display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;text-align:left;font:inherit}.net span{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.net.selected{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}.net.unsupported{opacity:.62}.net small{color:var(--muted);flex:0 0 auto;white-space:nowrap}.net-more{display:none;width:100%;max-width:100%;height:42px;margin:0 0 12px;border:1px dashed var(--line);border-radius:12px;background:transparent;color:var(--accent);font:inherit;font-weight:750}.net-more.visible{display:block}
input{width:100%;height:46px;border-radius:12px;border:1px solid var(--line);background:#0d151d;color:var(--text);padding:0 13px;font-size:16px}input:read-only{color:#b8f1e4;border-color:rgba(25,179,148,.42);background:rgba(25,179,148,.08)}input:focus{outline:2px solid rgba(25,179,148,.35);border-color:var(--accent)}
.password-help{margin:7px 0 0;color:var(--muted);font-size:12.5px;line-height:1.4}
.actions{display:flex;gap:10px;margin-top:16px}.btn{border:0;border-radius:12px;height:46px;padding:0 16px;font-size:15px;font-weight:750;color:#07110f;background:var(--accent);flex:1}.btn.secondary{background:#1a2a38;color:var(--text);border:1px solid var(--line);flex:0 0 auto}.btn:disabled{opacity:.55}
.message{min-height:22px;margin-top:13px;font-size:14px;color:var(--muted);line-height:1.45}.message.error{color:#ff9b9b}.message.ok{color:#7de2c8}
#completeCard{display:grid;gap:16px}#completeCard h1{margin:0;font-size:24px;line-height:1.2}#completeCard p{margin:0;color:var(--muted);font-size:14px;line-height:1.55}.status-pill{width:max-content;padding:6px 10px;border-radius:999px;background:rgba(25,179,148,.12);color:#7de2c8;font-size:12px;font-weight:800}.handoff-notice{display:grid;gap:6px;padding:13px;border:1px solid rgba(255,209,102,.32);border-radius:12px;background:rgba(255,209,102,.08);color:#ffe4a3}.handoff-notice strong{font-size:13px}.handoff-notice span{font-size:13px;line-height:1.5;color:#f2dba5}.info-grid{display:grid;gap:10px;margin:2px 0}.info-grid div{display:grid;gap:5px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#0d151d}.info-grid strong{font-size:12px;color:var(--muted)}.info-grid span{font-size:14px;font-weight:750;overflow-wrap:anywhere}#openDashboard{width:100%;margin-top:2px}
.setup-modal{position:fixed;inset:0;z-index:10;display:none;place-items:center;padding:18px;background:rgba(3,8,13,.64)}.setup-modal.open{display:grid}.setup-dialog{width:min(440px,100%);display:grid;gap:14px;padding:18px;border:1px solid var(--line);border-radius:18px;background:#101923;box-shadow:0 18px 50px rgba(0,0,0,.42)}.setup-dialog h2{margin:0;font-size:20px}.setup-dialog p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}.spinner{width:34px;height:34px;border-radius:50%;border:3px solid rgba(145,164,181,.26);border-top-color:var(--accent);animation:spin .8s linear infinite}.key-box{display:none;gap:8px}.key-box.visible{display:grid}.key-value{width:100%;padding:12px;border:1px solid var(--line);border-radius:12px;background:#0d151d;color:#d7f8ee;font-size:13px;line-height:1.35;overflow-wrap:anywhere}.security-warning{display:none;margin:0;color:#ff7777!important;font-size:14px!important;font-weight:800!important;line-height:1.55!important}.security-warning.visible{display:block}.modal-actions{display:flex;gap:8px}.modal-actions .btn{height:42px}@keyframes spin{to{transform:rotate(360deg)}}
.connection-overlay{position:fixed;inset:0;z-index:20;display:none;place-items:center;padding:18px;background:rgba(3,8,13,.78);backdrop-filter:blur(4px)}.connection-overlay.open{display:grid}.connection-card{width:min(440px,100%);display:grid;gap:12px;padding:20px;border:1px solid rgba(255,107,122,.38);border-radius:18px;background:#101923;box-shadow:0 18px 50px rgba(0,0,0,.46)}.connection-card strong{font-size:20px;color:#ffd7dd}.connection-card p{margin:0;color:var(--muted);line-height:1.55}.connection-card .btn{width:100%}
@media (min-width:641px) and (max-width:1024px){.wrap{width:min(560px,100%)}.card{padding:24px}.networks{max-height:42dvh}}
@media (max-width:640px){body{align-items:flex-start;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}.wrap{width:100%}.card{border-radius:14px;padding:16px;box-shadow:0 10px 28px rgba(0,0,0,.28)}.title{font-size:22px}.desc{font-size:13px;margin-bottom:14px}.notice{font-size:12.5px;padding:11px 12px}.status{grid-template-columns:minmax(0,1fr) auto;padding:12px;gap:7px 10px}.status b{max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.networks{max-height:34dvh}.net{min-height:54px;padding:13px 12px}.net small{font-size:12px}.net-more{height:46px}.actions{flex-direction:column-reverse}.btn,.btn.secondary{width:100%;flex:0 0 auto;height:48px}.message{font-size:13px}}
</style>
</head>
<body>
<main class="wrap">
  <div class="setup-topbar">
    <div class="language-menu">
      <button class="language-menu-button" id="languageMenuButton" type="button" aria-haspopup="menu" aria-expanded="false" data-i18n="languageName"></button>
      <div class="language-menu-list" id="languageMenuList" role="menu">
        <button type="button" role="menuitem" data-language="ko"></button>
        <button type="button" role="menuitem" data-language="en"></button>
      </div>
    </div>
  </div>
  <section class="card">
    <p class="eyebrow" data-i18n="initialWifiSetup"></p>
    <h1 class="title" id="deviceName"></h1>
    <p class="desc" data-i18n="intro"></p>
    <div class="notice" data-i18n="setupNotice"></div>
    <div class="status">
      <span data-i18n="status"></span><b id="stateText" data-i18n="checking"></b>
      <span data-i18n="setupAddress"></span><b>192.168.4.1</b>
    </div>
    <label data-i18n="wifiList"></label>
    <div class="networks" id="networks"><div class="message" data-i18n="scanningNetworks"></div></div>
    <button class="net-more" id="networkToggle" type="button"></button>
    <label for="manualSsid" data-i18n="manualSsid"></label>
    <input id="manualSsid" autocomplete="off" data-i18n-placeholder="manualSsidPlaceholder">
    <label for="password" data-i18n="password"></label>
    <input id="password" type="password" autocomplete="current-password" data-i18n-placeholder="password" minlength="8" maxlength="63">
    <p class="password-help" data-i18n="passwordHelp"></p>
    <div class="actions">
      <button class="btn secondary" id="refresh" type="button" data-i18n="refresh"></button>
      <button class="btn" id="connect" type="button" data-i18n="connect" disabled></button>
    </div>
    <div class="message" id="message"></div>
  </section>
  <section class="card" id="completeCard" style="display:none">
    <div class="status-pill" data-i18n="setupComplete"></div>
    <h1 data-i18n="wifiConnectedTitle"></h1>
    <p data-i18n="wifiConnectedDescription"></p>
    <div class="handoff-notice">
      <strong data-i18n="haHandoffTitle"></strong>
      <span data-i18n="haHandoffDescription"></span>
    </div>
    <div class="info-grid">
      <div><strong data-i18n="deviceIp"></strong><span id="completeIp">-</span></div>
      <div><strong data-i18n="dashboard"></strong><span id="completeDashboard">-</span></div>
    </div>
    <button class="btn" id="openDashboard" type="button" data-i18n="prepareDashboard"></button>
  </section>
</main>
<div class="setup-modal" id="setupModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
  <section class="setup-dialog">
    <div class="spinner" id="modalSpinner"></div>
    <h2 id="modalTitle" data-i18n="setupInProgress"></h2>
    <p id="modalText" data-i18n="pleaseWait"></p>
    <div class="key-box" id="keyBox">
      <div class="key-value" id="apiKey"></div>
      <button class="btn secondary" id="copyKey" type="button" data-i18n="copyApiKey"></button>
    </div>
    <p class="security-warning" id="securityWarning" data-i18n="apiKeyContinueWithKey"></p>
    <div class="modal-actions" id="modalActions" style="display:none">
      <button class="btn" id="finishSetup" type="button" data-i18n="confirm"></button>
      <button class="btn secondary" id="retrySetup" type="button" data-i18n="retry"></button>
    </div>
  </section>
</div>
<div class="connection-overlay" id="connectionOverlay" role="dialog" aria-modal="true">
  <section class="connection-card">
    <strong data-i18n="setupDisconnectedTitle"></strong>
    <p data-i18n="setupDisconnectedDescription"></p>
    <button class="btn" id="checkConnection" type="button" data-i18n="checkAgain"></button>
  </section>
</div>
<script>
const LANGUAGE_STORAGE_KEY='presence-sensor-language';
const TEXT=)HTML"
    RADAR_SETUP_PAGE_I18N
    R"HTML(;

const $=id=>document.getElementById(id);
let selected='',allNetworks=[],networksExpanded=false,pendingSsid='',pendingPsk='',modalMode='key',lastDashboardUrl='',dashboardReady=false,dashboardTimer=null,linkFailCount=0,linkWatchTimer=null,apiKeyAvailable=false,messageKey='',messageType='',messageParams={};

function normalizeLanguage(value){const code=String(value||'').toLowerCase();if(code.startsWith('ko'))return 'ko';if(code.startsWith('en'))return 'en';return ''}
function resolveInitialLanguage(){let stored='';try{stored=localStorage.getItem(LANGUAGE_STORAGE_KEY)||''}catch(e){}return normalizeLanguage(stored)||normalizeLanguage(navigator.language)||'en'}
let language=resolveInitialLanguage();
function t(key,params={}){const value=TEXT[language][key];return String(value).replace(/\{([a-zA-Z0-9_]+)\}/g,(placeholder,name)=>Object.prototype.hasOwnProperty.call(params,name)?String(params[name]):placeholder)}
function setLiveText(id,key,params={}){const el=$(id);if(!el)return;el.dataset.i18nLive=key;el.dataset.i18nParams=JSON.stringify(params);el.textContent=t(key,params)}
function applyLanguage(nextLanguage){language=normalizeLanguage(nextLanguage)||'en';document.documentElement.lang=language;document.title=t('pageTitle');document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n)});document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{el.placeholder=t(el.dataset.i18nPlaceholder)});document.querySelectorAll('[data-i18n-live]').forEach(el=>{let params={};try{params=JSON.parse(el.dataset.i18nParams||'{}')}catch(e){}el.textContent=t(el.dataset.i18nLive,params)});document.querySelectorAll('[data-language]').forEach(button=>{const optionLanguage=button.dataset.language;button.textContent=TEXT[optionLanguage].languageName;const active=optionLanguage===language;button.classList.toggle('active',active);button.setAttribute('aria-checked',active?'true':'false')});if(messageKey)msg(messageKey,messageType,messageParams);if(allNetworks.length)renderNetworks();try{localStorage.setItem(LANGUAGE_STORAGE_KEY,language)}catch(e){}}
function closeLanguageMenu(){$('languageMenuList').classList.remove('open');$('languageMenuButton').setAttribute('aria-expanded','false')}
function toggleLanguageMenu(){const open=$('languageMenuList').classList.toggle('open');$('languageMenuButton').setAttribute('aria-expanded',open?'true':'false')}
function log(){try{console.log.apply(console,['[setup]'].concat(Array.prototype.slice.call(arguments)))}catch(e){}}
function msg(key='',type='',params={}){messageKey=key;messageType=type;messageParams=params;const el=$('message');el.textContent=key?t(key,params):'';el.className='message '+type}
function bars(rssi){if(rssi>=-55)return t('signalStrong');if(rssi>=-70)return t('signalNormal');return t('signalWeak')}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function selectedSsid(){return (selected||$('manualSsid').value||'').trim()}
function passwordValid(){const p=$('password').value;return p.length>=8&&p.length<=63}
function updateConnectEnabled(){$('connect').disabled=!selectedSsid()||!passwordValid()}
function validatePasswordMessage(){if(!$('password').value){msg('');return false}if(!passwordValid()){msg('passwordInvalid','error');return false}msg('');return true}
function renderNetworks(){const box=$('networks');const toggle=$('networkToggle');box.innerHTML='';const shown=networksExpanded?allNetworks:allNetworks.slice(0,5);shown.forEach(n=>{const b=document.createElement('button');b.type='button';b.className='net'+(n.ssid===selected?' selected':'')+(n.locked?'':' unsupported');b.innerHTML='<span>'+esc(n.ssid)+'</span><small>'+(n.locked?t('lockedNetworkPrefix'):t('openWifiUnsupportedPrefix'))+bars(n.rssi)+' · '+n.rssi+'dBm</small>';b.onclick=()=>{if(!n.locked){msg('openWifiUnsupportedMessage','error');return}selected=n.ssid;$('manualSsid').value=n.ssid;$('manualSsid').readOnly=true;document.querySelectorAll('.net').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');updateConnectEnabled();msg('')};box.appendChild(b)});if(allNetworks.length>5){toggle.textContent=networksExpanded?t('collapse'):t('showMore',{count:allNetworks.length-5});toggle.classList.add('visible');toggle.onclick=()=>{networksExpanded=!networksExpanded;renderNetworks()}}else{toggle.classList.remove('visible');toggle.onclick=null;toggle.textContent=''}updateConnectEnabled()}
function openModal(titleKey,textKey,loading=true){$('setupModal').classList.add('open');setLiveText('modalTitle',titleKey);setLiveText('modalText',textKey);$('modalSpinner').style.display=loading?'block':'none';$('keyBox').classList.remove('visible');$('securityWarning').classList.remove('visible');$('modalActions').style.display='none'}
function showKeyModal(key,changed){$('setupModal').classList.add('open');setLiveText('modalTitle',changed?'apiKeyNewTitle':'apiKeyExistingTitle');setLiveText('modalText',changed?'apiKeyNewDescription':'apiKeyExistingDescription');$('modalSpinner').style.display='none';apiKeyAvailable=!!key;$('apiKey').textContent=key||t('existingKey');$('keyBox').classList.toggle('visible',apiKeyAvailable);setLiveText('securityWarning',apiKeyAvailable?'apiKeyContinueWithKey':'apiKeyContinueWithoutKey');$('securityWarning').classList.add('visible');$('modalActions').style.display='flex';setLiveText('finishSetup','confirm');$('retrySetup').style.display='none'}
function showFailModal(titleKey,textKey){$('setupModal').classList.add('open');setLiveText('modalTitle',titleKey);setLiveText('modalText',textKey);$('modalSpinner').style.display='none';$('keyBox').classList.remove('visible');$('securityWarning').classList.remove('visible');$('modalActions').style.display='flex';setLiveText('retrySetup','retry');$('retrySetup').style.display='block'}
async function loadStatus(){try{const s=await fetch('/api/setup/status',{cache:'no-store'}).then(r=>r.json());$('deviceName').textContent=s.device?.name||'Presence Sensor';setLiveText('stateText',s.wifi?.connected?'connected':'waitingSetup');if(s?.wifi?.connected&&s?.wifi?.ip&&!lastDashboardUrl){showComplete(s.wifi.ip)}return s}catch(e){setLiveText('stateText','waitingSetup');return null}}
async function loadNetworks(){const box=$('networks');const hadList=box.querySelector('.net,.net-more');if(!hadList)box.innerHTML='<div class="message" data-i18n="scanningNetworks">'+esc(t('scanningNetworks'))+'</div>';try{const data=await fetch('/api/setup/networks',{cache:'no-store'}).then(r=>r.json());allNetworks=(data.networks||[]).filter(n=>n.ssid).sort((a,b)=>(b.rssi??-999)-(a.rssi??-999));if(!allNetworks.length){if(!hadList)box.innerHTML='<div class="message" data-i18n="noNetworks">'+esc(t('noNetworks'))+'</div>';return}if(!allNetworks.some(n=>n.ssid===selected)){selected='';$('manualSsid').readOnly=false;$('manualSsid').value='';$('connect').disabled=true}renderNetworks()}catch(e){msg('wifiListFailed','error')}}
async function refreshNetworks(manual=false){if(manual&&!confirm(t('rescanConfirm')))return;msg('scanningReconnect');$('refresh').disabled=true;try{await fetch('/api/setup/scan',{method:'POST'});setTimeout(loadNetworks,3200)}catch(e){msg(allNetworks.length?'keepExistingList':'scanStartFailed','error')}finally{setTimeout(()=>$('refresh').disabled=false,3600)}}
async function connect(){const ssid=selectedSsid();if(!ssid)return;if(!validatePasswordMessage()){$('password').focus();updateConnectEnabled();return}pendingSsid=ssid;pendingPsk=$('password').value;$('connect').disabled=true;openModal('checkingApiKeyTitle','pleaseWait');try{const prepare=await fetch('/api/setup/prepare',{method:'POST'});const result=await prepare.json();if(!prepare.ok||!result.ok)throw new Error(result.error||'prepare_failed');modalMode='key';showKeyModal(result.apiKey||'',!!result.apiKeyChanged);msg('apiKeyCheckedMessage','ok')}catch(e){showFailModal('apiKeyPrepareFailedTitle','apiKeyPrepareFailedDescription');msg('setupFailed','error');$('connect').disabled=false}}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function waitForWifiConnected(){log('waitForWifiConnected:start');const deadline=Date.now()+20000;while(Date.now()<deadline){await wait(1500);try{const status=await fetch('/api/setup/status',{cache:'no-store'}).then(r=>r.json());log('waitForWifiConnected:status',status?.wifi,status?.setup);if(status&&status.wifi&&status.wifi.connected&&status.wifi.ip)return status}catch(e){log('waitForWifiConnected:fetch_failed',String(e))}}log('waitForWifiConnected:timeout');throw new Error('wifi_connect_timeout')}
async function pingSetupLink(){if(modalMode==='connecting'||lastDashboardUrl)return true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),2500);try{await fetch('/api/setup/ping',{cache:'no-store',signal:controller.signal});clearTimeout(timer);linkFailCount=0;$('connectionOverlay').classList.remove('open');return true}catch(e){clearTimeout(timer);linkFailCount+=1;if(linkFailCount>=3&&modalMode!=='connecting'&&!lastDashboardUrl)$('connectionOverlay').classList.add('open');return false}}
function hideConnectionOverlay(){linkFailCount=0;$('connectionOverlay').classList.remove('open')}
function stopLinkWatch(){if(linkWatchTimer){clearInterval(linkWatchTimer);linkWatchTimer=null}}
function startLinkWatch(interval=2500){if(linkWatchTimer)clearInterval(linkWatchTimer);linkWatchTimer=setInterval(pingSetupLink,interval)}
function showComplete(ip){log('showComplete',ip);modalMode='success';stopLinkWatch();hideConnectionOverlay();lastDashboardUrl='http://'+ip+'/dashboard?setup=1';dashboardReady=false;if(dashboardTimer){clearInterval(dashboardTimer);dashboardTimer=null}$('setupModal').classList.remove('open');const firstSection=document.querySelector('main > section:not(#completeCard)');if(firstSection)firstSection.style.display='none';$('completeIp').textContent=ip;$('completeDashboard').textContent=ip+'/dashboard';$('openDashboard').disabled=false;setLiveText('openDashboard','startFinishing');$('completeCard').style.display=''}
async function finish(){if(!pendingSsid){showFailModal('noWifiTitle','noWifiDescription');return}const fd=new URLSearchParams();fd.set('ssid',pendingSsid);fd.set('psk',pendingPsk);log('finish:start',pendingSsid);stopLinkWatch();hideConnectionOverlay();openModal('configuringWifiTitle','checkingConnection');modalMode='connecting';try{const r=await fetch('/api/setup/apply-wifi',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fd});const result=await r.json().catch(()=>({}));log('finish:apply-wifi-result',r.status,result);if(!r.ok||!result.ok)throw new Error(result.error||'wifi_apply_failed');const status=await waitForWifiConnected();log('finish:connected-status',status);showComplete(status.wifi.ip);try{const connectedResponse=await fetch('/api/setup/connected',{method:'POST'});log('finish:connected-endpoint',connectedResponse.status)}catch(e){log('finish:connected-endpoint-failed',String(e))}}catch(e){log('finish:failed',String(e));showFailModal('wifiFailedTitle','wifiFailedDescription');modalMode='wifi_failed';setLiveText('finishSetup','confirm');setLiveText('retrySetup','retry');$('retrySetup').style.display='';$('connect').disabled=false;startLinkWatch()}}
async function retryWifi(){if(modalMode!=='wifi_failed'||!pendingSsid)return;pendingPsk=$('password').value;if(!validatePasswordMessage()){$('setupModal').classList.remove('open');$('password').focus();updateConnectEnabled();return}await finish()}
async function confirmModal(){if(modalMode==='wifi_failed'){$('setupModal').classList.remove('open');$('password').focus();return}if(modalMode==='success'){try{await fetch('/api/setup/finish',{method:'POST'})}catch(e){}$('setupModal').classList.remove('open');return}await finish()}
async function openDashboard(){if(!lastDashboardUrl)return;log('openDashboard:start',lastDashboardUrl,'ready=',dashboardReady);stopLinkWatch();hideConnectionOverlay();if(dashboardReady){window.location.href=lastDashboardUrl;return}const button=$('openDashboard');button.disabled=true;let remaining=10;setLiveText('openDashboard','finishingCountdown',{seconds:remaining});try{fetch('/api/setup/finish',{method:'POST',keepalive:true}).then(r=>log('openDashboard:finish-endpoint',r.status)).catch(e=>log('openDashboard:finish-endpoint-failed',String(e)))}catch(e){log('openDashboard:finish-endpoint-throw',String(e))}dashboardTimer=setInterval(()=>{remaining-=1;if(remaining>0){setLiveText('openDashboard','finishingCountdown',{seconds:remaining});return}clearInterval(dashboardTimer);dashboardTimer=null;dashboardReady=true;button.disabled=false;setLiveText('openDashboard','openDashboard')},1000)}
function selectApiKeyText(text){const el=$('apiKey');if(!el)return;if(el.select){el.focus();el.select();try{el.setSelectionRange(0,text.length)}catch(e){}return}if(document.createRange&&window.getSelection){const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range)}}
function legacyCopyText(text){const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='0';ta.style.top='0';ta.style.width='1px';ta.style.height='1px';ta.style.opacity='0';document.body.appendChild(ta);ta.focus();ta.select();try{ta.setSelectionRange(0,text.length)}catch(e){}let ok=false;try{ok=document.execCommand('copy')}catch(e){ok=false}ta.remove();return ok}
async function copyApiKey(){const text=($('apiKey').value||$('apiKey').textContent||'').trim();if(!apiKeyAvailable||!text){msg('noNewApiKey','error');return}let ok=false;if(window.isSecureContext&&navigator.clipboard&&navigator.clipboard.writeText){try{await navigator.clipboard.writeText(text);ok=true}catch(e){ok=false}}if(!ok)ok=legacyCopyText(text);if(ok){setLiveText('copyKey','copied');msg('apiKeyCopied','ok')}else{selectApiKeyText(text);setLiveText('copyKey','copyManually');msg('apiKeySelected','error')}}

$('manualSsid').oninput=()=>{if($('manualSsid').readOnly)return;selected='';document.querySelectorAll('.net').forEach(x=>x.classList.remove('selected'));updateConnectEnabled();msg('')};
$('password').oninput=()=>{validatePasswordMessage();updateConnectEnabled()};
$('refresh').onclick=()=>refreshNetworks(true);
$('connect').onclick=connect;
$('finishSetup').onclick=confirmModal;
$('retrySetup').onclick=retryWifi;
$('copyKey').onclick=copyApiKey;
$('openDashboard').onclick=openDashboard;
$('checkConnection').onclick=pingSetupLink;
$('languageMenuButton').onclick=event=>{event.stopPropagation();toggleLanguageMenu()};
document.querySelectorAll('[data-language]').forEach(button=>{button.onclick=()=>{applyLanguage(button.dataset.language);closeLanguageMenu()}});
document.addEventListener('click',event=>{const target=event.target;if(!target||!target.closest||!target.closest('.language-menu'))closeLanguageMenu()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeLanguageMenu()});
applyLanguage(language);
setLiveText('stateText','checking');
setLiveText('modalTitle','setupInProgress');
setLiveText('modalText','pleaseWait');
setLiveText('securityWarning','apiKeyContinueWithKey');
setLiveText('copyKey','copyApiKey');
setLiveText('finishSetup','confirm');
setLiveText('retrySetup','retry');
loadStatus();loadNetworks();startLinkWatch();
</script>

</body>
</html>)HTML";
#undef RADAR_SETUP_PAGE_I18N
const std::size_t SETUP_PAGE_SIZE = sizeof(SETUP_PAGE) - 1;

}  // namespace radar_api_server
}  // namespace esphome
