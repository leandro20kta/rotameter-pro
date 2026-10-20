(()=>{'use strict';
const $=id=>document.getElementById(id);
const DEFAULT_PROFILES={carro:{base:3,km:1,wait:0.18,extra:0},mota:{base:2,km:0.7,wait:0.12,extra:0}};
// EXEMPLOS, NÃO TARIFAS LEGAIS: o utilizador configura cada perfil antes da viagem.
const DEFAULT=DEFAULT_PROFILES.carro;
const MAX_ACCURACY=60,MAX_SPEED=57,WAIT_GRACE=30000,LOST_AFTER=25000,MAX_POINTS=3000;
const APP_BUILD='V12.1-REAL-STREETS-PDF-20261020';
const KEY_SESSION='rotameter_v3_session',KEY_HISTORY='rotameter_v3_history',KEY_RATES='rotameter_v3_rates';
const ratesKey=vehicle=>KEY_RATES+'_'+vehicle;
const read=(key,fallback)=>{try{const val=localStorage.getItem(key);return val?JSON.parse(val):fallback}catch{return fallback}};
const store=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v))}catch{setMessage('Não foi possível guardar dados neste dispositivo. Verifique o armazenamento.',true)}};
const money=x=>'€ '+Number(x||0).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=x=>Number(x||0).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
const clock=ms=>{const t=Math.floor(Math.max(0,ms)/1000);return String(Math.floor(t/3600)).padStart(2,'0')+':'+String(Math.floor(t%3600/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')};
const date=ts=>new Date(ts).toLocaleString('pt-PT',{dateStyle:'short',timeStyle:'short'});
const hav=(a,b)=>{const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r,z=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(z)))};
const bearing=(a,b)=>{const r=Math.PI/180,y=Math.sin((b.lon-a.lon)*r)*Math.cos(b.lat*r),x=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lon-a.lon)*r);return(Math.atan2(y,x)*180/Math.PI+360)%360};
const validRates=r=>r&&['base','km','wait','extra'].every(k=>Number.isFinite(+r[k])&&+r[k]>=0&&+r[k]<=1000);
let rates=read(ratesKey('carro'),read(KEY_RATES,DEFAULT_PROFILES.carro));if(!validRates(rates))rates={...DEFAULT};
let history=read(KEY_HISTORY,[]);if(!Array.isArray(history))history=[];
let trip=null,lastResult=null,currentFix=null,watch=null,watchGeneration=0,lastGpsAt=0,lastUiMap=0,lastSaved=0,gpsPermission='pending',gpsErrorText='',mode='carro',following=true,threeD=false,latestHeading=0,lastMapDataAt=0,previewPath=null,destination=null,routeRequest=0,map=null,mapLoaded=false,vehicleMarker=null,destinationMarker=null,eventMarkers=[],hasRequestedGps=false,finishing=false,afterFinish=false;
let lastSpeechAt=0,lastRenderedEventsKey='',lastKnownVehicleAsset='';
let backgroundWarningShown=false;
const labelStop=(p)=>p?.name||(p?.candidateName?'Possível: '+p.candidateName+' (não confirmado)':'Local não identificado');
const roundedMoney=x=>Math.round((Number(x)||0)*100+Number.EPSILON)/100;
function createLegStart(name,t,timestamp=Date.now()){return{label:name,ts:timestamp,meters:t?.meters||0,elapsedMs:t?.elapsedMs||0,waitMs:t?.waitMs||0};}
function closeLeg(to, point=currentFix, timestamp=Date.now()){if(!trip||!trip.legStart)return;
 const t=trip, from=t.legStart, dm=Math.max(0,t.meters-from.meters),dw=Math.max(0,t.waitMs-from.waitMs);
 const amount=roundedMoney(dm/1000*t.rates.km+dw/60000*t.rates.wait+(t.legs.length===0?t.rates.base+t.rates.extra:0));
 t.legs.push({from:from.label,to:to,startedAt:from.ts,endedAt:timestamp,meters:dm,elapsedMs:Math.max(0,t.elapsedMs-from.elapsedMs),waitMs:dw,cost:amount,lat:point?.lat??null,lon:point?.lon??null});
 t.legStart=createLegStart(to,t,timestamp);
}
function finishStop(timestamp=Date.now()){if(!trip?.activeStop)return;
 const st=trip.activeStop;
 st.departedAt=timestamp;st.durationMs=Math.max(0,st.departedAt-st.ts);
 st.waitMs=Math.max(0,trip.waitMs-(st.waitAtStart||0));
 st.cost=roundedMoney(st.waitMs/60000*trip.rates.wait);trip.activeStop=null;
 persist(true);
}
function stopCost(st,t){return roundedMoney(Math.max(0,st.waitMs??(t.waitMs-(st.waitAtStart||t.waitMs)))/60000*t.rates.wait)}
async function resolveStopName(stop){
 if(!stop||stop.name||!map||!mapLoaded)return;
 // Lê apenas os nomes de POIs já presentes nos mosaicos carregados no mapa.
 // Sem consulta de coordenadas a serviços externos e sem inventar nomes.
 try{
  const pixel=map.project([stop.lon,stop.lat]);
  const features=map.queryRenderedFeatures([[pixel.x-16,pixel.y-16],[pixel.x+16,pixel.y+16]])||[];
  const names=features.filter(f=>f.properties?.name && (/poi|shop|place|amenity|label|symbol|landmark/i.test(f.layer?.id||'') || f.properties?.class==='shop'));
  const best=names.find(f=>f.geometry?.type==='Point' && hav(stop,{lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0]})<=35);
  if(best){stop.candidateName=String(best.properties.name).slice(0,90);const ev=trip?.events.find(e=>e.stopId===stop.ts);if(ev)ev.detail='Possível local: '+stop.candidateName+' (confirmar)';persist();render();}
 }catch{ /* A identificação é opcional e pode ser corrigida manualmente. */ }
}
function editStopName(ts){const t=trip||lastResult;if(!t)return;const st=t.stops?.find(x=>x.ts===ts);if(!st)return;
 const supplied=prompt('Nome da paragem (ex.: Continente, McDonald’s, rua):',st.name||st.candidateName||'');
 if(supplied===null)return;const label=supplied.trim().slice(0,90);if(!label)return;
 st.name=label;st.nameConfirmed=true;const ev=t.events?.find(e=>e.stopId===st.ts);if(ev)ev.detail=label;
 if(trip)persist(true);else {store(KEY_HISTORY,history)};render();updateLiveMap(true);
}

let plannedSteps=[],plannedManeuvers=[],routeDistanceMeters=0,routeDurationSeconds=0,lastGuidanceAt=0,mapStyleVariant='bright',lastCameraAt=0,lastMarkersSignature='';
const estimate=t=>{const o=t||{meters:0,waitMs:0,rates};const r=o.rates||rates;return{base:r.base,km:o.meters/1000*r.km,wait:o.waitMs/60000*r.wait,extra:r.extra,total:r.base+o.meters/1000*r.km+o.waitMs/60000*r.wait+r.extra}};
const emptyGeo=()=>({type:'FeatureCollection',features:[]});
const lineGeo=segments=>({type:'FeatureCollection',features:segments.filter(s=>s.length>=2).map(p=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:p.map(a=>[a.lon,a.lat])}}))});
function setMessage(message,bad=false){$('message').textContent=message;$('statusDot').classList.toggle('bad',bad);$('statusDot').classList.toggle('ok',!bad&&!!currentFix)}
function speech(t){if(!('speechSynthesis'in window))return;try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='pt-PT';u.rate=.96;window.speechSynthesis.speak(u);lastSpeechAt=Date.now()}catch{}}
function gpsFresh(){return currentFix&&Date.now()-currentFix.ts<LOST_AFTER&&currentFix.accuracy<=MAX_ACCURACY&&gpsPermission==='granted'}
function gate(message){if(message)$('gateMessage').textContent=message;const block=!finishing&&!afterFinish&&!trip&&!gpsFresh();$('gpsGate').hidden=!block;const b=$('grantGpsBtn');b.disabled=false;b.textContent=gpsPermission==='requesting'?'A procurar sinal GPS… (tentar novamente)':'Permitir localização / Tentar novamente →';}
function gpsState(){const ok=!!gpsFresh(),label=ok?'GPS ligado':gpsPermission==='denied'?'GPS bloqueado':gpsPermission==='requesting'?'GPS a procurar':'Sem sinal GPS';$('gpsLabel').textContent=label;$('gpsChip').className='chip '+(ok?'chip-on':gpsPermission==='denied'?'chip-error':'chip-wait');$('accuracyLabel').textContent=ok?'Precisão ±'+Math.round(currentFix.accuracy)+' m':'GPS sem sinal';$('statusLabel').textContent=trip?(trip.state==='running'?(ok?'Em viagem':'GPS interrompido'):'Em pausa'):(ok?'Pronto':'À espera de GPS');$('vehicleLabel').textContent=currentFix?'Lat '+currentFix.lat.toFixed(4)+' · Lon '+currentFix.lon.toFixed(4):'À espera da localização';}
const isNativeContainer=!!window.webkit?.messageHandlers?.rotameter||!!window.RotaMeterAndroid?.postMessage;
const isNativeIOS=!!window.webkit?.messageHandlers?.rotameter;
function nativeCommand(type){try{const msg={type,since:trip?.lastRawGpsTs||0,id:trip?.id||null,startedAt:trip?.startedAt||null};if(isNativeIOS)window.webkit.messageHandlers.rotameter.postMessage(msg);else window.RotaMeterAndroid?.postMessage(JSON.stringify(msg));}catch{}}
function syncNativeVoiceRoute(){
 if(!isNativeContainer)return;
 const bridge=isNativeIOS?window.webkit?.messageHandlers?.rotameter:{postMessage:m=>window.RotaMeterAndroid?.postMessage(JSON.stringify(m))};
 if(!bridge)return;
 try{
   if(!destination||!plannedManeuvers.length){bridge.postMessage({type:'navigation-voice-clear'});return;}
   const steps=plannedManeuvers.slice(0,100).map(entry=>{
     const loc=entry.step?.maneuver?.location;
     if(!loc||!Number.isFinite(loc[0])||!Number.isFinite(loc[1]))return null;
     return {lon:loc[0],lat:loc[1],text:directionText(entry.step)};
   }).filter(Boolean);
   // Directions are preview-only unless the user has an active trip.
   bridge.postMessage({type:'navigation-voice-route',routeId:String(destination.lat)+'_'+String(destination.lon),steps});
 }catch(e){console.warn('Canal de voz nativo indisponível',e)}
}

function ingestNativeBatch(items){
 if(!Array.isArray(items)||!items.length)return;
 const fixes=items.filter(p=>p&&Number.isFinite(p.ts)&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Number.isFinite(p.accuracy)
   &&p.accuracy>=0&&p.accuracy<=MAX_ACCURACY&&p.ts<=Date.now()+10000&&p.ts>0)
   .sort((a,b)=>a.ts-b.ts);
 let imported=0;
 for(const point of fixes){
   const fix={lat:point.lat,lon:point.lon,accuracy:point.accuracy,heading:point.heading??null,speed:point.speed??null,ts:point.ts};
   if(!trip||trip.state==='paused'||point.ts<=(trip.lastRawGpsTs||0))continue;
   const prev=trip.anchor,dt=prev?(fix.ts-prev.ts)/1000:0;
   if(prev&&dt>0){
      const distance=hav(prev,fix);
      if(dt<=150&&distance<=MAX_SPEED*dt+Math.max(fix.accuracy,prev.accuracy)*.5){
        const moved=distance>Math.max(5,(fix.accuracy+prev.accuracy)*(fix.speed!==null&&fix.speed<1.8?.65:.32));
        if(moved){if(trip.activeStop)finishStop(fix.ts);trip.meters+=distance;trip.waitStart=fix.ts;trip.autoStopArmed=true;trip.route.push({...fix,break:false});if(trip.route.length>MAX_POINTS)trip.route=[trip.route[0],...trip.route.slice(1).filter((_,i)=>i%2===0)];}
        else {
          const start=trip.waitStart||prev.ts;
          const chargeBefore=Math.max(0,prev.ts-start-WAIT_GRACE),chargeAfter=Math.max(0,fix.ts-start-WAIT_GRACE);
          trip.waitMs+=Math.max(0,chargeAfter-chargeBefore);
          if(fix.ts-start>=45000&&trip.autoStopArmed){trip.autoStopArmed=false;recordAutomaticStop(fix);}
        }
        trip.elapsedMs+=dt*1000;
      }else {trip.gaps++;trip.route.push({...fix,break:true});trip.waitStart=fix.ts;}
   }else if(!prev){trip.route.push({...fix,break:true});trip.waitStart=fix.ts;}
   trip.anchor=fix;trip.lastRawGpsTs=fix.ts;trip.lastValidAt=fix.ts;imported++;
   if(fix.ts>=Number(currentFix?.ts||0))currentFix=fix;
 }
 if(imported){trip.state='running';trip.lastTick=Date.now();gpsPermission='granted';
  setMessage('Rota nativa sincronizada: '+imported+' posições sincronizadas, sem reiniciar a viagem.');
  store(KEY_SESSION,trip);render();updateLiveMap(true)}
}
function recordAutomaticStop(fix){
 if(!trip||trip.activeStop)return;
 // A native background segment can register a stop without a browser prompt.
 const stop={ts:fix.ts,lat:fix.lat,lon:fix.lon,auto:true,name:null,waitAtStart:trip.waitMs,durationMs:0,waitMs:0,cost:0};
 closeLeg('Paragem '+(trip.stops.length+1),fix,fix.ts);trip.stops.push(stop);trip.activeStop=stop;
 trip.events.push({label:'Paragem automática',detail:'Local por identificar',ts:fix.ts,lat:fix.lat,lon:fix.lon,stopId:fix.ts});
}
window.RotaMeterNative={ingestBatch:ingestNativeBatch,onFix(point){if(trip){if(!window.__rmSyncTs||Date.now()-window.__rmSyncTs>2000){window.__rmSyncTs=Date.now();nativeCommand('tracking-sync')}return;}const pos={timestamp:point.ts,coords:{latitude:point.lat,longitude:point.lon,accuracy:point.accuracy,speed:point.speed,heading:point.heading}};receiveFix(pos)},onError(message){const denied=/recusad|não autorizad|ative a permissão|serviços de localização/i.test(message||'');if(denied)gpsPermission='denied';setMessage(message||'Serviço nativo indisponível.',true);if(denied)gate(message);render()}};
function startGps(){if(isNativeContainer){nativeCommand('location-read');gpsPermission='requesting';gate('O sistema irá solicitar localização precisa. Para viagem em segundo plano, autorize a localização na app nativa.');return;}hasRequestedGps=true;watchGeneration++;const generation=watchGeneration;if(watch!=null&&navigator.geolocation)navigator.geolocation.clearWatch(watch);watch=null;
 if(!window.isSecureContext||!navigator.geolocation){gpsPermission='denied';gpsErrorText=window.isSecureContext?'Este navegador não suporta GPS. Abra no Safari ou Chrome.':'Abra a aplicação por um endereço https://. O GPS é bloqueado em ficheiros locais.';gate(gpsErrorText);gpsState();return;}
 gpsPermission='requesting';gate('O iPhone pode pedir autorização de localização. Escolha «Permitir» e ative «Localização precisa».');gpsState();
 try{watch=navigator.geolocation.watchPosition(pos=>{if(generation!==watchGeneration)return;receiveFix(pos)},err=>{if(generation!==watchGeneration)return;gpsPermission=err.code===1?'denied':'unavailable';gpsErrorText=err.code===1?'Localização recusada. No iPhone: Definições → Privacidade e Segurança → Serviços de Localização → Safari ou RotaMeter → permitir e ativar Localização precisa.':err.code===3?'O GPS demorou a responder. Experimente ao ar livre e toque novamente.':'Não foi possível obter localização. Confirme os Serviços de Localização.';if(trip?.state==='running')markGpsLost();setMessage(gpsErrorText,true);gate(gpsErrorText);gpsState();render()}, {enableHighAccuracy:true,maximumAge:0,timeout:17000})}catch(e){gpsPermission='unavailable';gate('O Safari não conseguiu pedir acesso ao GPS. Confirme o HTTPS e as permissões.');gpsState();}}
function parseFix(position){const c=position?.coords,t=Number(position?.timestamp)||Date.now();return{lat:c?.latitude,lon:c?.longitude,accuracy:c?.accuracy,heading:Number.isFinite(c?.heading)?c.heading:null,speed:Number.isFinite(c?.speed)?c.speed:null,ts:t}}
function validateFix(fix){return Number.isFinite(fix.lat)&&Number.isFinite(fix.lon)&&Math.abs(fix.lat)<=90&&Math.abs(fix.lon)<=180&&Number.isFinite(fix.accuracy)&&fix.accuracy>=0&&fix.accuracy<=MAX_ACCURACY&&Date.now()-fix.ts<20000&&fix.ts<Date.now()+10000}
function receiveFix(pos){const fix=parseFix(pos);if(!validateFix(fix)){gpsPermission='imprecise';const p=fix.accuracy;gate('O GPS respondeu, mas ainda não está preciso'+(Number.isFinite(p)?' (±'+Math.round(p)+' m)':'')+'. Aguarde em área aberta.');gpsState();return;}
 const old=currentFix;currentFix=fix;lastGpsAt=Date.now();gpsPermission='granted';if(trip)trip.lastRawGpsTs=fix.ts;if(fix.heading!==null&&Number.isFinite(fix.heading))latestHeading=fix.heading;else if(old&&hav(old,fix)>9)latestHeading=bearing(old,fix);
 if(trip&&(trip.state==='running'||trip.state==='lost'))advanceTrip(fix);gpsState();gate();ensureMap();updateLiveMap();updateGuidance();setMessage(trip?.state==='running'?'Percurso GPS a ser registado.':'Localização autorizada. Já pode iniciar.',false);render();}
function markGpsLost(){if(!trip||trip.state!=='running')return;trip.state='lost';trip.gaps++;trip.anchor=null;trip.waitStart=null;trip.lastTick=Date.now();pushEvent('Interrupção GPS','Contagem congelada');persist(true);setMessage('GPS interrompido: valor congelado. Não serão inventados quilómetros.',true);}
function newTrip(){const time=Date.now();return{id:'RM'+time,vehicle:mode,createdAt:time,startedAt:time,endedAt:null,state:'running',meters:0,elapsedMs:0,waitMs:0,lastTick:time,waitStart:time,anchor:currentFix,route:[{...currentFix,break:false}],pickup:null,stops:[],events:[],legs:[],legStart:{label:'Origem / casa',ts:time,meters:0,elapsedMs:0,waitMs:0},activeStop:null,rates:{...rates},gaps:0,lastValidAt:time,lastAutoStopAt:0,autoStopArmed:true}}
function pushEvent(label,detail='',point=currentFix){if(!trip)return;trip.events.push({label,detail,ts:Date.now(),lat:point?.lat??null,lon:point?.lon??null});}
function startTrip(){if(trip){if(trip.state==='paused'||trip.state==='lost'){if(!gpsFresh()){setMessage('Precisa de GPS válido para retomar.',true);startGps();return}trip.state='running';trip.anchor=currentFix;trip.lastTick=Date.now();trip.waitStart=Date.now();trip.route.push({...currentFix,break:true});pushEvent('Percurso retomado');if(isNativeContainer)nativeCommand('tracking-resume');speech('Percurso retomado.');render();updateLiveMap(true);persist(true);}return;}
 if(!gpsFresh()){gate('Autorize GPS preciso para iniciar. Sem sinal válido não é possível medir a viagem.');startGps();return;}
 afterFinish=false;trip=newTrip();trip.lastRawGpsTs=currentFix.ts;if(isNativeContainer){nativeCommand('tracking-start');syncNativeVoiceRoute()}pushEvent('Partida',mode==='mota'?'Modo mota':'Modo carro');speech('Partida.');render();updateLiveMap(true);persist(true);}
function pauseTrip(){if(!trip||trip.state!=='running')return;billTime();trip.state='paused';trip.anchor=null;trip.waitStart=null;pushEvent('Pausa manual','Valor congelado');if(isNativeContainer)nativeCommand('tracking-pause');speech('Percurso em pausa.');setMessage('Contagem pausada. Toque em Retomar quando necessário.');persist(true);render();}
function advanceTrip(fix){if(!trip)return;if(trip.state==='lost'){trip.state='running';trip.anchor=fix;trip.lastTick=Date.now();trip.waitStart=Date.now();trip.route.push({...fix,break:true});pushEvent('GPS recuperado','Trecho sem sinal excluído');speech('GPS recuperado.');persist();return;}if(trip.state!=='running')return;
 const old=trip.anchor;if(!old){trip.anchor=fix;return;}const dt=(fix.ts-old.ts)/1000,meters=hav(old,fix);if(dt<=0)return;
 const maxMeters=MAX_SPEED*dt+Math.max(old.accuracy,fix.accuracy)*.5;if(meters>maxMeters){trip.gaps++;trip.anchor=fix;trip.route.push({...fix,break:true});pushEvent('Salto GPS ignorado','Distância não incluída');return;}
 trip.anchor=fix;trip.lastValidAt=Date.now();if(meters>Math.max(5,(fix.accuracy+old.accuracy)*(fix.speed!==null&&fix.speed<1.8?.65:.32))){
 if(trip.activeStop)finishStop();trip.meters+=meters;trip.waitStart=Date.now();trip.autoStopArmed=true;trip.route.push({...fix,break:false});if(trip.route.length>MAX_POINTS){trip.route=[trip.route[0],...trip.route.slice(1).filter((_,i)=>i%2===0)];}
 }else if(fix.speed!==null&&fix.speed>2){trip.waitStart=Date.now();trip.autoStopArmed=true;}
 if(trip.waitStart&&Date.now()-trip.waitStart>90000&&trip.autoStopArmed){trip.autoStopArmed=false;trip.lastAutoStopAt=Date.now();markStop(true);}
 persist();}
function billTime(){if(!trip||trip.state!=='running')return;if(isNativeContainer)return;const now=Date.now();if(!gpsFresh()){markGpsLost();return;}const diff=Math.max(0,Math.min(now-trip.lastTick,5000));trip.elapsedMs+=diff;const sinceStop=trip.waitStart?now-trip.waitStart:0;if(sinceStop>WAIT_GRACE)trip.waitMs+=diff;trip.lastTick=now;}
function markStop(auto=false){if(!trip||trip.state!=='running'||!gpsFresh()||trip.activeStop)return;
 billTime();const entry={ts:Date.now(),lat:currentFix.lat,lon:currentFix.lon,auto,name:null,waitAtStart:trip.waitMs,durationMs:0,waitMs:0,cost:0};
 closeLeg('Paragem '+(trip.stops.length+1),currentFix);trip.stops.push(entry);trip.activeStop=entry;
 trip.events.push({label:auto?'Paragem automática':'Paragem marcada',detail:'A identificar local…',ts:entry.ts,lat:entry.lat,lon:entry.lon,stopId:entry.ts});
 speech('Chegámos.');updateLiveMap(true);persist(true);render();resolveStopName(entry);
}
function markPickup(){if(!trip||trip.state!=='running'||!gpsFresh())return;
 billTime();closeLeg('Recolha da pessoa',currentFix);
 trip.pickup={ts:Date.now(),lat:currentFix.lat,lon:currentFix.lon};pushEvent('Recolha','Pessoa recolhida');speech('Recolha confirmada.');updateLiveMap(true);persist(true);render();
}
function toResult(){const t=trip;
 finishStop();closeLeg('Destino final',currentFix);
 if(t.legs.length){const delta=roundedMoney(estimate(t).total)-roundedMoney(t.legs.reduce((a,b)=>a+b.cost,0));t.legs.at(-1).cost=roundedMoney(t.legs.at(-1).cost+delta)}
 return{...t,activeStop:null,endedAt:Date.now(),state:'completed',total:roundedMoney(estimate(t).total),route:t.route.slice(),legs:(t.legs||[]).slice(),events:[...t.events,{label:'Percurso concluído',ts:Date.now(),detail:'Estimativa final',lat:currentFix?.lat,lon:currentFix?.lon}],stops:t.stops.slice(),rates:{...t.rates}};
}
function finishTrip(){if(!trip||!['running','paused','lost'].includes(trip.state))return;if(!window.confirm('Finalizar todo o percurso e preparar o relatório PDF?'))return;billTime();finishing=true;afterFinish=true;lastResult=toResult();history.unshift(lastResult);history=history.slice(0,50);store(KEY_HISTORY,history);trip=null;lastRenderedEventsKey='';if(isNativeContainer)nativeCommand('tracking-stop');try{localStorage.removeItem(KEY_SESSION)}catch{};$('gpsGate').hidden=true;render();updateLiveMap(true);showFinish(lastResult);speech('Chegámos. Percurso concluído.');finishing=false;}
function showFinish(t){$('finishValue').textContent=money(t.total);$('finishMeta').textContent=`${fmt(t.meters/1000)} km · ${clock(t.elapsedMs)} · ${t.stops.length} paragens\n${date(t.startedAt)} → ${date(t.endedAt)} · ${t.vehicle==='mota'?'Mota':'Carro'}`;$('finishGpsNote').hidden=!t.gaps;$('finishGpsNote').textContent=t.gaps?`Aviso: ${t.gaps} falha(s) GPS. O total pode estar subestimado; o relatório assinala essas falhas.`:'';try{$('finishDialog').showModal()}catch{$('finishDialog').setAttribute('open','')}}
function closeDialog(id){const d=$(id);try{d.close()}catch{d.removeAttribute('open')} }
function persist(force=false){if(!trip)return;const now=Date.now();if(!force&&now-lastSaved<1500)return;lastSaved=now;store(KEY_SESSION,trip)}
function restore(){const s=read(KEY_SESSION,null);if(!s||!Array.isArray(s.route)||!validRates(s.rates)||!s.startedAt||s.state==='completed')return;
 mode=s.vehicle==='mota'?'mota':'carro';rates=read(ratesKey(mode),DEFAULT_PROFILES[mode]);if(!validRates(rates))rates={...DEFAULT_PROFILES[mode]};$('modeBtn').innerHTML=(mode==='mota'?'Mota':'Carro')+' <span>⌄</span>';
 trip={...s,state:s.state==='paused'?'paused':'lost',anchor:null,waitStart:null,lastTick:Date.now(),legs:Array.isArray(s.legs)?s.legs:[],stops:Array.isArray(s.stops)?s.stops:[],events:Array.isArray(s.events)?s.events:[],activeStop:null};
 if(s.state!=='paused'){trip.gaps=(s.gaps||0)+(isNativeContainer?0:1);trip.route.push({...trip.route.at(-1),break:true});pushEvent('Regresso ao aplicativo','Continuação automática após obter novo GPS; intervalo sem medição');setMessage('A mesma viagem foi recuperada. A localização será retomada automaticamente; o trecho sem sinal não foi medido.',true)}
 else setMessage('Viagem recuperada em pausa manual. Toque em Retomar.',true);
 store(KEY_SESSION,trip);
}
function render(){const t=trip,q=estimate(t),active=t?.state==='running',paused=t&&(t.state==='paused'||t.state==='lost');$('fareValue').textContent=fmt(q.total);$('distanceValue').textContent=fmt((t?.meters||0)/1000)+' km';$('timeValue').textContent=clock(t?.elapsedMs||0);$('waitValue').textContent=clock(t?.waitMs||0);$('tripBadge').textContent=active?'EM VIAGEM':t?.state==='lost'?'GPS INTERROMPIDO':paused?'EM PAUSA':'PRONTO A INICIAR';$('startBtn').disabled=active||(!gpsFresh()&&!paused);$('startText').textContent=paused?'Retomar viagem':'Iniciar viagem';$('pauseBtn').disabled=!active;$('pickupBtn').disabled=!active||!gpsFresh();$('stopBtn').disabled=!active||!gpsFresh();$('finishBtn').disabled=!t;$('modeBtn').disabled=!!t;$('settingsBtn').disabled=!!t;
 $('basePrice').textContent=money(q.base);$('distancePrice').textContent=money(q.km);$('waitingPrice').textContent=money(q.wait);$('extraPrice').textContent=money(q.extra);$('totalPrice').textContent=money(q.total);$('stopsBadge').textContent=(t?.stops?.length||0)+' paragens';const events=t?.events||[];const key=(t?.id||'idle')+'|'+events.map(e=>e.ts+':'+(e.detail||'')).join('|');if(key!==lastRenderedEventsKey){lastRenderedEventsKey=key;$('timeline').replaceChildren();if(!events.length){const p=document.createElement('p');p.className='empty';p.textContent='A viagem ainda não começou.';$('timeline').append(p)}for(const [i,e]of events.slice(-12).entries()){const row=document.createElement('div');row.className='event';const circle=document.createElement('div');circle.className='event-icon';circle.textContent=i+1;const body=document.createElement('div');const b=document.createElement('b');b.textContent=e.label;const detail=document.createElement('small');detail.textContent=e.detail||'Percurso';body.append(b,detail);if(e.stopId){const rename=document.createElement('button');rename.className='rename-stop';rename.type='button';rename.textContent='Alterar nome';rename.addEventListener('click',()=>editStopName(e.stopId));body.append(rename)}const time=document.createElement('time');time.textContent=new Date(e.ts).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'});row.append(circle,body,time);$('timeline').append(row)}}gpsState();gate();}
function segments(points){const result=[];let a=[];for(const p of points||[]){if(p.break&&a.length){result.push(a);a=[]}a.push(p)}if(a.length)result.push(a);return result}
function ensureMap(){if(map||!window.maplibregl){if(!window.maplibregl)$('mapFallbackMessage').textContent='A ligação ao mapa falhou. Verifique a internet. O GPS e os valores continuam separados.';return}
 try{map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/bright',center:currentFix?[currentFix.lon,currentFix.lat]:[-8.581,41.767],zoom:16.2,pitch:0,bearing:0,maxPitch:65,attributionControl:false,antialias:false,renderWorldCopies:false,fadeDuration:0,maxTileCacheSize:32});map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');map.on('load',()=>{mapLoaded=true;$('mapBackground').style.display='none';createLayers();updateLiveMap(true);});map.on('error',e=>{if(!mapLoaded)$('mapFallbackMessage').textContent='Mapa indisponível neste momento. Reabra online; o cálculo GPS continua independente.';});for(const ev of ['dragstart','zoomstart','rotatestart','pitchstart'])map.on(ev,e=>{if(e?.originalEvent){following=false;$('followBtn').classList.remove('selected')}});map.on('style.load',()=>{mapLoaded=true;$('mapBackground').style.display='none';createLayers();updateLiveMap(true)});map.on('styledata',()=>{if(map?.isStyleLoaded()&&!map.getSource('recordedRoute'))createLayers()});setTimeout(()=>{if(!mapLoaded)$('mapFallbackMessage').textContent='Mapa temporariamente indisponível. Confirme a internet. O GPS e o cálculo continuam independentes.'},12000)}catch(e){map=null;$('mapFallbackMessage').textContent='Não foi possível iniciar o mapa. Confirme que o Safari ou Chrome estão atualizados.'}}
function createLayers(){if(!map||!map.isStyleLoaded?.()||map.getSource('recordedRoute'))return;try{map.addSource('recordedRoute',{type:'geojson',data:emptyGeo()});map.addSource('plannedRoute',{type:'geojson',data:emptyGeo()});map.addLayer({id:'planned-route-shadow',type:'line',source:'plannedRoute',paint:{'line-color':'#ffffff','line-width':['interpolate',['linear'],['zoom'],10,5,17,17],'line-opacity':.50},layout:{'line-cap':'round','line-join':'round'}});
 map.addLayer({id:'planned-route',type:'line',source:'plannedRoute',paint:{'line-color':'#087BFA','line-width':['interpolate',['linear'],['zoom'],10,3.5,17,10], 'line-opacity':.97},layout:{'line-cap':'round','line-join':'round'}});
 map.addLayer({id:'planned-route-highlight',type:'line',source:'plannedRoute',paint:{'line-color':'#67d5ff','line-width':['interpolate',['linear'],['zoom'],10,1,17,2.4], 'line-opacity':.85},layout:{'line-cap':'round','line-join':'round'}});
 map.addLayer({id:'record-glow',type:'line',source:'recordedRoute',paint:{'line-color':'#e8f8ec','line-blur':5,'line-width':12,'line-opacity':.6},layout:{'line-cap':'round','line-join':'round'}});
 map.addLayer({id:'record-line',type:'line',source:'recordedRoute',paint:{'line-color':'#218052','line-width':5,'line-opacity':1},layout:{'line-cap':'round','line-join':'round'}});
 // Light 3D buildings appear only at close zoom. Fall back to tilted 2D if the chosen map style has no building vector source.
 const existing=map.getStyle()?.layers||[];
 const baseBuilding=existing.find(l=>l['source-layer']==='building'&&l.source);
 const has3D=existing.some(l=>l.type==='fill-extrusion');
 if(baseBuilding&&!has3D&&!map.getLayer('rotameter-buildings3d')){
   map.addLayer({id:'rotameter-buildings3d',type:'fill-extrusion',source:baseBuilding.source,'source-layer':'building',minzoom:15.5,layout:{visibility:threeD?'visible':'none'},paint:{'fill-extrusion-color':'#dadfe3','fill-extrusion-height':['to-number',['get','render_height'],['get','height'],8], 'fill-extrusion-base':['to-number',['get','render_min_height'],['get','min_height'],0],'fill-extrusion-opacity':.55}});
 }
 }catch(e){console.warn('Falha opcional ao criar camadas do mapa',e)}}
function marker(el,loc){return new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([loc.lon,loc.lat]).addTo(map)}
function pinEl(variant){const el=document.createElement('div');el.className='map-pin '+(variant||'');return el}
function applyNavigationCamera(force=false){
 if(!map||!mapLoaded||!currentFix||!following) return;
 const now=Date.now();if(!force&&now-lastCameraAt<1400)return;lastCameraAt=now;
 const height=Math.max(200,map.getContainer().clientHeight||400);
 // Offset keeps the vehicle below center, so upcoming streets occupy more screen space.
 const zoom=map.getZoom();
 const speed=currentFix.speed||0;
 const heading=Number.isFinite(latestHeading)?latestHeading:0;
 const cameraPoint=displayPosition()||currentFix;
 const target={center:[cameraPoint.lon,cameraPoint.lat],bearing:heading,pitch:threeD?48:0,zoom,offset:[0,Math.min(110,height*.17)],duration:force?250:580,essential:true};
 if(!map.isMoving?.() || force)map.easeTo(target);
 else map.jumpTo({...target,duration:0});
}

function updateDriveHUD(){
 const d=$('driveDistance'), title=$('driveStreet'),meter=$('driveMeters'),arr=$('driveArrow'),eta=$('driveEta'),remaining=$('driveRemaining');
 if(!d)return;
 const gpsOk=gpsFresh();
 if(!destination){arr.textContent='↑';meter.textContent=gpsOk?'GPS ATIVO':'GPS A PROCURAR';title.textContent=gpsOk?'Mapa a acompanhar o veículo':'Ative a localização precisa';eta.textContent=trip?'VIAGEM EM CURSO':'PRONTO PARA NAVEGAR';remaining.textContent=trip?fmt(trip.meters/1000)+' km já percorridos':'Introduza um destino para ver a rota';return;}
 if(!previewPath?.length){arr.textContent='⌖';meter.textContent='DESTINO MARCADO';title.textContent=destination.label;eta.textContent='ROTA INDISPONÍVEL';remaining.textContent='O GPS continua a medir o percurso';return;}
 const closest=findRouteProgress();
 const meters=Math.max(0,routeDistanceMeters-closest.along);
 const seconds=Math.max(0,Math.round(routeDurationSeconds*(meters/Math.max(1,routeDistanceMeters))));
 eta.textContent=`${Math.round(seconds/60)} min · ${fmt(meters/1000)} km`;
 remaining.textContent='Previsão por estrada · não integra a cobrança';
}
function findRouteProgress(){
 if(!currentFix||!previewPath?.length)return{along:0,alongIndex:0,offRoute:Infinity};
 let bestDist=Infinity,bestIdx=0,bestAlong=0,bestPoint=null,acc=0;
 for(let i=1;i<previewPath.length;i++){
   const a=previewPath[i-1],b=previewPath[i];
   const mx=(a.lon+b.lon)/2,my=(a.lat+b.lat)/2;
   // Evaluate segment projection in metres; suitable for small road segments.
   const scaleX=111320*Math.cos(currentFix.lat*Math.PI/180),scaleY=111320;
   const x=(currentFix.lon-a.lon)*scaleX,y=(currentFix.lat-a.lat)*scaleY;
   const dx=(b.lon-a.lon)*scaleX,dy=(b.lat-a.lat)*scaleY,len2=dx*dx+dy*dy;
   const t=len2?Math.max(0,Math.min(1,(x*dx+y*dy)/len2)):0;
   const off=Math.hypot(x-t*dx,y-t*dy);const length=hav(a,b);
   if(off<bestDist){bestDist=off;bestIdx=i;bestAlong=acc+length*t;bestPoint={lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t};}acc+=length;
 }
 return {along:routeDistanceMeters*(bestAlong/Math.max(1,acc)),alongIndex:bestIdx,offRoute:bestDist,snapped:bestPoint};
}
function directionText(step){
 if(!step)return 'Siga a estrada indicada';
 const m=step.maneuver||{};const type=m.type||'',mod=m.modifier||'';
 if(type==='arrive')return 'Chegada ao destino';
 if(type==='depart')return 'Inicie pela estrada indicada';
 if(type==='roundabout'||type==='rotary')return 'Entre na rotunda e siga a indicação';
 if(type==='uturn'||mod==='uturn')return 'Faça inversão de marcha, se permitido';
 if(mod.includes('left'))return 'Vire à esquerda'+(step.name?' para '+step.name:'');
 if(mod.includes('right'))return 'Vire à direita'+(step.name?' para '+step.name:'');
 if(type==='merge')return 'Entre na via indicada';
 if(type==='fork')return 'Mantenha-se na via indicada';
 return 'Siga em frente'+(step.name?' na '+step.name:'');
}
// The road-preview snap is VISUAL ONLY; GPS accounting always uses raw, validated fixes.
function displayPosition(){
 if(!currentFix)return null;
 if(!previewPath?.length)return currentFix;
 const projection=findRouteProgress();
 return projection.offRoute<=24 && projection.snapped ? projection.snapped : currentFix;
}
function indexManeuvers(){
 plannedManeuvers=[];
 if(!previewPath?.length)return;
 let from=0;
 for(const step of plannedSteps){
  const loc=step?.maneuver?.location;if(!loc)continue;
  let best=Infinity,idx=from;
  const point={lat:loc[1],lon:loc[0]};
  for(let i=from;i<previewPath.length;i++){
   const d=hav(previewPath[i],point);
   if(d<best){best=d;idx=i;}
   if(d<9)break;
  }
  from=Math.max(from,idx);
  plannedManeuvers.push({step,idx});
 }
}
function updateGuidance(){
 const panel=$('navGuidance');if(!panel)return;
 if(!destination||!previewPath?.length){panel.hidden=true;updateDriveHUD();return}
 panel.hidden=false;
 if(!currentFix){$('navInstruction').textContent='Rota planeada';$('navDistance').textContent='GPS ainda indisponível';updateDriveHUD();return;}
 const progress=findRouteProgress();
 // Determine the next OSRM maneuver after the current map-matched position.
 let chosen=null,dist=Infinity;
 for(const entry of plannedManeuvers){
  if(entry.idx+2<progress.alongIndex)continue;
  const loc=entry.step.maneuver.location;
  chosen=entry.step;dist=hav(currentFix,{lat:loc[1],lon:loc[0]});break;
 }
 if(!chosen&&plannedManeuvers.length){chosen=plannedManeuvers[plannedManeuvers.length-1].step;dist=hav(currentFix,{lat:destination.lat,lon:destination.lon});}
 const word=directionText(chosen);
 const modifier=chosen?.maneuver?.modifier||'';
 const arrow=modifier.includes('left')?'↰':modifier.includes('right')?'↱':chosen?.maneuver?.type==='arrive'?'◆':'↑';
 const distanceLabel=Number.isFinite(dist)?(dist<1000?Math.max(0,Math.round(dist/10)*10)+' m':fmt(dist/1000)+' km'):'—';
 $('navInstruction').textContent=word;
 $('navArrow').textContent=arrow;
 $('navDistance').textContent=distanceLabel+' até à indicação · prévia experimental';
 $('driveArrow').textContent=arrow;
 $('driveMeters').textContent=distanceLabel;
 $('driveStreet').textContent=word;
 updateDriveHUD();
 if(progress.offRoute>80){$('driveStreet').textContent='Fora da rota sugerida · confirme o caminho';}
}
function updateLiveMap(force=false){if(!map||!mapLoaded||!currentFix)return;const now=Date.now();if(!force&&now-lastUiMap<1200){if(vehicleMarker){const p=displayPosition()||currentFix;vehicleMarker.setLngLat([p.lon,p.lat]);}if(following)applyNavigationCamera();updateGuidance();return;}lastUiMap=now;const source=trip||lastResult,coords=source?.route||[];try{const rec=map.getSource('recordedRoute');if(rec)rec.setData(lineGeo(segments(coords)));const plan=map.getSource('plannedRoute');if(plan)plan.setData(previewPath?lineGeo([previewPath]):emptyGeo());if(!vehicleMarker){const el=document.createElement('div');el.className='vehicle-marker';el.setAttribute('role','img');el.setAttribute('aria-label',mode==='mota'?'Veículo (mota) no mapa':'Carro premium na localização GPS');const img=document.createElement('img');img.src=mode==='mota'?'./mota-premium.svg?v=8.1':'./carro-premium.svg?v=8.1';img.alt='';img.draggable=false;el.append(img);vehicleMarker=marker(el,displayPosition()||currentFix)}else {const p=displayPosition()||currentFix;vehicleMarker.setLngLat([p.lon,p.lat]);}const img=vehicleMarker.getElement().querySelector('img');if(img){const desired=(trip?.vehicle||mode)==='mota'?'./mota-premium.svg?v=8.1':'./carro-premium.svg?v=8.1';if(lastKnownVehicleAsset!==desired){img.src=desired;lastKnownVehicleAsset=desired;}img.style.transform='rotate('+(latestHeading-map.getBearing())+'deg)'};const signature=source?`${source.id||source.startedAt||''}|${source.pickup?.ts||0}|${source.stops?.length||0}`:'none';
 if(signature!==lastMarkersSignature){
  for(const m of eventMarkers)m.remove();eventMarkers=[];lastMarkersSignature=signature;
  if(source){const start=coords[0];if(start)eventMarkers.push(marker(pinEl(''),start));
   if(source.pickup)eventMarkers.push(marker(pinEl('pickup'),source.pickup));
   for(const st of source.stops||[]){const m=marker(pinEl('stop'),st);m.setPopup(new maplibregl.Popup({offset:14}).setText(labelStop(st)+' · '+clock(st.durationMs||0)));eventMarkers.push(m)}}
 }
 if(destination){if(!destinationMarker)destinationMarker=marker(pinEl('destination'),destination);else destinationMarker.setLngLat([destination.lon,destination.lat])}else{destinationMarker?.remove();destinationMarker=null}
 if(following)applyNavigationCamera(force);updateGuidance();
 }catch(e){console.warn('Map update',e)}}
async function searchDestination(evt){evt.preventDefault();const q=$('destinationInput').value.trim();if(q.length<3){setMessage('Escreva pelo menos 3 letras para pesquisar destino.',true);return}const results=$('destinationResults');results.hidden=false;results.textContent='A pesquisar moradas…';try{const url='https://photon.komoot.io/api/?q='+encodeURIComponent(q)+ '&limit=5&lang=pt';const res=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('Pesquisa indisponível');const data=await res.json();results.replaceChildren();const features=data.features||[];if(!features.length){results.textContent='Sem resultados. Tente outra localidade.';return}for(const f of features){const p=f.properties||{},name=[p.name,p.street,p.city,p.state,p.country].filter(Boolean).join(' · ');const b=document.createElement('button');b.className='result-item';b.type='button';b.textContent=name||'Localização';b.addEventListener('click',()=>selectDestination(f));results.append(b)}}catch(e){results.textContent='Pesquisa temporariamente indisponível. O acompanhamento GPS continua disponível.'}}
async function selectDestination(f){const [lon,lat]=f.geometry.coordinates;destination={lat,lon,label:[f.properties?.name,f.properties?.city].filter(Boolean).join(', ')};previewPath=null;plannedSteps=[];plannedManeuvers=[];$('destinationResults').hidden=true;$('destinationInput').value=destination.label;$('routeEstimate').hidden=false;$('routeEstimateText').textContent='A calcular prévia do caminho…';if(!currentFix){$('routeEstimateText').textContent='Destino marcado · GPS ainda indisponível';return}const req=++routeRequest;try{const url=`https://router.project-osrm.org/route/v1/driving/${currentFix.lon},${currentFix.lat};${lon},${lat}?overview=full&geometries=geojson&steps=true`;const res=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error();const data=await res.json();if(req!==routeRequest)return;const route=data.routes?.[0];if(!route)throw Error();previewPath=route.geometry.coordinates.map(c=>({lon:c[0],lat:c[1]}));plannedSteps=(route.legs||[]).flatMap(l=>l.steps||[]);indexManeuvers();syncNativeVoiceRoute();routeDistanceMeters=route.distance;routeDurationSeconds=route.duration;$('routeEstimateText').textContent=`Prévia por estrada: ${fmt(route.distance/1000)} km · ${Math.round(route.duration/60)} min (não cobrada)`;}catch{$('routeEstimateText').textContent='Destino marcado · prévia de rota indisponível'}updateLiveMap(true);updateGuidance();if(map&&destination&&!following){map.easeTo({center:[lon,lat],zoom:13,duration:600})}}
function clearDestination(){routeRequest++;if(isNativeContainer)nativeCommand('navigation-voice-clear');previewPath=null;plannedSteps=[];plannedManeuvers=[];destination=null;updateGuidance();$('destinationInput').value='';$('routeEstimate').hidden=true;updateLiveMap(true)}
function initControls(){const on=(id,fn)=>$(id).addEventListener('click',fn);on('grantGpsBtn',startGps);on('retryGpsBtn',startGps);on('startBtn',startTrip);on('pauseBtn',pauseTrip);on('stopBtn',()=>markStop(false));on('pickupBtn',markPickup);on('finishBtn',finishTrip);on('voiceBtn',()=>speech('Partida. Chegámos.'));on('modeBtn',()=>{if(trip)return;mode=mode==='carro'?'mota':'carro';rates=read(ratesKey(mode),DEFAULT_PROFILES[mode]);if(!validRates(rates))rates={...DEFAULT_PROFILES[mode]};$('modeBtn').innerHTML=(mode==='carro'?'Carro':'Mota')+' <span>⌄</span>';render()});on('followBtn',()=>{following=true;$('followBtn').classList.add('selected');applyNavigationCamera(true);updateLiveMap(true)});on('viewBtn',()=>{threeD=!threeD;$('viewBtn').textContent=threeD?'2D':'3D';if(map){if(map.getLayer('rotameter-buildings3d'))map.setLayoutProperty('rotameter-buildings3d','visibility',threeD?'visible':'none');map.easeTo({pitch:threeD?48:0,bearing:latestHeading,duration:550})}updateLiveMap(true)});on('mapStyleBtn',()=>{mapStyleVariant=mapStyleVariant==='liberty'?'bright':'liberty';if(map){mapLoaded=false;map.setStyle('https://tiles.openfreemap.org/styles/'+mapStyleVariant);$('mapBackground').style.display='flex';$('mapFallbackMessage').textContent='A carregar cartografia clara…';} });on('overviewBtn',()=>{following=false;$('followBtn').classList.remove('selected');if(!map)return;const arr=previewPath?.length?previewPath:(trip?.route||[]);if(arr.length>1){const b=new maplibregl.LngLatBounds();for(const p of arr)b.extend([p.lon,p.lat]);map.fitBounds(b,{padding:60,maxZoom:15,pitch:0,bearing:0,duration:650});}else if(currentFix)map.easeTo({center:[currentFix.lon,currentFix.lat],zoom:13.5,pitch:0,bearing:0,duration:650});});on('zoomIn',()=>map?.zoomIn({duration:250}));on('zoomOut',()=>map?.zoomOut({duration:250}));$('destinationForm').addEventListener('submit',searchDestination);on('clearDestination',clearDestination);on('closeFinishBtn',()=>closeDialog('finishDialog'));on('newTripBtn',()=>{closeDialog('finishDialog');lastResult=null;afterFinish=false;render();updateLiveMap(true);if(!gpsFresh())startGps()});on('downloadPdfBtn',()=>{if(lastResult)downloadPdf(lastResult)});on('downloadGpxBtn',()=>{if(lastResult)exportGpx(lastResult)});on('sharePdfBtn',()=>{if(lastResult)sharePdf(lastResult)});on('settingsBtn',()=>{for(const k of ['base','km','wait','extra'])$('ratesForm').elements[k].value=rates[k];$('settingsDialog').showModal()});on('closeSettings',()=>closeDialog('settingsDialog'));$('ratesForm').addEventListener('submit',e=>{e.preventDefault();if(trip)return;const r=Object.fromEntries(['base','km','wait','extra'].map(k=>[k,Number(e.target.elements[k].value)]));if(!validRates(r))return alert('Verifique os valores da configuração.');rates=r;store(ratesKey(mode),rates);closeDialog('settingsDialog');render()});on('historyBtn',()=>showHistory());on('closeHistory',()=>closeDialog('historyDialog'));on('clearHistory',()=>{if(confirm('Apagar histórico de viagens deste aparelho?')){history=[];store(KEY_HISTORY,history);showHistory(true)}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&trip?.state==='running'){store(KEY_SESSION,trip);return;}if(!document.hidden){if(isNativeContainer){nativeCommand('tracking-sync');if(!gpsFresh())startGps();}else{if(trip?.state==='running'&&!gpsFresh())markGpsLost();if(!gpsFresh())startGps();}if(map)map.resize();render()}});window.addEventListener('pagehide',()=>{if(trip)store(KEY_SESSION,trip)});
 window.addEventListener('freeze',()=>{if(trip)store(KEY_SESSION,trip)});window.addEventListener('resize',()=>{if(map)setTimeout(()=>map.resize(),100)});}
function showHistory(refresh=false){const el=$('historyList');el.replaceChildren();if(!history.length){const p=document.createElement('p');p.className='empty';p.textContent='Nenhuma viagem concluída.';el.append(p)}for(const h of history){const row=document.createElement('div');row.className='history-item';const txt=document.createElement('div');const b=document.createElement('strong');b.textContent=date(h.startedAt)+' · '+money(h.total);const small=document.createElement('small');small.textContent=fmt(h.meters/1000)+' km · '+(h.vehicle==='mota'?'Mota':'Carro')+' · '+h.stops.length+' paragens';txt.append(b,small);const names=document.createElement('button');names.type='button';names.textContent='Paragens';names.addEventListener('click',()=>{for(const st of h.stops||[]){const n=prompt('Nome da paragem:',st.name||st.candidateName||'');if(n?.trim())st.name=n.trim().slice(0,90)}store(KEY_HISTORY,history);showHistory(true)});
 const btn=document.createElement('button');btn.type='button';btn.textContent='PDF';btn.addEventListener('click',()=>downloadPdf(h));row.append(txt,names,btn);el.append(row)}if(!refresh)$('historyDialog').showModal()}
function tick(){if(trip?.state==='running')billTime();if(currentFix&&!gpsFresh()&&gpsPermission==='granted'){gpsPermission='unavailable';if(trip?.state==='running')markGpsLost();setMessage('Sem atualização GPS. Não está a contar quilómetros.',true)}if(trip)persist();render()}
function exportGpx(t){if(!t?.route?.length){alert('Esta viagem não possui pontos GPS.');return;}
 const xmlEscape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const trk=segments(t.route).map(seg=>'<trkseg>'+seg.map(p=>`<trkpt lat="${p.lat}" lon="${p.lon}"><time>${new Date(p.ts).toISOString()}</time></trkpt>`).join('')+'</trkseg>').join('');
 const wpts=(t.stops||[]).map(p=>`<wpt lat="${p.lat}" lon="${p.lon}"><name>${xmlEscape(labelStop(p))}</name></wpt>`).join('');
 const xml='<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="RotaMeter" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Viagem '+xmlEscape(t.id)+'</name>'+trk+'</trk>'+wpts+'</gpx>';
 const url=URL.createObjectURL(new Blob([xml],{type:'application/gpx+xml'}));const a=document.createElement('a');a.href=url;a.download='RotaMeter_'+t.id+'.gpx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function pdfName(t){return'RotaMeter_Relatorio_'+t.id+'.pdf'}
async function downloadPdf(t){try{const blob=await window.RotaMeterPremiumPdf.create(t),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=pdfName(t);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}catch(e){alert('PDF com mapa real não gerado: '+e.message)}}
async function sharePdf(t){try{const blob=await window.RotaMeterPremiumPdf.create(t),file=new File([blob],pdfName(t),{type:'application/pdf'});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'Relatório RotaMeter PRO',text:'Estimativa detalhada do percurso GPS.'})}else{downloadPdf(t);alert('O PDF foi descarregado. Abra os Ficheiros para o enviar por WhatsApp, email ou outro meio.')}}catch(e){if(e.name!=='AbortError')alert('Não foi possível gerar ou partilhar o PDF com mapa real. Verifique a internet e tente novamente.')}}
restore();initControls();render();startGps();if(isNativeContainer)nativeCommand('tracking-sync');setInterval(tick,1000);setTimeout(()=>{ensureMap()},500);window.RotaMeterVersion=APP_BUILD;window.RotaMeterTest={estimate,validateFix,hav,bearing,receiveFix,finishTrip,exportGpx,closeLeg,finishStop,markPickup,editStopName,get state(){return{trip,history,currentFix,gpsPermission,mapLoaded}},startTrip,pauseTrip,markStop,markPickup,showFinish};
})();
