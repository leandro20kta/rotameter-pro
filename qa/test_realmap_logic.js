const assert=require('node:assert/strict');
const road=require('../web/route-geometry');
(async()=>{
 const gps=(lat,lon,ts,other={})=>({lat,lon,ts,accuracy:6,...other});
 const pts=[gps(41.77,-8.58,1000),gps(41.77004,-8.5799,2000),gps(41.77005,-8.5798,3000),gps(41.78,-8.6,4000,{break:true}),gps(41.7801,-8.5999,5000)];
 const seg=road.splitTrace(pts);assert.equal(seg.length,2);assert.equal(seg[0].length,3);assert.equal(seg[1].length,2);
 assert.equal(road.splitTrace([gps(41.77,-8.58,1000),gps(41.8,-8.6,2000)]).length,2,'do not link far points');
 assert.equal(road.splitTrace([gps(41.77,-8.58,1000),gps(41.7701,-8.5799,180000)]).length,1,'stationary nearby points can join');
 assert.equal(road.splitTrace([gps(41.77,-8.58,1000),gps(41.7703,-8.5799,180000)]).length,2,'do not link missing time');
 const fakeFetch=async url=>({ok:true,json:async()=>({code:'Ok',matchings:[{confidence:0.96,geometry:{type:'LineString',coordinates:[[-8.58,41.77],[-8.57998,41.77005],[-8.5798,41.77005]]}}]})});
 const matched=await road.matchTrace(seg[0],{fetchImpl:fakeFetch});assert.equal(matched[0].kind,'matched');assert.equal(matched[0].coordinates.length,3);
 const bad=await road.matchTrace(seg[0],{fetchImpl:async()=>({ok:true,json:async()=>({code:'Ok',matchings:[{confidence:0.1,geometry:{type:'LineString',coordinates:[[1,1],[2,2]]}}]})})});assert.equal(bad[0].kind,'gps');
 console.log('PASS: breaks, sparse-fix protection, OSRM matching and fallback, no route interpolated over gaps');
})();
