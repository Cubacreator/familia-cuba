const cfg=window.CUBA_CONFIG;
const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let DATA={lavagens:[],gastos:[],custos_fixos:[],pagamentos_custos_fixos:[],metas:[],acoes:[],clientes:[],membros:[],auditoria:[],config:{pct_maquina:57}},profile=null,current="dashboard";
const n=v=>{if(typeof v==="number")return v||0;let s=String(v??"").trim().replace(/\s/g,"");if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");return Number(s.replace(/[^0-9.-]/g,""))||0};
const br=v=>n(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n(v));
const today=()=>new Date().toISOString().slice(0,10);
const dateBR=d=>d?new Date(d+"T12:00").toLocaleDateString("pt-BR"):"—";
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1900)};
const sum=(a,k)=>a.reduce((s,x)=>s+n(x[k]),0);
function isManagerRole(cargo){cargo=String(cargo||"").toLowerCase();return cargo==="01"||cargo==="02"||cargo.includes("gerente")||cargo.includes("gerência")||cargo.includes("gerencia")}
function qtyInputs(sujo){if(n(sujo)<=0)return 0;return Math.max(1,Math.ceil(n(sujo)/10000))}
function calcLav(){
 const f=$("#lavForm").elements,sujo=n(f.valor_sujo.value),pm=n(f.pct_maquina.value),pc=n(f.pct_cliente.value);
 const limpo=sujo*pm/100,cliente=sujo*pc/100,q=qtyInputs(sujo),cm=q*100,ca=q*200,ci=cm+ca,cuba=limpo-cliente-ci;
 f.valor_limpo.value=br(limpo);f.valor_cliente.value=br(cliente);f.qtd_malas.value=q;f.custo_malas.value=br(cm);f.qtd_alvejantes.value=q;f.custo_alvejantes.value=br(ca);f.custo_insumos.value=br(ci);f.valor_cuba.value=br(cuba)
}
function periodFilter(row){
 const p=$("#period").value,d=row.data||row.data_pagamento||row.created_at?.slice(0,10);
 if(!d)return true;if(p==="all")return true;
 if(p==="custom"){const f=$("#from").value,t=$("#to").value;return(!f||d>=f)&&(!t||d<=t)}
 const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-Number(p)+1);return new Date(d+"T23:59")>=start
}
function group(a,key,val){return a.reduce((o,x)=>(o[x[key]||"Não informado"]=(o[x[key]||"Não informado"]||0)+n(x[val]),o),{})}
async function requireSession(){
 const {data:{session}}=await sb.auth.getSession();if(!session){location.href="index.html";return false}
 const {data,error}=await sb.from("profiles").select("*").eq("user_id",session.user.id).single();
 if(error||!data?.active||data.access_level!=="gerencial"){await sb.auth.signOut();alert("Acesso gerencial não autorizado.");location.href="index.html";return false}
 profile=data;$("#whoName").textContent=data.nome;$("#whoRole").textContent=data.cargo||"Gerencial";return true
}
async function loadAll(){
 const tables=["lavagens","gastos","custos_fixos","pagamentos_custos_fixos","metas","acoes","clientes","membros"];
 const req=tables.map(t=>sb.from(t).select("*").order("created_at",{ascending:false}));
 const res=await Promise.all(req);
 res.forEach((r,i)=>{if(r.error)throw r.error;DATA[tables[i]]=r.data||[]});
 const [au,pr]=await Promise.all([
   sb.from("audit_log").select("*").order("created_at",{ascending:false}).limit(200),
   sb.from("profiles").select("user_id,nome,cargo")
 ]);
 if(au.error) console.error("Erro auditoria:",au.error);
 if(pr.error) console.error("Erro perfis:",pr.error);
 const profileMap=Object.fromEntries((pr.data||[]).map(p=>[p.user_id,p]));
 DATA.auditoria=(au.data||[]).map(a=>({...a,profile_nome:profileMap[a.user_id]?.nome||"Gerente"}));
 const co=await sb.from("configuracoes").select("*").eq("chave","pct_maquina").maybeSingle();
 if(co.data)DATA.config.pct_maquina=n(co.data.valor);
 renderAll()
}
function page(id){current=id;$$(".nav button").forEach(b=>b.classList.toggle("on",b.dataset.p===id));$$(".page").forEach(p=>p.classList.toggle("on",p.id===id));const titles={dashboard:["Dashboard","Visão financeira e operacional da Cuba."],lavagens:["Lavagens","Registros financeiros de lavagem."],gastos:["Gastos","Saídas financeiras."],custosfixos:["Custos Fixos","Despesas recorrentes da família."],metas:["Metas & Pagamentos","Controle de metas dos membros."],acoes:["Ações","Registro operacional."],clientes:["Famílias / Clientes","Parceiros de lavagem."],membros:["Membros","Cadastro interno sem acesso ao sistema."],auditoria:["Auditoria","Histórico de alterações da gerência."]};$("#title").textContent=titles[id][0];$("#subtitle").textContent=titles[id][1];renderAll()}
$$(".nav button").forEach(b=>b.onclick=()=>page(b.dataset.p));$("#collapse").onclick=()=>document.body.classList.toggle("collapsed");$("#mobileMenu").onclick=()=>$("#side").classList.toggle("mobile");
$("#logout").onclick=async()=>{await sb.auth.signOut();location.href="index.html"};$("#refresh").onclick=async()=>{await loadAll();toast("Dados atualizados.")};
function openModal(id,rec){
 const m=$("#"+id),f=m.querySelector("form");m.classList.add("on");f?.reset();if(f?.elements.id)f.elements.id.value="";
 if(rec&&f)Object.entries(rec).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v??""});
 if(id==="lavModal"){if(!rec){f.elements.data.value=today();f.elements.pct_maquina.value=DATA.config.pct_maquina;f.elements.pct_cliente.value=""}calcLav()}
 if(id==="gastoModal"&&!rec)f.elements.data.value=today();if(id==="pagarFixoModal"&&!rec)f.elements.data.value=today();if(id==="acaoModal"&&!rec)f.elements.data.value=today();if(id==="metaModal")updateMetaExempt()
}
function closeModal(id){$("#"+id).classList.remove("on")}
$$("[data-open]").forEach(b=>b.onclick=()=>openModal(b.dataset.open));$$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.closest(".modal").id));$$(".modal").forEach(m=>m.onclick=e=>{if(e.target===m)closeModal(m.id)});
["valor_sujo","pct_maquina","pct_cliente"].forEach(k=>$("#lavForm").elements[k].addEventListener("input",calcLav));
$$(".money").forEach(el=>{el.addEventListener("blur",()=>{if(el.value!=="")el.value=br(el.value)});el.addEventListener("input",()=>{if(!el.readOnly)el.value=el.value.replace(/[^0-9.,-]/g,"")})});
async function saveRecord(table,payload,id){
 let q=id?sb.from(table).update(payload).eq("id",id):sb.from(table).insert(payload);const {error}=await q;if(error)throw error
}
async function removeRecord(table,id){if(!confirm("Excluir este registro?"))return;const {error}=await sb.from(table).delete().eq("id",id);if(error)return alert(error.message);await loadAll();toast("Registro excluído.")}
window.removeRecord=removeRecord;
function editRecord(type,id){const map={lavagens:["lavModal","lavagens"],gastos:["gastoModal","gastos"],custos_fixos:["fixoModal","custos_fixos"],metas:["metaModal","metas"],acoes:["acaoModal","acoes"],clientes:["clienteModal","clientes"],membros:["membroModal","membros"]};const [modal,t]=map[type],r=DATA[t].find(x=>x.id===id);openModal(modal,r)}window.editRecord=editRecord;
$("#lavForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));const p={data:x.data,cliente:x.cliente,responsavel:x.responsavel,valor_sujo:n(x.valor_sujo),pct_maquina:n(x.pct_maquina),valor_limpo:n(x.valor_limpo),pct_cliente:n(x.pct_cliente),valor_cliente:n(x.valor_cliente),qtd_malas:n(x.qtd_malas),custo_malas:n(x.custo_malas),qtd_alvejantes:n(x.qtd_alvejantes),custo_alvejantes:n(x.custo_alvejantes),custo_insumos:n(x.custo_insumos),valor_cuba:n(x.valor_cuba),observacoes:x.observacoes||null};try{await saveRecord("lavagens",p,x.id);await ensureClient(x.cliente);closeModal("lavModal");await loadAll();toast("Lavagem salva.")}catch(ex){alert(ex.message)}};
$("#gastoForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));try{await saveRecord("gastos",{data:x.data,categoria:x.categoria,descricao:x.descricao,responsavel:x.responsavel||null,valor:n(x.valor)},x.id);closeModal("gastoModal");await loadAll();toast("Gasto salvo.")}catch(ex){alert(ex.message)}};

$("#fixoForm").onsubmit=async e=>{
  e.preventDefault();
  const x=Object.fromEntries(new FormData(e.target));
  try{
    await saveRecord("custos_fixos",{
      nome:x.nome,
      valor:n(x.valor),
      tipo_dinheiro:x.tipo_dinheiro,
      recorrencia:x.recorrencia,
      dia_vencimento:x.dia_vencimento?Number(x.dia_vencimento):null,
      ativo:x.ativo==="true",
      observacoes:x.observacoes||null
    },x.id);
    closeModal("fixoModal");await loadAll();toast("Custo fixo salvo.");
  }catch(ex){alert(ex.message)}
};

$("#pagarFixoForm").onsubmit=async e=>{
  e.preventDefault();
  const x=Object.fromEntries(new FormData(e.target));
  try{
    const {error}=await sb.from("pagamentos_custos_fixos").insert({
      custo_fixo_id:x.custo_fixo_id,
      data:x.data,
      valor:n(x.valor),
      tipo_dinheiro:x.tipo_dinheiro.toLowerCase(),
      responsavel:x.responsavel,
      observacoes:x.observacoes||null
    });
    if(error)throw error;
    closeModal("pagarFixoModal");await loadAll();toast("Pagamento registrado.");
  }catch(ex){alert(ex.message)}
};

function pagarFixo(id){
  const c=DATA.custos_fixos.find(x=>x.id===id);if(!c)return;
  const f=$("#pagarFixoForm");
  f.reset();f.elements.custo_fixo_id.value=c.id;f.elements.nome.value=c.nome;
  f.elements.data.value=today();f.elements.valor.value=br(c.valor);
  f.elements.tipo_dinheiro.value=c.tipo_dinheiro==="sujo"?"Sujo":"Limpo";
  f.elements.responsavel.value=profile?.nome||"";
  $("#pagarFixoModal").classList.add("on");
}
window.pagarFixo=pagarFixo;

$("#metaForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target)),m=DATA.membros.find(m=>m.id===x.membro_id);if(m&&isManagerRole(m.cargo))return alert("Este cargo é isento de meta.");try{await saveRecord("metas",{periodo:x.periodo,membro_id:x.membro_id,valor_meta:n(x.valor_meta),valor_entregue:n(x.valor_entregue),valor_pagamento:n(x.valor_pagamento),data_pagamento:x.data_pagamento||null},x.id);closeModal("metaModal");await loadAll();toast("Meta salva.")}catch(ex){alert(ex.message)}};
$("#acaoForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));try{await saveRecord("acoes",{data:x.data,nome:x.nome,entrada:n(x.entrada),custo:n(x.custo),participantes:x.participantes||null,status:x.status,observacoes:x.observacoes||null},x.id);closeModal("acaoModal");await loadAll();toast("Ação salva.")}catch(ex){alert(ex.message)}};
$("#clienteForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));try{await saveRecord("clientes",{nome:x.nome,contato:x.contato||null,observacoes:x.observacoes||null},x.id);closeModal("clienteModal");await loadAll();toast("Cliente salvo.")}catch(ex){alert(ex.message)}};
$("#membroForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));try{await saveRecord("membros",{nome:x.nome,cargo:x.cargo,passaporte:x.passaporte||null},x.id);closeModal("membroModal");await loadAll();toast("Membro salvo.")}catch(ex){alert(ex.message)}};
async function ensureClient(nome){if(!nome||DATA.clientes.some(c=>c.nome.toLowerCase()===nome.toLowerCase()))return;await sb.from("clientes").insert({nome})}
function updateMetaExempt(){const id=$("#metaMember").value,m=DATA.membros.find(x=>x.id===id),ex=m&&isManagerRole(m.cargo);$("#metaMsg").textContent=ex?"Isento de meta pelo cargo.":"";$("#metaSave").disabled=!!ex}
$("#metaMember").onchange=updateMetaExempt;
function rankingHTML(L){
 const map={};L.forEach(x=>{const k=x.cliente||"Não informado";if(!map[k])map[k]={nome:k,qtd:0,sujo:0,cliente:0,cuba:0,ultima:""};const r=map[k];r.qtd++;r.sujo+=n(x.valor_sujo);r.cliente+=n(x.valor_cliente);r.cuba+=n(x.valor_cuba);if(!r.ultima||x.data>r.ultima)r.ultima=x.data});
 return Object.values(map).sort((a,b)=>b.sujo-a.sujo)
}
function renderDashboard(){
 const L=DATA.lavagens.filter(periodFilter),G=DATA.gastos.filter(periodFilter),A=DATA.acoes.filter(periodFilter),M=DATA.metas.filter(periodFilter),FP=DATA.pagamentos_custos_fixos.filter(periodFilter);
 $("#kSujo").textContent=money(sum(L,"valor_sujo"));$("#kLimpo").textContent=money(sum(L,"valor_limpo"));$("#kCliente").textContent=money(sum(L,"valor_cliente"));$("#kCuba").textContent=money(sum(L,"valor_cuba")+sum(A,"entrada")-sum(A,"custo")-sum(G,"valor")-sum(M,"valor_pagamento"));$("#kGastos").textContent=money(sum(G,"valor")+sum(A,"custo"));$("#kAcoes").textContent=money(sum(A,"entrada"));$("#kFixosSujo").textContent=money(FP.filter(x=>x.tipo_dinheiro==="sujo").reduce((s,x)=>s+n(x.valor),0));
 const p=$("#period").value;$("#customDates").classList.toggle("hidden",p!=="custom");$("#periodLabel").textContent=p==="custom"?`Período: ${dateBR($("#from").value)} até ${dateBR($("#to").value)}`:p==="all"?"Todo o histórico":`Últimos ${p} dias`;
 const cats=Object.entries(group(G,"categoria","valor")).sort((a,b)=>b[1]-a[1]),mx=cats[0]?.[1]||1;$("#expenseBars").innerHTML=cats.length?cats.map(([k,v])=>`<div class="bar"><span>${k}</span><div class="track"><div class="fill" style="width:${v/mx*100}%"></div></div><b>${money(v)}</b></div>`).join(""):`<div class="empty">Sem gastos no período.</div>`;
 const rank=rankingHTML(L);$("#top5").innerHTML=rank.length?rank.slice(0,5).map((r,i)=>`<div class="rank"><i>${i+1}</i><div>${r.nome}<small>${r.qtd} ${r.qtd===1?"lavagem":"lavagens"}</small></div><b>${money(r.sujo)}</b></div>`).join(""):`<div class="empty">Sem lavagens no período.</div>`;
 $("#ranking").innerHTML=rank.length?rank.map((r,i)=>`<tr><td><b>#${i+1}</b></td><td><b>${r.nome}</b></td><td>${r.qtd}</td><td>${money(r.sujo)}</td><td>${money(r.cliente)}</td><td class="green">${money(r.cuba)}</td><td>${dateBR(r.ultima)}</td></tr>`).join(""):`<tr><td colspan="7" class="empty">Nenhum cliente no período.</td></tr>`
}
$("#period").onchange=renderDashboard;$("#from").onchange=renderDashboard;$("#to").onchange=renderDashboard;
function renderLavagens(){const q=($("#lavSearch").value||"").toLowerCase(),a=DATA.lavagens.filter(x=>JSON.stringify(x).toLowerCase().includes(q));$("#lavTable").innerHTML=a.length?a.map(x=>`<tr><td>${dateBR(x.data)}</td><td><b>${x.cliente}</b></td><td>${x.responsavel}</td><td>${money(x.valor_sujo)}</td><td>${x.pct_maquina}%</td><td>${x.pct_cliente}%</td><td>${money(x.valor_limpo)}</td><td>${money(x.valor_cliente)}</td><td>${money(x.custo_insumos)}</td><td class="green">${money(x.valor_cuba)}</td><td><button class="mini" onclick="editRecord('lavagens','${x.id}')">Editar</button> <button class="mini red" onclick="removeRecord('lavagens','${x.id}')">×</button></td></tr>`).join(""):`<tr><td colspan="11" class="empty">Sem lavagens.</td></tr>`}$("#lavSearch").oninput=renderLavagens;
function renderGastos(){$("#gastoTable").innerHTML=DATA.gastos.length?DATA.gastos.map(x=>`<tr><td>${dateBR(x.data)}</td><td>${x.categoria}</td><td>${x.descricao}</td><td>${x.responsavel||"—"}</td><td>${money(x.valor)}</td><td><button class="mini" onclick="editRecord('gastos','${x.id}')">Editar</button> <button class="mini red" onclick="removeRecord('gastos','${x.id}')">×</button></td></tr>`).join(""):`<tr><td colspan="6" class="empty">Sem gastos.</td></tr>`}

function renderCustosFixos(){
  const ativos=DATA.custos_fixos.filter(x=>x.ativo);
  $("#fixAtivos").textContent=ativos.length;
  $("#fixMensalSujo").textContent=money(ativos.filter(x=>x.tipo_dinheiro==="sujo"&&x.recorrencia==="mensal").reduce((s,x)=>s+n(x.valor),0));
  $("#fixMensalLimpo").textContent=money(ativos.filter(x=>x.tipo_dinheiro==="limpo"&&x.recorrencia==="mensal").reduce((s,x)=>s+n(x.valor),0));
  const pagosPeriodo=DATA.pagamentos_custos_fixos.filter(periodFilter);
  $("#fixPagoPeriodo").textContent=money(pagosPeriodo.reduce((s,x)=>s+n(x.valor),0));

  const ult={};
  DATA.pagamentos_custos_fixos.forEach(p=>{if(!ult[p.custo_fixo_id]||p.data>ult[p.custo_fixo_id])ult[p.custo_fixo_id]=p.data});
  $("#fixoTable").innerHTML=DATA.custos_fixos.length?DATA.custos_fixos.map(x=>`<tr>
    <td><b>${x.nome}</b></td>
    <td>${money(x.valor)}</td>
    <td><span class="badge">${x.tipo_dinheiro==="sujo"?"Sujo":"Limpo"}</span></td>
    <td>${x.recorrencia}</td>
    <td>${x.dia_vencimento?`Dia ${x.dia_vencimento}`:"—"}</td>
    <td>${x.ativo?"Ativo":"Inativo"}</td>
    <td>${ult[x.id]?dateBR(ult[x.id]):"Nunca"}</td>
    <td><button class="mini" onclick="pagarFixo('${x.id}')">Pagar</button> <button class="mini" onclick="editRecord('custos_fixos','${x.id}')">Editar</button> <button class="mini red" onclick="removeRecord('custos_fixos','${x.id}')">×</button></td>
  </tr>`).join(""):`<tr><td colspan="8" class="empty">Sem custos fixos.</td></tr>`;

  const names=Object.fromEntries(DATA.custos_fixos.map(c=>[c.id,c.nome]));
  $("#fixoPagTable").innerHTML=DATA.pagamentos_custos_fixos.length?DATA.pagamentos_custos_fixos.map(x=>`<tr>
    <td>${dateBR(x.data)}</td><td>${names[x.custo_fixo_id]||"—"}</td><td>${money(x.valor)}</td><td>${x.tipo_dinheiro==="sujo"?"Sujo":"Limpo"}</td><td>${x.responsavel||"—"}</td>
    <td><button class="mini red" onclick="removeRecord('pagamentos_custos_fixos','${x.id}')">×</button></td>
  </tr>`).join(""):`<tr><td colspan="6" class="empty">Nenhum pagamento registrado.</td></tr>`;
}
function renderMetas(){const names=Object.fromEntries(DATA.membros.map(m=>[m.id,m]));$("#metaTable").innerHTML=DATA.metas.length?DATA.metas.map(x=>{const m=names[x.membro_id],pct=n(x.valor_meta)?n(x.valor_entregue)/n(x.valor_meta)*100:0;return`<tr><td>${x.periodo}</td><td>${m?.nome||"—"}</td><td>${money(x.valor_meta)}</td><td>${money(x.valor_entregue)}</td><td>${money(x.valor_pagamento)}</td><td><span class="badge">${pct>=100?"Batida":"Parcial"} • ${pct.toFixed(0)}%</span></td><td><button class="mini" onclick="editRecord('metas','${x.id}')">Editar</button> <button class="mini red" onclick="removeRecord('metas','${x.id}')">×</button></td></tr>`}).join(""):`<tr><td colspan="7" class="empty">Sem metas.</td></tr>`}
function renderAcoes(){$("#acaoTable").innerHTML=DATA.acoes.length?DATA.acoes.map(x=>`<tr><td>${dateBR(x.data)}</td><td><b>${x.nome}</b></td><td>${x.participantes||"—"}</td><td>${money(x.entrada)}</td><td>${money(x.custo)}</td><td class="green">${money(n(x.entrada)-n(x.custo))}</td><td>${x.status}</td><td><button class="mini" onclick="editRecord('acoes','${x.id}')">Editar</button> <button class="mini red" onclick="removeRecord('acoes','${x.id}')">×</button></td></tr>`).join(""):`<tr><td colspan="8" class="empty">Sem ações.</td></tr>`}
function renderClients(){$("#clientCards").innerHTML=DATA.clientes.length?DATA.clientes.map(c=>{const l=DATA.lavagens.filter(x=>x.cliente.toLowerCase()===c.nome.toLowerCase());return`<div class="card entity"><h3>${c.nome}</h3><p>${c.contato||"Sem contato"}</p><div class="stats"><div><span>Lavagens</span><b>${l.length}</b></div><div><span>Valor sujo</span><b>${money(sum(l,"valor_sujo"))}</b></div><div><span>Valor cliente</span><b>${money(sum(l,"valor_cliente"))}</b></div><div><span>Valor Cuba</span><b>${money(sum(l,"valor_cuba"))}</b></div></div><p><button class="mini" onclick="editRecord('clientes','${c.id}')">Editar</button> <button class="mini red" onclick="removeRecord('clientes','${c.id}')">Excluir</button></p></div>`}).join(""):`<div class="empty">Sem clientes.</div>`}
function renderMembers(){$("#memberCards").innerHTML=DATA.membros.length?DATA.membros.map(m=>`<div class="card entity"><h3>${m.nome}</h3><p>${m.cargo} ${m.passaporte?"• "+m.passaporte:""} ${isManagerRole(m.cargo)?'• <span class="badge">Isento de meta</span>':""}</p><p style="margin-top:10px"><button class="mini" onclick="editRecord('membros','${m.id}')">Editar</button> <button class="mini red" onclick="removeRecord('membros','${m.id}')">Excluir</button></p></div>`).join(""):`<div class="empty">Sem membros.</div>`}
function renderAudit(){$("#auditTable").innerHTML=DATA.auditoria.length?DATA.auditoria.map(a=>`<tr><td>${new Date(a.created_at).toLocaleString("pt-BR")}</td><td>${a.profile_nome||"Gerente"}</td><td>${a.action}</td><td>${a.table_name}</td><td>${a.record_id||"—"}</td></tr>`).join(""):`<tr><td colspan="5" class="empty">Sem eventos.</td></tr>`}
function renderLists(){$("#membersList").innerHTML=DATA.membros.map(m=>`<option value="${m.nome}">`).join("");$("#clientsList").innerHTML=DATA.clientes.map(c=>`<option value="${c.nome}">`).join("");$("#metaMember").innerHTML='<option value="">Selecione...</option>'+DATA.membros.map(m=>`<option value="${m.id}">${m.nome} — ${m.cargo}</option>`).join("")}
function renderAll(){renderLists();renderDashboard();renderLavagens();renderGastos();renderCustosFixos();renderMetas();renderAcoes();renderClients();renderMembers();renderAudit()}
(async()=>{try{if(!await requireSession())return;await loadAll();$("#loader").classList.add("hide")}catch(e){console.error(e);alert("Não foi possível carregar o sistema. Verifique a configuração do Supabase e as políticas.");}})();
