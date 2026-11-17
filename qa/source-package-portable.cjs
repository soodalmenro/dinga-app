const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{pathToFileURL}=require('node:url'),{spawnSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dinga-no-archiver-')),loader=path.join(dir,'no-native.mjs');
try{
 fs.writeFileSync(loader,"import cp from 'node:child_process';import{syncBuiltinESMExports}from'node:module';cp.spawnSync=()=>{throw Error('native archive tools unavailable')};syncBuiltinESMExports();");
 for(const args of[[],['--verify']]){const result=spawnSync(process.execPath,['--import',pathToFileURL(loader).href,'scripts/prepare-source.mjs',...args],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,'source packaging must work without Windows bsdtar/Linux zip: '+result.stderr);}
 const{unzipSync}=require('fflate'),entries=unzipSync(fs.readFileSync('public/licenses/dinga-corresponding-source.zip'));
 for(const name of['src/lib.js','src/guitarEar.js','scripts/prepare-source.mjs','package-lock.json','SOURCE_BUILD.md','public/licenses/chordino-0.6.0-source.zip'])assert.ok(entries[name]?.length>0,name);
 assert.ok(Object.keys(entries).every(name=>!/(^|\/)(\.env[^/]*|\.git|\.npmrc|node_modules)(\/|$)/.test(name)));
 console.log('PASS portable source packaging/verification with native archivers unavailable, complete inputs and no private files');
}finally{fs.unlinkSync(loader);fs.rmdirSync(dir);}
