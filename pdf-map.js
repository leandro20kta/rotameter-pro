/* RotaMeter V12.1: cartografia REAL obrigatória na exportação normal.
 * Ao falhar a rede de mapas, NÃO substitui estradas por grelha fictícia.
 * O ajuste à via é opcional e nunca altera a distância ou o preço medidos por GPS.
 */
(()=>{'use strict';
const money=x=>'EUR '+Number(x||0).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});
const km=x=>Number(x||0).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' km';
const time=x=>{const n=Math.floor((x||0)/1000);return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(v=>String(v).padStart(2,'0')).join(':')};
const date=ts=>new Date(ts).toLocaleString('pt-PT',{dateStyle:'short',timeStyle:'short'});
const clean=s=>String(s??'').replace(/[\u2014\u2013]/g,'-').replace(/€/g,'EUR ').replace(/[\u2018\u2019]/g,"'");
function boundsFrom(points){let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;for(const p of points){if(!Number.isFinite(p?.lat)||!Number.isFinite(p?.lon))continue;west=Math.min(west,p.lon);east=Math.max(east,p.lon);south=Math.min(south,p.lat);north=Math.max(north,p.lat)}return [west,south,east,north]}
function traceSegments(points){return window.RotaRoad?.splitTrace(points)||[];}
function geoBounds(t){const coords=[...(t.route||[]),...(t.stops||[])];return boundsFrom(coords)}
function networkConsent(){
 const key='rm_road_adjust_consent_v1';
 try{
  const old=localStorage.getItem(key);if(old==='yes')return true;if(old==='no')return false;
  const answer=window.confirm('Ajustar a linha do GPS às ruas no PDF? Isto envia posições GPS para um serviço externo de mapas (OSRM de demonstração). O percurso ajustado é uma aproximação e NÃO muda a distância nem o valor cobrado. Autorizar?');
  localStorage.setItem(key,answer?'yes':'no');return answer;
 }catch{return false}
}
function overlay(ctx,t,project,{width=1200,height=750,matched=[]}={}){
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 // Never join an interrupted GPS trace; matching output is a visual overlay ONLY.
 function line(coordinates,color,weight,dash=[]){if(coordinates.length<2)return;const pts=coordinates.map(([lon,lat])=>project({lon,lat})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(pts.length<2)return;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='rgba(255,255,255,.94)';ctx.lineWidth=weight+5;ctx.setLineDash([]);ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([])}
 const matchedTracks=matched.filter(x=>x.kind==='matched');
 // Original observed GPS trace is visible in green; road-snapped estimate is in blue.
 for(const seg of traceSegments(t.route||[]))line(seg.map(p=>[p.lon,p.lat]),matchedTracks.length?'#239767':'#1460bd',matchedTracks.length?2.5:5);
 for(const m of matchedTracks)line(m.coordinates,'#086fff',6);
 const valid=(t.route||[]).filter(p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon));
 if(valid.length){
  const first=valid[0],last=valid[valid.length-1];
  const markers=[{...first,label:'Partida',code:'A',color:'#182a3a'},
   ...(t.stops||[]).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)).map((s,i)=>({...s,label:String(s.name||s.candidateName||'Paragem').slice(0,21),code:String(i+1),color:'#c17d22'})),
   {...last,label:'Chegada',code:'B',color:'#188365'}];
  for(const m of markers){const xy=project(m);if(!Number.isFinite(xy.x)||!Number.isFinite(xy.y))continue;
   const x=Math.min(width-15,Math.max(15,xy.x)),y=Math.min(height-15,Math.max(15,xy.y));
   ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fillStyle=m.color;ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 12px Arial';ctx.fillText(m.code,x,y);
   const text=m.label+(m.durationMs?` (${Math.round(m.durationMs/60000)} min)`:'');
   ctx.font='bold 17px Arial';const w=Math.min(330,ctx.measureText(text).width+23);const tx=Math.max(10,Math.min(width-w-10,x+18)),ty=Math.max(10,Math.min(height-40,y-24));ctx.fillStyle='rgba(255,255,255,.97)';ctx.fillRect(tx,ty,w,32);ctx.fillStyle='#21303d';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(text.slice(0,28),tx+10,ty+16);
  }
 }
 ctx.fillStyle='rgba(255,255,255,.96)';ctx.fillRect(14,height-78,width-28,65);ctx.fillStyle='#142635';ctx.font='bold 18px Arial';ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText(matchedTracks.length?'Azul: trajeto ajustado às estradas (aproximação)  |  Verde: GPS observado':'Azul: registo GPS observado  |  Sem traçado rodoviário estimado',28,height-56);
 ctx.font='15px Arial';ctx.fillText('Os intervalos sem GPS NÃO são ligados. © OpenFreeMap / OpenMapTiles · Dados © OpenStreetMap',28,height-31);
 ctx.restore();
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function waitEvent(map,name,timeout){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{map.off(name,on);reject(Error('Tempo excedido a carregar mapa de ruas'))},timeout);function on(){clearTimeout(timer);resolve()}map.once(name,on)})}
async function captureRouteMap(t,matchAllowed=false){
 if(!window.maplibregl)throw Error('O motor de mapas ainda não carregou. Ligue a internet e tente novamente.');
 const points=(t.route||[]).filter(x=>Number.isFinite(x?.lat)&&Number.isFinite(x?.lon));if(!points.length)throw Error('A viagem não contém pontos GPS para desenhar um mapa real.');
 const width=1200,height=750;const box=document.createElement('div');box.style.cssText=`position:fixed;left:-20000px;top:0;width:${width}px;height:${height}px;pointer-events:none;visibility:visible;opacity:1;z-index:-1;`;
 document.body.append(box);let map=null;
 try{
  map=new maplibregl.Map({container:box,style:'https://tiles.openfreemap.org/styles/bright',center:[points[0].lon,points[0].lat],zoom:15,pitch:0,bearing:0,interactive:false,attributionControl:false,preserveDrawingBuffer:true,antialias:false,fadeDuration:0,renderWorldCopies:false,maxTileCacheSize:24});
  if(!map.loaded())await waitEvent(map,'load',20000);
  const b=geoBounds(t);
  if(Number.isFinite(b[0])){
   if(Math.abs(b[2]-b[0])+Math.abs(b[3]-b[1])<.0002)map.setZoom(16);
   else map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:{top:75,bottom:116,left:90,right:90},maxZoom:17,duration:0});
  }
  // MapLibre's idle fires once all current camera tiles have arrived.
  let loaded=false;for(let tries=0;tries<64;tries++){if(map.areTilesLoaded?.()&&map.isStyleLoaded?.()){loaded=true;break;}await sleep(250)}
  if(!loaded)throw Error('As ruas não carregaram completamente. Verifique a internet e tente gerar novamente.');
  await sleep(250);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Erro na captura do mapa.');
  ctx.drawImage(map.getCanvas(),0,0,width,height);
  // Reject blank canvases: an empty placeholder must never masquerade as a real map.
  const data=ctx.getImageData(0,0,width,height).data;const unique=new Set();for(let yy=30;yy<height-90;yy+=28)for(let xx=30;xx<width-30;xx+=28){const k=(yy*width+xx)*4;unique.add((data[k]>>4)*256+(data[k+1]>>4)*16+(data[k+2]>>4))}
  if(unique.size<16)throw Error('A captura do mapa ficou vazia. Reabra online e tente novamente.');
  let matches=[];
  if(matchAllowed&&window.RotaRoad?.matchTrace){try{matches=await window.RotaRoad.matchTrace(t.route||[],{timeout:8000,maxRequests:5});}catch{matches=[]}}
  overlay(ctx,t,p=>{const v=map.project([p.lon,p.lat]);return{x:v.x,y:v.y}},{width,height,matched:matches});
  return {image:canvas.toDataURL('image/jpeg',.88),matched:matches.some(x=>x.kind==='matched')};
 }finally{try{map?.remove()}catch{}box.remove();}
}
async function create(t){if(!window.jspdf?.jsPDF)throw Error('O gerador PDF ainda não carregou. Verifique a internet.');
 const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 const gray=[95,103,115],black=[20,23,29],navy=[27,32,40];
 let y=20,pageNo=0;
 function header(section='RELATÓRIO DE VIAGEM'){
   pageNo++;doc.setFillColor(...navy);doc.rect(0,0,210,29,'F');doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.setFontSize(18);doc.text('RotaMeter PRO',15,17);doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text(section,195,17,{align:'right'});doc.setTextColor(...black);y=41;
 }
 function foot(){doc.setTextColor(...gray);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Estimativa pessoal • Não é taxímetro homologado, fatura ou recibo fiscal',15,287);doc.text(String(pageNo),195,287,{align:'right'})}
 function row(label,value){if(y>275){foot();doc.addPage();header('DETALHE DO PERCURSO')}doc.setDrawColor(231,234,238);doc.line(16,y+2,194,y+2);y+=8;doc.setFontSize(9);doc.setTextColor(...gray);doc.text(clean(label).slice(0,55),17,y);doc.setFont('helvetica','bold');doc.setTextColor(...black);doc.text(clean(value).slice(0,38),193,y,{align:'right'});doc.setFont('helvetica','normal');y+=5}
 function title(text){if(y>260){foot();doc.addPage();header('DETALHE DO PERCURSO')}doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...black);doc.text(clean(text),16,y);y+=8;doc.setFont('helvetica','normal')}
 header();doc.setFont('helvetica','bold');doc.setFontSize(24);doc.text(money(t.total),16,y+4);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(...gray);doc.text('Total estimado da viagem | '+(t.vehicle==='mota'?'Mota':'Carro'),16,y+12);y+=24;
 const consent=networkConsent();
 const mapResult=await captureRouteMap(t,consent);
 title('Informações gerais');row('Identificador',t.id);row('Partida',date(t.startedAt));row('Chegada',date(t.endedAt));row('Distância GPS',km((t.meters||0)/1000));row('Duração contabilizada',time(t.elapsedMs));row('Tempo de espera',time(t.waitMs));row('Interrupções GPS',String(t.gaps||0));
 title('Composição da estimativa');const r=t.rates||{},base=Number(r.base||0),extra=Number(r.extra||0);row('Início',money(base));row('Distância',money((t.meters||0)/1000*Number(r.km||0)));row('Espera',money((t.waitMs||0)/60000*Number(r.wait||0)));row('Adicional',money(extra));row('Total',money(t.total));
 foot();
 doc.addPage('a4','landscape');pageNo++;
 doc.setFillColor(...navy);doc.rect(0,0,297,22,'F');doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.setFontSize(15);doc.text('RotaMeter PRO  |  MAPA REAL DO PERCURSO',15,14);
 doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('GPS registado e paragens · © OpenFreeMap / OpenMapTiles · Dados © OpenStreetMap',16,29);
 doc.addImage(mapResult.image,'JPEG',15,33,267,166,'mapa-ruas', 'FAST');
 doc.setTextColor(...gray);doc.setFontSize(7.5);doc.text(mapResult.matched?'Linha azul = ajuste provável às estradas; verde = GPS efetivamente observado. O ajuste não é usado na cobrança.':'Linha azul = percurso GPS efetivamente observado, sem interpolação dos trechos com falha de sinal.',15,204);
 doc.addPage('a4','portrait');header('ETAPAS E PARAGENS');title('Percurso por etapas');
 for(const [i,leg] of (t.legs||[]).entries()){if(y>245){foot();doc.addPage();header('ETAPAS E PARAGENS')}
  doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text(clean((i+1)+'. '+leg.from+' → '+leg.to).slice(0,75),16,y);y+=3;doc.setFont('helvetica','normal');row('Distância / duração',km((leg.meters||0)/1000)+'  |  '+time(leg.elapsedMs));row('Espera',time(leg.waitMs));row('Subtotal da etapa',money(leg.cost));y+=7;
 }
 title('Paragens');if(!(t.stops||[]).length){doc.setFontSize(9);doc.text('Sem paragens registadas',17,y);y+=10;}
 for(const [i,st] of (t.stops||[]).entries()){if(y>245){foot();doc.addPage();header('ETAPAS E PARAGENS')}
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(clean('Paragem '+(i+1)+': '+(st.name||(st.candidateName?'Possível '+st.candidateName+' (não confirmado)':'Local não identificado'))).slice(0,65),16,y);doc.setFont('helvetica','normal');y+=3;
  row('Hora da chegada',date(st.ts));row('Permanência',time(st.durationMs||0));row('Espera estimada nesta paragem',money(st.cost||0));row('Coordenadas',Number(st.lat).toFixed(5)+', '+Number(st.lon).toFixed(5));y+=7;
 }
 title('Notas sobre a medição');doc.setFontSize(9);doc.setTextColor(...gray);
 const lines=doc.splitTextToSize(clean('O valor não corresponde a uma tarifa legalmente homologada. A distância é medida apenas através de posições GPS aceites; a rota planeada não é incluída no preço. Pontos sem GPS, suspensão do navegador e obstáculos podem reduzir a distância registada. Nomes de locais dependem de dados cartográficos ou de correção manual.'),176);
 for(const ln of lines){if(y>270){foot();doc.addPage();header('NOTAS')}doc.text(ln,17,y);y+=5;}
 foot();return doc.output('blob');
}
window.RotaMeterPremiumPdf={create,captureRouteMap};
})();
