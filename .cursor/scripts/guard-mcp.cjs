'use strict';
const fs=require('node:fs');let p={};try{p=JSON.parse(fs.readFileSync(0,'utf8'))}catch{}
const s=String(p.tool_name||'')+' '+JSON.stringify(p.tool_input||{});
const suspicious=/\b(?:deploy|db_push|migration|execute_sql|run_sql|delete|drop|truncate|merge|publish|update_secret|force_push)\b/i;
const blocked=/\b(?:production|prod|remote|linked)\b/i.test(s)&&suspicious.test(s);
const permission=blocked?'deny':suspicious.test(s)?'ask':'allow';
process.stdout.write(JSON.stringify({permission,user_message:permission==='allow'?'':'Zdalna operacja MCP wymaga sprawdzenia środowiska i zatwierdzenia.'}));
