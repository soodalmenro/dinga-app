export function createChordBarEvidence(){
 const bars=new Map();let lastAt=-Infinity;
 return {
  clear(){bars.clear();lastAt=-Infinity;},
  sample({observation:o,now,elapsed,barMs,minimumSourceAt=-Infinity}){
   if(!o?.usable||!o.chord||o.stableMs<350||![o.sourceAt,now,elapsed,barMs].every(Number.isFinite)||barMs<=0||o.sourceAt<=minimumSourceAt||o.sourceAt<=lastAt||o.sourceAt>now||now-o.sourceAt>1000)return;
   lastAt=o.sourceAt;const index=Math.floor((elapsed-(now-o.sourceAt))/barMs);if(index<0||index>=12)return;
   const votes=bars.get(index)||new Map();votes.set(o.chord,(votes.get(o.chord)||0)+1);bars.set(index,votes);
  },
  take(index){const ranked=[...(bars.get(index)||[])].sort((a,b)=>b[1]-a[1]);bars.delete(index);const valid=ranked[0]?.[1]>=2&&ranked[0][1]>(ranked[1]?.[1]||0)*1.5;return {chord:valid?ranked[0][0]:null,reason:valid?'recognized':'insufficient-window',version:'chordino-0.6.0'};},
 };
}
