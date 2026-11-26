// Average value gained per meter spent: skills vs Final Smash. value = HP swing + lingering effects (meter excluded).
const fs=require('fs');
const E=require('../src/engine'),AI=require('../src/ai'),Fm=require('../src/fighters');
const ov=JSON.parse(fs.readFileSync(process.argv[2]||'overrides.json'));if(ov._rules)Object.assign(E.RULES,ov._rules);if(ov._fs)Object.assign(Fm.FSN,ov._fs);for(const k in ov)if(k[0]!=='_')Object.assign(Fm.N[k],ov[k]);
const F=Fm.FIGHTERS;
function sc(p,o,g){let s=p.hp+0.8*p.charge-0.8*p.weaken;for(const b of p.burns)s-=b.x*b.left;
 if(E.active(p,'stagger',g.T))s-=3;if(E.active(p,'paralyze',g.T))s-=2;if(E.active(p,'lock',g.T))s-=4;
 const ar=E.active(p,'armor',g.T);if(ar)s+=0.8*ar.v*(ar.until-g.T+1);if(p.f.potential)s+=p.f.potential(p,g);return s;}
const acc={basic:[0,0,0],skill:[0,0,0],fs:[0,0,0],dodge:[0,0,0]};let fsN=0,dodged=0; // sumDelta, sumCost, count
const per={};
for(let i=0;i<F.length;i++)for(let k=0;k<+(process.argv[3]||12);k++){const j=(i*13+k*7+1)%F.length;if(j===i)continue;
 const g=E.newGame(F[i],F[j],i*1009+k*31+7);
 while(!g.over){const a=AI.chooseActions(g);
  const before=[0,1].map(x=>sc(g.p[x],g.p[1-x],g)-sc(g.p[1-x],g.p[x],g));
  const cost=[0,1].map(x=>a[x].kind==='skill'?E.skillCost(g,g.p[x],g.p[1-x]):a[x].kind==='fs'?g.p[x].meter:0);
  const ev=[];g.events=ev;E.resolve(g,a);g.events=null;fsN+=a.filter(x=>x.kind==='fs').length;dodged+=ev.filter(e=>/dodged .*!/.test(e)).length;
  for(const x of [0,1]){let after=g.over?(g.winner===x?1:-1)*Math.abs(g.p[1-x].hp-g.p[x].hp)+(sc(g.p[x],g.p[1-x],g)-sc(g.p[1-x],g.p[x],g))*0:sc(g.p[x],g.p[1-x],g)-sc(g.p[1-x],g.p[x],g);
   if(g.over) after=(g.p[x].hp-g.p[1-x].hp);
   const d=after-before[x],A=acc[a[x].kind];A[0]+=d;A[1]+=cost[x];A[2]++;
   if(a[x].kind==='skill'){const id=g.p[x].f.id;per[id]=per[id]||[0,0,0];per[id][0]+=d;per[id][1]+=cost[x];per[id][2]++;}}}}
const base=acc.basic[0]/acc.basic[2];
const sk=(acc.skill[0]-base*acc.skill[2])/acc.skill[1], f=(acc.fs[0]-base*acc.fs[2])/acc.fs[1];
const tot=acc.basic[2]+acc.skill[2]+acc.fs[2]+acc.dodge[2];
console.log(JSON.stringify({perMeter_skill:+sk.toFixed(2),perMeter_fs:+f.toFixed(2),skillUse:+(100*acc.skill[2]/tot).toFixed(1),fsUse:+(100*acc.fs[2]/tot).toFixed(1),dodgeUse:+(100*acc.dodge[2]/tot).toFixed(1),fsDodged:Math.round(100*dodged/Math.max(1,fsN))+'%'}));
if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(Object.fromEntries(Object.entries(per).map(([id,v])=>[id,{pm:(v[0]-base*v[2])/v[1],n:v[2]}]))));
