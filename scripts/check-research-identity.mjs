// Checks the editorial evidence packet; does not infer genre or truth from prose.
import {readFileSync} from 'node:fs';
const [file='data.json',...dates]=process.argv.slice(2);
const data=JSON.parse(readFileSync(file,'utf8'));
const fails=[];
const check=(v,msg)=>{if(!v)fails.push(msg)};
const http=u=>{try{return /^https?:$/.test(new URL(u).protocol)}catch{return false}};
const kinds=new Set(['new-work','reexhibition','archive']);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const issues=data.issues.filter(i=>dates.includes(i.date));
check(dates.length>0,'Explicit review dates required');
check(issues.length===new Set(dates).size,'Requested issue missing');
for(const issue of issues){
 let archives=0;
 for(const x of issue.items){
  const m=x.researchMeta;
  check(m&&kinds.has(m.kind),`${x.id}: temporal research kind required`);
  if(!m)continue;
  if(m.kind==='archive')archives++;
  check(nonempty(m.identity)&&nonempty(m.identityRationale),`${x.id}: manual identity rationale required`);
  check(Array.isArray(m.evidence)&&m.evidence.length&&m.evidence.every(http),`${x.id}: primary evidence URLs required`);
  check(nonempty(m.researchedAt)&&Number.isFinite(Date.parse(m.researchedAt)),`${x.id}: actual research date required`);
  check(nonempty(m.temporalDisclosure)&&m.temporalDisclosure===x.publishedAt,`${x.id}: visible temporal disclosure mismatch`);
  check(m.workYear===null||(Number.isInteger(m.workYear)&&m.workYear>=1900&&m.workYear<=Number(m.researchedAt.slice(0,4))),`${x.id}: invalid work year`);
  if(m.workYear===null)check(/미확인/.test(x.publishedAt),`${x.id}: unknown work year must be visible`);
  check(m.regionBasis==='documented-presentation-or-commission',`${x.id}: explicit region basis required`);
 }
 check(archives<=2,`${issue.date}: more than two archive items; research current work sources further`);
 if(issue.backfill){
  check(issue.backfill.originalPublicationClaimed===false,`${issue.date}: backfill cannot claim original publication`);
  check(issue.summary.includes('보충')&&issue.summary.includes(issue.backfill.publishedOn.replace(/^(\d{4})-(\d{2})-(\d{2})$/,(_,y,m,d)=>`${y}년 ${Number(m)}월 ${Number(d)}일`)),`${issue.date}: visible actual backfill date required`);
 }
}
console.log(JSON.stringify({ok:!fails.length,issues:issues.length,items:issues.reduce((n,i)=>n+i.items.length,0),manualGenreJudgmentRequired:true,fails},null,2));
process.exitCode=fails.length?1:0;
