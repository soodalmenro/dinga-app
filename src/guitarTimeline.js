export const GUITAR_RESULT_GRACE_MS=2000;
// The same quarter-beat anticipation window selects both target and result bar.
export const guitarBarIndex=(elapsed,beatMs)=>Math.floor((elapsed+beatMs*.25)/(4*beatMs));
export const finalizedGuitarBars=(elapsed,beatMs,total)=>Math.max(0,Math.min(total,Math.floor((elapsed-GUITAR_RESULT_GRACE_MS)/(4*beatMs))));
