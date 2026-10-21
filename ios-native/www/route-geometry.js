/* RotaMeter PRO - track processing and optional road map-matching.
 * Raw GPS data are retained unchanged; map matching never affects meters, prices, or time.
 * Public OSRM is for small beta tests only; commercial use needs a contracted/self-hosted endpoint.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RotaRoad=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const rad=Math.PI/180;
function distance(a,b){const q=(b.lat-a.lat)*rad,r=(b.lon-a.lon)*rad;const v=Math.sin(q/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(r/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.max(0,v))))}
function valid(p){return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;}
function splitTrace(points,limitGapMs=90000){const out=[];let run=[];let prev=null;for(const p of points||[]){if(!valid(p))continue;const time=Number(p.ts??p.t);const oldTime=prev?Number(prev.ts??prev.t):NaN;const delta=prev?distance(p,prev):0;const temporalGap=Number.isFinite(time)&&Number.isFinite(oldTime)&&time-oldTime>limitGapMs&&delta>28;
 const sparseGap=prev&&delta>100; // Two samples >100 m apart are NOT enough evidence for the connecting road.
 // A GPS break is absolute: never draw a segment across it.
 if((p.break||temporalGap||sparseGap)&&run.length){out.push(run);run=[];}
 if(!prev||distance(p,prev)>.45||p.break){run.push({...p});}
 prev=p;
}if(run.length)out.push(run);return out;}
function toCoords(segment){return segment.map(p=>[p.lon,p.lat]);}
function splitChunks(segment,size=65){if(segment.length<=size)return [segment];const chunks=[];for(let i=0;i<segment.length-1;i+=size-1){chunks.push(segment.slice(i,i+size));}return chunks;}
function matchingUrl(points,base='https://router.project-osrm.org'){const coords=points.map(p=>`${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');const radiuses=points.map(p=>Math.max(5,Math.min(35,Math.ceil((Number(p.accuracy)||10)*1.4)))).join(';');return `${base}/match/v1/driving/${coords}?overview=full&geometries=geojson&steps=false&gaps=split&tidy=true&radiuses=${radiuses}`;}
function geometryToFeatures(data){return (data?.matchings||[]).filter(m=>Number(m.confidence)>=.72&&m.geometry?.type==='LineString'&&m.geometry.coordinates.length>=2).map(m=>({confidence:m.confidence,coordinates:m.geometry.coordinates}));}
function trimBadMatches(features,original){if(!features.length)return [];
 const raw=original.reduce((s,p,i)=>i?s+distance(original[i-1],p):s,0);
 const matched=features.reduce((s,f)=>s+f.coordinates.reduce((total,c,i,a)=>i?total+distance({lon:a[i-1][0],lat:a[i-1][1]},{lon:c[0],lat:c[1]}):total,0),0);
 // Reject loops far longer than the measured trace; curves are fine but huge detours are not.
 return raw>10&&matched>Math.max(250,raw*2.8)?[]:features;
}
async function matchSegment(seg,{fetchImpl=fetch,endpoint='https://router.project-osrm.org',timeout=10000,maxRequests=6}={}){
 if(seg.length<3)return [];
 const chunks=splitChunks(seg,65);if(chunks.length>maxRequests)return [];
 const result=[];
 for(const ch of chunks){const controller=new AbortController();const to=setTimeout(()=>controller.abort(),timeout);
 try{const res=await fetchImpl(matchingUrl(ch,endpoint),{signal:controller.signal});if(!res.ok)throw Error('OSRM offline');const json=await res.json();if(json.code!=='Ok')throw Error('OSRM no match');const matches=trimBadMatches(geometryToFeatures(json),ch);if(!matches.length)return [];result.push(...matches);}catch{return [];}finally{clearTimeout(to);}
 }
 return result;
}
async function matchTrace(points,options={}){const raw=splitTrace(points),matched=[];let used=0;
 for(const s of raw){if(s.length<3||used>=8){matched.push({kind:'gps',coordinates:toCoords(s)});continue;}
 used++;const res=await matchSegment(s,options);
 if(res.length){for(const m of res)matched.push({kind:'matched',confidence:m.confidence,coordinates:m.coordinates});}
 else matched.push({kind:'gps',coordinates:toCoords(s)});
 }
 return matched.filter(x=>x.coordinates.length>=2);
}
return {valid,distance,splitTrace,toCoords,matchingUrl,geometryToFeatures,trimBadMatches,matchSegment,matchTrace};
});
