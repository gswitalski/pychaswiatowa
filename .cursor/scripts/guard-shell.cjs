'use strict';
// Heuristic defense; not a shell parser. Use protections on remote environments as real boundary.
const fs=require('node:fs');let input={};try{input=JSON.parse(fs.readFileSync(0,'utf8'))}catch{}
const c=String(input.command||'').replace(/\s+/g,' ');
let permission='allow',user_message='';
const deny=[/\bsupabase\s+(?:db\s+(?:reset|push)|migration\s+(?:up|down|repair|squash)(?![^\n]*--local)|functions\s+deploy)\b/i,
 /\b(?:firebase\s+deploy|git\s+push\s+.*--force|git\s+reset\s+--hard)\b/i,
 /\b(?:DROP\s+DATABASE|TRUNCATE\s+TABLE)\b/i,
 /\b(?:supabase\s+.*--(?:linked|db-url)|supabase\s+link)\b/i];
const ask=[/\bgit\s+(?:push|merge|commit|clean\s+-\w*f|branch\s+-D)\b/i,
 /\b(?:supabase\s+(?:migration\s+up\s+--local|db\s+reset)|rm\s+-rf|Remove-Item\b[^\n]*-Recurse)\b/i];
if(deny.some(x=>x.test(c))){permission='deny';user_message='Operacja zdalna, destrukcyjna lub niezweryfikowana: zablokowana.';}
else if(ask.some(x=>x.test(c))){permission='ask';user_message='Wymaga jawnej zgody; lokalne migracje uruchamiaj bezpiecznym skryptem quality.cjs migrate-local.';}
process.stdout.write(JSON.stringify({permission,user_message,agent_message:user_message}));
