// Match new musical evidence to the original attack, never to a later beat.
export function createGuitarHitGate({onHit,target=null,snapshot}={}) {
  let armed=true,pending=null,last=-Infinity,valley=Infinity,lastAttack=-Infinity;
  return {
    reset(){armed=false;pending=null;valley=Infinity;lastAttack=-Infinity;},
    sample({at,level,threshold,observation}){
      if(![at,level,threshold].every(Number.isFinite)||at<=last||threshold<=0||level<0)return;
      last=at;
      // A guitar usually rings through the next strum. Detect a new attack
      // above its decaying envelope as well as an attack after absolute quiet.
      const attack=at-lastAttack>=350&&Number.isFinite(valley)&&level>=valley*2.2&&level-valley>=Math.max(.004,threshold*.5);
      if(level>threshold&&(armed||attack)){armed=false;lastAttack=at;valley=level;pending={at,level,slot:snapshot?.(),target:typeof target==='function'?target():target};}
      if(at-lastAttack<250)valley=level;else valley=Math.min(valley,level);
      if(level<threshold*.5)armed=true;
      if(!pending)return;
      if(at-pending.at>2000){pending=null;return;}
      const o=observation;
      if(!o?.usable||!o.chord||!Number.isFinite(o.sourceAt)||o.sourceAt<pending.at+200||o.sourceAt>at||at-o.sourceAt>1000||o.stableMs<350)return;
      const done=pending;pending=null;
      if(done.target&&o.chord!==done.target)return;
      onHit(done.at,done.level,done.slot,{chord:o.chord,sourceAt:o.sourceAt,version:'chordino-0.6.0'});
    },
  };
}
