
const DB_NAME='EventLeadCaptureDB', STORE='leads', SETTINGS='settings';
let db, currentPhotos=[];

const $=id=>document.getElementById(id);
const ids=['fullName','company','designation','mobile','email','industry','referrerType','referrerName','solution','enquiry','priority','timeline','nextAction','owner','followupDate','budget','preferredContact','followupReason'];

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function uid(){return 'LEAD-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase()}
function todayISO(){return new Date().toISOString().slice(0,10)}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=e=>{
      const d=e.target.result;
      if(!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE,{keyPath:'id'});
      if(!d.objectStoreNames.contains(SETTINGS)) d.createObjectStore(SETTINGS,{keyPath:'key'});
    };
    req.onsuccess=e=>{db=e.target.result;resolve(db)}; req.onerror=()=>reject(req.error);
  });
}
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store)}
function getAllLeads(){return new Promise((res,rej)=>{const r=tx(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
function getLead(id){return new Promise((res,rej)=>{const r=tx(STORE).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function putLead(v){return new Promise((res,rej)=>{const r=tx(STORE,'readwrite').put(v);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function deleteLead(id){return new Promise((res,rej)=>{const r=tx(STORE,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function clearLeads(){return new Promise((res,rej)=>{const r=tx(STORE,'readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function putSetting(key,value){return new Promise((res,rej)=>{const r=tx(SETTINGS,'readwrite').put({key,value});r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function getSetting(key){return new Promise((res,rej)=>{const r=tx(SETTINGS).get(key);r.onsuccess=()=>res(r.result?.value||'');r.onerror=()=>rej(r.error)})}

function navigate(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  $(name+'View').classList.add('active');
  document.querySelectorAll('.bottom-nav [data-go]').forEach(b=>b.classList.toggle('active',b.dataset.go===name));
  if(name==='home') refreshHome();
  if(name==='leads') renderLeads();
  if(name==='dashboard') renderDashboard();
  if(name==='new' && !$('leadId').value) resetForm();
  window.scrollTo({top:0,behavior:'smooth'});
}

document.addEventListener('click', async e=>{
  const go=e.target.closest('[data-go]'); if(go){navigate(go.dataset.go);return}
  const a=e.target.closest('[data-action]');
  if(a){if(a.dataset.action==='exportCSV') exportCSV(); if(a.dataset.action==='backup') backupJSON();return}
  const edit=e.target.closest('[data-edit]'); if(edit){await loadForEdit(edit.dataset.edit);return}
  const del=e.target.closest('[data-delete]'); if(del && confirm('Delete this lead?')){await deleteLead(del.dataset.delete);toast('Lead deleted');renderLeads();refreshHome()}
});

function setupSingleChoice(containerId,inputId,onchange){
  $(containerId).addEventListener('click',e=>{
    const b=e.target.closest('.choice');if(!b)return;
    [...$(containerId).querySelectorAll('.choice')].forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected'); $(inputId).value=b.dataset.value;
    if(onchange) onchange(b.dataset.value); updateScore();
  });
}
setupSingleChoice('visitorTypeChoices','visitorType');
setupSingleChoice('referrerChoices','referrerType',v=>$('referrerNameWrap').classList.toggle('hidden',v==='Walk-in'||!v));
setupSingleChoice('priorityChoices','priority');
$('interestChoices').addEventListener('click',e=>{const b=e.target.closest('.choice');if(b){b.classList.toggle('selected');updateScore()}});

function selectedInterests(){return [...$('interestChoices').querySelectorAll('.selected')].map(b=>b.dataset.value)}
function setChoice(containerId,value){[...$(containerId).querySelectorAll('.choice')].forEach(b=>b.classList.toggle('selected',b.dataset.value===value))}
function setMulti(values=[]){[...$('interestChoices').querySelectorAll('.choice')].forEach(b=>b.classList.toggle('selected',values.includes(b.dataset.value)))}

function calcScore(){
  let s=0;
  const p=$('priority').value,t=$('timeline').value,a=$('nextAction').value;
  if(p==='Hot')s+=35;else if(p==='Warm')s+=20;else if(p==='Explore')s+=8;
  if(t==='Immediate')s+=25;else if(t==='< 3 months')s+=18;else if(t==='3–6 months')s+=10;
  if(['Demo','POC','Proposal / Quotation','Assessment','Customer meeting'].includes(a))s+=18;
  if($('budget').value.trim())s+=8;
  if($('followupDate').value)s+=7;
  if(selectedInterests().length)s+=5;
  return Math.min(100,s);
}
function updateScore(){const s=calcScore();$('scorePreview').textContent=s?`${s}/100`:'—'}
['priority','timeline','nextAction','budget','followupDate'].forEach(id=>$(id).addEventListener('change',updateScore));

$('leadForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!$('visitorType').value){toast('Select visitor type');return}
  const now=new Date().toISOString(), existingId=$('leadId').value;
  const lead={
    id:existingId||uid(),createdAt:existingId?(await getLead(existingId)).createdAt:now,updatedAt:now,
    visitorType:$('visitorType').value,interests:selectedInterests(),photos:currentPhotos,score:calcScore()
  };
  ids.forEach(id=>lead[id]=$(id).value.trim?.() ?? $(id).value);
  await putLead(lead); toast(existingId?'Lead updated':'Lead saved'); resetForm(); navigate('home');
});

function resetForm(){
  $('leadForm').reset(); $('leadId').value=''; $('formTitle').textContent='New Lead'; currentPhotos=[];
  document.querySelectorAll('.choice.selected').forEach(b=>b.classList.remove('selected'));
  $('referrerNameWrap').classList.add('hidden'); renderPhotos(); updateScore();
}
$('clearFormBtn').onclick=()=>{if(confirm('Clear this form?'))resetForm()}

async function loadForEdit(id){
  const l=await getLead(id); if(!l)return;
  $('leadId').value=l.id;$('formTitle').textContent='Edit Lead';
  $('visitorType').value=l.visitorType||'';setChoice('visitorTypeChoices',l.visitorType);
  ids.forEach(id=>{if($(id))$(id).value=l[id]||''});
  setChoice('referrerChoices',l.referrerType);$('referrerNameWrap').classList.toggle('hidden',l.referrerType==='Walk-in'||!l.referrerType);
  setChoice('priorityChoices',l.priority);setMulti(l.interests||[]);
  currentPhotos=l.photos||[];renderPhotos();updateScore();navigate('new');
}

$('photoInput').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const data=await compressImage(file,1500,.72);currentPhotos.push(data);renderPhotos();toast('Photo attached')}catch{toast('Could not process photo')}
  e.target.value='';
});
function compressImage(file,maxDim=1500,quality=.72){
  return new Promise((res,rej)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{let w=img.width,h=img.height;if(Math.max(w,h)>maxDim){const r=maxDim/Math.max(w,h);w=Math.round(w*r);h=Math.round(h*r)}
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',quality));
    };img.onerror=rej;img.src=url;
  });
}
function renderPhotos(){
  $('photoStrip').innerHTML=currentPhotos.map((p,i)=>`<div class="photo-wrap"><img src="${p}" alt="Attachment ${i+1}"><button type="button" data-rmphoto="${i}">×</button></div>`).join('');
  $('photoStrip').querySelectorAll('[data-rmphoto]').forEach(b=>b.onclick=()=>{currentPhotos.splice(+b.dataset.rmphoto,1);renderPhotos()});
}

function due(l){return l.followupDate && l.followupDate<=todayISO()}
async function refreshHome(){
  const ls=await getAllLeads(); $('homeTotal').textContent=ls.length;$('homeHot').textContent=ls.filter(x=>x.priority==='Hot').length;
  $('homeDue').textContent=ls.filter(due).length;$('homePhotos').textContent=ls.reduce((n,l)=>n+(l.photos?.length||0),0);
}
async function renderLeads(){
  let ls=(await getAllLeads()).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  const q=$('searchBox').value.toLowerCase().trim(),p=$('filterPriority').value;
  if(q)ls=ls.filter(l=>JSON.stringify(l).toLowerCase().includes(q));if(p)ls=ls.filter(l=>l.priority===p);
  $('leadList').innerHTML=ls.length?ls.map(l=>`
    <article class="lead-card">
      <div><h3>${esc(l.fullName||'Unnamed')}</h3><p>${esc(l.company||'')} · ${esc(l.visitorType||'')}</p>
      <p>${esc(l.enquiry||l.followupReason||'No enquiry note')}</p>
      <div class="tags"><span class="tag ${l.priority==='Hot'?'hot':''}">${esc(l.priority||'Unrated')}</span><span class="tag">Score ${l.score||0}</span>${(l.interests||[]).slice(0,3).map(i=>`<span class="tag">${esc(i)}</span>`).join('')}${due(l)?'<span class="tag hot">Follow-up due</span>':''}</div></div>
      <div class="lead-actions"><button class="icon-btn" data-edit="${l.id}">Edit</button><button class="icon-btn" data-delete="${l.id}">Delete</button></div>
    </article>`).join(''):`<div class="form-card"><h3>No leads found</h3><p class="muted">Capture your first event interaction.</p></div>`;
}
$('searchBox').addEventListener('input',renderLeads);$('filterPriority').addEventListener('change',renderLeads);

function counts(list,key,explode=false){
  const m={}; list.forEach(x=>{const vals=explode?(x[key]||[]):[x[key]||'Not set'];vals.forEach(v=>m[v]=(m[v]||0)+1)});return m;
}
function barHTML(obj){
  const arr=Object.entries(obj).sort((a,b)=>b[1]-a[1]);const max=Math.max(1,...arr.map(x=>x[1]));
  return arr.length?arr.map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div><b>${v}</b></div>`).join(''):'<p class="muted">No data yet.</p>';
}
async function renderDashboard(){
  const ls=await getAllLeads();$('dashTotal').textContent=ls.length;$('dashHot').textContent=ls.filter(x=>x.priority==='Hot').length;$('dashWarm').textContent=ls.filter(x=>x.priority==='Warm').length;$('dashDue').textContent=ls.filter(due).length;
  $('visitorBreakdown').innerHTML=barHTML(counts(ls,'visitorType'));$('interestBreakdown').innerHTML=barHTML(counts(ls,'interests',true));$('referrerBreakdown').innerHTML=barHTML(counts(ls,'referrerType'));$('actionBreakdown').innerHTML=barHTML(counts(ls,'nextAction'));
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function download(name,type,text){
  const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function csvCell(v){v=Array.isArray(v)?v.join(' | '):(v??'');return `"${String(v).replaceAll('"','""')}"`}
async function exportCSV(){
  const ls=await getAllLeads(); if(!ls.length){toast('No leads to export');return}
  const cols=['id','createdAt','fullName','company','designation','mobile','email','industry','visitorType','referrerType','referrerName','interests','solution','enquiry','priority','score','timeline','nextAction','owner','followupDate','budget','preferredContact','followupReason'];
  const rows=[cols.map(csvCell).join(','),...ls.map(l=>cols.map(c=>csvCell(l[c])).join(','))];
  download(`event-leads-${todayISO()}.csv`,'text/csv;charset=utf-8','\ufeff'+rows.join('\n'));toast('CSV exported');
}
async function backupJSON(){
  const data={version:1,exportedAt:new Date().toISOString(),eventName:await getSetting('eventName'),deviceLabel:await getSetting('deviceLabel'),leads:await getAllLeads()};
  download(`event-lead-backup-${todayISO()}.json`,'application/json',JSON.stringify(data,null,2));toast('Full backup exported');
}
$('restoreInput').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{const data=JSON.parse(await f.text());if(!Array.isArray(data.leads))throw Error();
    if(!confirm(`Restore ${data.leads.length} leads? Existing leads with the same IDs will be replaced.`))return;
    for(const l of data.leads)await putLead(l);if(data.eventName)await putSetting('eventName',data.eventName);if(data.deviceLabel)await putSetting('deviceLabel',data.deviceLabel);
    toast('Backup restored');refreshHome();
  }catch{toast('Invalid backup file')} e.target.value='';
});
$('saveSettingsBtn').onclick=async()=>{await putSetting('eventName',$('eventName').value.trim());await putSetting('deviceLabel',$('deviceLabel').value.trim());toast('Settings saved')}
$('deleteAllBtn').onclick=async()=>{if(confirm('This permanently deletes every local lead and photo. Continue?')){await clearLeads();toast('All event data deleted');refreshHome()}}
async function loadSettings(){$('eventName').value=await getSetting('eventName');$('deviceLabel').value=await getSetting('deviceLabel')}

window.addEventListener('online',()=>{$('storageStatus').textContent='● Online · Local storage'});
window.addEventListener('offline',()=>{$('storageStatus').textContent='● Offline · Saved locally'});

(async()=>{
  await openDB();await loadSettings();await refreshHome();
  $('storageStatus').textContent=navigator.onLine?'● Online · Local storage':'● Offline · Saved locally';
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
})();
