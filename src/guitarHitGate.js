import { sameChord } from './chordMatch.js';
// Match new musical evidence to the original attack, never to a later beat.
export function createGuitarHitGate({onHit,onMiss,onUnclear,target=null,snapshot}={}) {
  let armed=true,pending=null,last=-Infinity,valley=Infinity,lastAttack=-Infinity;
  return {
    reset(){armed=false;pending=null;valley=Infinity;lastAttack=-Infinity;},
    sample({at,level,threshold,observation}){
      if(![at,level,threshold].every(Number.isFinite)||at<=last||threshold<=0||level<0)return;
      last=at;
      // A guitar usually rings through the next strum. Detect a new attack
      // above its decaying envelope as well as an attack after absolute quiet.
      // The rise is judged relative to the live threshold: a fixed .004 minimum
      // ignored every re-strum from a quiet phone microphone.
      const attack=at-lastAttack>=350&&Number.isFinite(valley)&&level>=valley*2.2&&level-valley>=threshold*.5;
      if(level>threshold&&(armed||attack)){armed=false;lastAttack=at;valley=level;pending={at,level,threshold,slot:snapshot?.(),target:typeof target==='function'?target():target};}
      if(at-lastAttack<250)valley=level;else valley=Math.min(valley,level);
      if(level<threshold*.5)armed=true;
      if(!pending)return;
      // 친 소리는 났는데 2초 안에 코드로 잡히지 않음: 작은 소리인지 먹먹한 소리인지 알려 준다(11/19 QA: 명확한 피드백)
      if(at-pending.at>2000){const p=pending;pending=null;onUnclear?.(p.at,p.level,p.slot,{threshold:p.threshold,quiet:p.level<p.threshold*2.5});return;}
      const o=observation;
      if(!o?.usable||!o.chord||!Number.isFinite(o.sourceAt)||o.sourceAt<pending.at+200||o.sourceAt>at||at-o.sourceAt>1000||o.stableMs<350)return;
      const done=pending;pending=null;
      // 다른 코드로 친 소리는 박으로 세지 않고 따로 알린다(11/19 QA: 틀린 코드 알려주기)
      if(done.target&&!sameChord(o.chord,done.target)){onMiss?.(done.at,done.level,done.slot,{chord:o.chord,target:done.target,sourceAt:o.sourceAt});return;}
      onHit(done.at,done.level,done.slot,{chord:o.chord,sourceAt:o.sourceAt,version:'chordino-0.6.0'});
    },
  };
}
