#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=process.cwd(),base=path.join(root,'docs/results/workflows');
const storyStages=['story','design','api_plan','ui_plan','api_impl','ui_impl','qa','summary','ready_for_review'];
const epicStages=['analysis','analysis_review','stories','ready_for_review'];
const keys={analysis:'analysis.md',analysis_review:'analysis-review.md',stories:'stories.md',story:'user-story.md',api:'api-plan.md',ui:'ui-plan.md',deployment:'manual-deployment-plan.md',api_implementation_plan:'api-implementation-plan.md',ui_implementation_plan:'ui-implementation-plan.md',qa:'qa-report.md',summary:'summary-change.md',plan_review:'plan-review.md',code_review:'code-review.md'};
const [op,id,a,b]=process.argv.slice(2);const die=s=>{console.error('ERROR: '+s);process.exit(2)};
if(!/^(PS-\d+|LOCAL-[A-Za-z0-9][\w-]*)$/.test(id||''))die('Niepoprawne ID');
const dir=path.join(base,id),file=path.join(dir,'workflow.json');
function load(){if(!fs.existsSync(file))die('Brak manifestu');let s=JSON.parse(fs.readFileSync(file,'utf8'));s.schemaVersion ||= 1;s.qualityGates ||= {};s.requirements ||= {databaseChanged:false,backendChanged:false};s.approvals ||= {};s.artifacts ||= {};s.history ||= [];return s;}
function save(s){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file,JSON.stringify(s,null,2)+'\n');}
function stages(s){return s.type==='epic'?epicStages:storyStages;}
function expected(stage){return ({analysis:['analysis'],analysis_review:['analysis_review'],stories:['stories'],story:['story'],design:['api','ui','deployment'],api_plan:['api_implementation_plan'],ui_plan:['ui_implementation_plan'],qa:['qa']})[stage]||[];}
function validateDocs(s,stage){return expected(stage).filter(k=>{const rel=s.artifacts[k];if(!rel)return true;const f=path.resolve(root,rel);return !f.startsWith(dir+path.sep)||!fs.existsSync(f)||fs.statSync(f).size<10;});}
function qualityValid(){const r=cp.spawnSync(process.execPath,[path.join(root,'.cursor/scripts/quality.cjs'),'validate',id],{cwd:root,encoding:'utf8'});return {ok:r.status===0,report:r.stdout||r.stderr};}
switch(op){
 case 'init':{if(!['epic','story'].includes(a))die('init ID epic|story');if(fs.existsSync(file))die('Manifest istnieje — użyj status');
  // Zakres zmian workflow: commit bazowy zapisany przy starcie (P4). Commit nie zmniejsza wymaganych gate'ów.
  const head=cp.spawnSync('git',['rev-parse','--verify','HEAD'],{cwd:root,encoding:'utf8'});
  const scope=head.status===0?{baseRef:head.stdout.trim(),baseSetAt:new Date().toISOString()}:{};
  save({schemaVersion:2,id,type:a,stage:a==='epic'?'analysis':'story',status:'in_progress',artifacts:{},history:[],approvals:{requirements:false,plan:false,release:false},requirements:{databaseChanged:false,backendChanged:false},scope,qualityGates:{},createdAt:new Date().toISOString()});console.log(file);break;}
 case 'status':console.log(JSON.stringify(load(),null,2));break;
 case 'upgrade':{const s=load();s.schemaVersion=2;save(s);console.log('Schema v2, zachowano istniejący stan');break;}
 case 'artifact':{const s=load();if(!keys[a]||!b)die('artifact ID key path');const p=path.resolve(root,b);if(!p.startsWith(dir+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile())die('Plik musi istnieć w katalogu workflow');s.artifacts[a]=path.relative(root,p).replaceAll('\\','/');save(s);console.log(s.artifacts[a]);break;}
 case 'requirements':{const s=load();if(!['databaseChanged','backendChanged'].includes(a)||!['true','false'].includes(b))die('requirements ID databaseChanged|backendChanged true|false');if(s.requirements[a]===true&&b==='false')die('Nie można wyłączać wymaganego gate automatycznie; audytuj zakres ręcznie');s.requirements[a]=b==='true';save(s);break;}
 case 'validate':{const s=load(),stage=a||s.stage;if(!stages(s).includes(stage))die('Niepoprawny etap');const missing=validateDocs(s,stage);const quality=stage==='ready_for_review'?qualityValid():null;const ok=missing.length===0&&(!quality||quality.ok);console.log(JSON.stringify({stage,documentsValid:missing.length===0,missing,qualityGate:quality,valid:ok},null,2));if(!ok)process.exitCode=2;break;}
 case 'advance':{const s=load(),lst=stages(s);if(lst[lst.indexOf(s.stage)+1]!==a)die('Niedozwolone przejście');const missing=validateDocs(s,s.stage);if(missing.length)die('Brakuje artefaktów: '+missing.join(','));if(s.stage==='story'&&!s.approvals.requirements)die('Wymagana akceptacja wymagań');if(s.stage==='design'&&!s.approvals.plan)die('Wymagana akceptacja planu');if(a==='summary'||a==='ready_for_review'){const result=qualityValid();if(!result.ok)die('Quality Gates niezaliczone: '+result.report);}
 s.history.push({from:s.stage,to:a,at:new Date().toISOString()});s.stage=a;save(s);console.log(a);break;}
 default:die('Usage: init|status|upgrade|artifact|requirements|validate|advance ID [...]');
}
