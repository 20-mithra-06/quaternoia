const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const md=s=>esc(s).replace(/```(?:\w+\n)?([\s\S]*?)```/g,'<pre>$1</pre>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/^\s*[-*] (.+)$/gm,'• $1').replace(/\n/g,'<br>');
function openKey(){$('#keyIn').value=localStorage.getItem('gemini_key')||'';$('#modelIn').value=localStorage.getItem('gemini_model')||'gemini-2.5-flash';$('#keyDlg').showModal()}
$('#keyBtn').onclick=openKey;
$('#keySave').onclick=()=>{localStorage.setItem('gemini_key',$('#keyIn').value.trim());localStorage.setItem('gemini_model',$('#modelIn').value.trim()||'gemini-2.5-flash');$('#keyDlg').close()};
/* Real Google Gemini call (free tier via Google AI Studio key) */
async function gemini(prompt,{system,json,history}={}){
  const key=localStorage.getItem('gemini_key');
  if(!key){openKey();throw new Error('Add your free Gemini API key first (click the key button).')}
  const model=localStorage.getItem('gemini_model')||'gemini-2.5-flash';
  const body={contents:history||[{role:'user',parts:[{text:prompt}]}]};
  if(system)body.systemInstruction={parts:[{text:system}]};
  if(json)body.generationConfig={responseMimeType:'application/json'};
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});
  const d=await r.json();
  if(!r.ok)throw new Error(d.error?.message||('Request failed '+r.status));
  return (d.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
}
const gjson=async(p,o={})=>JSON.parse((await gemini(p,{...o,json:true})).replace(/```json|```/g,'').trim());
let steps=[],goal='';
const log=(t,c)=>{const d=document.createElement('div');d.textContent=new Date().toLocaleTimeString()+'  '+t;if(c)d.className=c;$('#log').prepend(d)};
const ic={Researcher:'🔎',Analyst:'📊',Writer:'✍️',Critic:'🧐'};
function draw(){
  $('#flow').innerHTML=steps.map((s,i)=>`<div class="node glass ${s.status}" style="animation-delay:${i*90}ms"><div class="ava">${ic[s.agent]||'🤖'}</div>
   <span class="badge">${s.status==='waiting'?'needs approval':s.status}</span><h4>${i+1}. ${esc(s.title)}</h4><small>${esc(s.agent)} agent</small>
   <p>${esc(s.out||s.err||s.desc)}</p>
   ${s.wait==='approve'?`<div class="acts"><button onclick="res(${i},true)">Approve</button><button class="no" onclick="res(${i},false)">Reject</button></div>`:''}
   ${s.wait==='retry'?`<div class="acts"><button onclick="res(${i},true)">↻ Retry</button></div>`:''}</div>`).join('');
}
const waits={};const res=(i,v)=>{steps[i].wait=null;waits[i](v)};
const ask=(i,k)=>new Promise(r=>{steps[i].wait=k;waits[i]=r;draw()});
$('#plan').onclick=async()=>{
  goal=$('#goal').value.trim();if(!goal)return;$('#plan').disabled=true;log('Planner is breaking down the goal...');
  try{steps=await gjson(`Break this goal into 4 or 5 sequential steps for a team of AI agents. Goal: ${goal}. Return ONLY a JSON array of {"agent":"Researcher|Analyst|Writer|Critic","title":"short title","desc":"one sentence","approval":boolean}. Set approval true for exactly one middle step that a human should review before work continues.`);
    steps.forEach(s=>s.status='pending');draw();$('#run').disabled=false;log('Plan ready: '+steps.length+' steps')}
  catch(e){log('Error: '+e.message,'err')}
  $('#plan').disabled=false;
};
$('#run').onclick=async()=>{
  $('#run').disabled=true;$('#plan').disabled=true;
  for(let i=0;i<steps.length;i++){
    const s=steps[i];s.status='running';s.out='Working...';draw();log(s.agent+' started: '+s.title);
    for(;;){
      try{s.out=await gemini(`Overall goal: ${goal}\nResults so far:\n${steps.slice(0,i).map(x=>x.title+': '+x.out).join('\n')||'none'}\nYou are the ${s.agent}. Task: ${s.title}. ${s.desc}\nReply with the result in under 70 words, plain text.`);break}
      catch(e){s.status='error';s.out='';s.err=e.message;log('Error in step '+(i+1)+': '+e.message,'err');await ask(i,'retry');s.status='running';s.err='';s.out='Retrying...';draw();log('Retrying step '+(i+1))}
    }
    if(s.approval){s.status='waiting';log('Waiting for human approval on step '+(i+1));
      if(!await ask(i,'approve')){s.status='error';s.err='Rejected by human reviewer. Workflow stopped.';draw();log('Rejected. Workflow stopped.','err');$('#plan').disabled=false;return}
      log('Human approved step '+(i+1))}
    s.status='done';draw();log(s.agent+' finished: '+s.title);
  }
  log('Workflow complete ✔');$('#plan').disabled=false;
};
