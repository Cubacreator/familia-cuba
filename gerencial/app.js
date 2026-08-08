const cfg=window.CUBA_CONFIG;
const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let DATA={lavagens:[],lavagens_dol:[],gastos:[],custos_fixos:[],pagamentos_custos_fixos:[],metas:[],acoes:[],clientes:[],membros:[],auditoria:[],config:{pct_maquina:57}},profile=null,current="dashboard";
const n=v=>{if(typeof v==="number")return v||0;let s=String(v??"").trim().replace(/\s/g,"");if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");return Number(s.replace(/[^0-9.-]/g,""))||0};
const br=v=>n(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n(v));
const usd=v=>`US$ ${br(n(v))}`;
const today=()=>new Date().toISOString().slice(0,10);
const dateBR=d=>d?new Date(d+"T12:00").toLocaleDateString("pt-BR"):"—";
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1900)};
const sum=(a,k)=>a.reduce((s,x)=>s+n(x[k]),0);
function isManagerRole(cargo){
  cargo=String(cargo||"").trim().toLowerCase();
  return cargo==="01"||
         cargo==="02"||
         cargo==="gerente geral"||
         cargo==="gerente de ação";
}
function isoLocal(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`}
function mondayOfDate(value){
  const d=value?new Date(value+"T12:00"):new Date();
  const day=d.getDay(),diff=(day===0?-6:1-day);
  d.setDate(d.getDate()+diff);
  return d;
}


function qtyInputs(sujo){if(n(sujo)<=0)return 0;return Math.max(1,Math.ceil(n(sujo)/10000))}
function calcLav(){
 const f=$("#lavForm").elements,sujo=n(f.valor_sujo.value),pm=n(f.pct_maquina.value),pc=n(f.pct_cliente.value);
 const limpo=sujo*pm/100,cliente=sujo*pc/100,q=qtyInputs(sujo),cm=q*100,ca=q*200,ci=cm+ca,cuba=limpo-cliente-ci;
 f.valor_limpo.value=br(limpo);f.valor_cliente.value=br(cliente);f.qtd_malas.value=q;f.custo_malas.value=br(cm);f.qtd_alvejantes.value=q;f.custo_alvejantes.value=br(ca);f.custo_insumos.value=br(ci);f.valor_cuba.value=br(cuba)
}

function calcDol(){
  const f=$("#dolForm")?.elements;if(!f)return;
  const limpoDol=n(f.valor_limpo_dol.value),cot=n(f.cotacao.value),taxa=n(f.taxa_cambio_pct.value);
  const bruto=limpoDol*cot;
  const custo=bruto*taxa/100;
  const liquido=bruto-custo;
  f.valor_bruto_real.value=br(bruto);
  f.custo_taxa_real.value=br(custo);
  f.valor_liquido_real.value=br(liquido);
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
 const tables=["lavagens","lavagens_dol","gastos","custos_fixos","pagamentos_custos_fixos","metas","acoes","clientes","membros"];
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
function page(id){current=id;$$(".nav button").forEach(b=>b.classList.toggle("on",b.dataset.p===id));$$(".page").forEach(p=>p.classList.toggle("on",p.id===id));const titles={dashboard:["Dashboard","Visão financeira e operacional da Cuba."],lavagens:["Lavagens","Registros financeiros de lavagem em reais."],lavagensdol:["Lavagem DOL","Conversão separada de DOL para valor limpo no caixa."],gastos:["Gastos","Saídas financeiras."],custosfixos:["Custos Fixos","Despesas recorrentes da família."],metas:["Metas & Pagamentos","Controle de metas dos membros."],acoes:["Ações","Registro operacional."],clientes:["Famílias / Clientes","Parceiros de lavagem."],membros:["Membros","Cadastro interno sem acesso ao sistema."],auditoria:["Auditoria","Histórico de alterações da gerência."]};$("#title").textContent=titles[id][0];$("#subtitle").textContent=titles[id][1];renderAll()}
$$(".nav button").forEach(b=>b.onclick=()=>page(b.dataset.p));$("#collapse").onclick=()=>document.body.classList.toggle("collapsed");$("#mobileMenu").onclick=()=>$("#side").classList.toggle("mobile");
$("#logout").onclick=async()=>{await sb.auth.signOut();location.href="index.html"};$("#refresh").onclick=async()=>{await loadAll();toast("Dados atualizados.")};
function openModal(id,rec){
 const m=$("#"+id),f=m.querySelector("form");m.classList.add("on");f?.reset();if(f?.elements.id)f.elements.id.value="";
 if(rec&&f)Object.entries(rec).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v??""});
 if(id==="lavModal"){if(!rec){f.elements.data.value=today();f.elements.pct_maquina.value=DATA.config.pct_maquina;f.elements.pct_cliente.value=""}calcLav()}
 if(id==="gastoModal"&&!rec){f.elements.data.value=today();f.elements.moeda.value="real";updateGastoItems();updateGastoMoeda()}if(id==="gastoModal"&&rec){updateGastoItems(rec.item);updateGastoMoeda()}if(id==="dolModal"&&!rec){f.elements.data.value=today();f.elements.responsavel.value=profile?.nome||"";f.elements.taxa_cambio_pct.value=0;}if(id==="dolModal")calcDol();if(id==="pagarFixoModal"&&!rec)f.elements.data.value=today();if(id==="acaoModal"&&!rec)f.elements.data.value=today();if(id==="metaModal")updateMetaExempt()
}
function closeModal(id){$("#"+id).classList.remove("on")}
$$("[data-open]").forEach(b=>b.onclick=()=>openModal(b.dataset.open));$$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.closest(".modal").id));$$(".modal").forEach(m=>m.onclick=e=>{if(e.target===m)closeModal(m.id)});
["valor_sujo","pct_maquina","pct_cliente"].forEach(k=>$("#lavForm").elements[k].addEventListener("input",calcLav));["valor_limpo_dol","cotacao","taxa_cambio_pct"].forEach(k=>$("#dolForm").elements[k].addEventListener("input",calcDol));
$$(".money").forEach(el=>{el.addEventListener("blur",()=>{if(el.value!=="")el.value=br(el.value)});el.addEventListener("input",()=>{if(!el.readOnly)el.value=el.value.replace(/[^0-9.,-]/g,"")})});
async function saveRecord(table,payload,id){
 let q=id?sb.from(table).update(payload).eq("id",id):sb.from(table).insert(payload);const {error}=await q;if(error)throw error
}
async function removeRecord(table,id){if(!confirm("Excluir este registro?"))return;const {error}=await sb.from(table).delete().eq("id",id);if(error)return alert(error.message);await loadAll();toast("Registro excluído.")}
window.removeRecord=removeRecord;
function editRecord(type,id){const map={lavagens:["lavModal","lavagens"],lavagens_dol:["dolModal","lavagens_dol"],gastos:["gastoModal","gastos"],custos_fixos:["fixoModal","custos_fixos"],acoes:["acaoModal","acoes"],clientes:["clienteModal","clientes"],membros:["membroModal","membros"]};const [modal,t]=map[type],r=DATA[t].find(x=>x.id===id);openModal(modal,r)}window.editRecord=editRecord;

const GASTO_ITENS={
  "Armas":["Five","Tec","Submetralhadora","Fuzil"],
  "Munição":["Five","Tec","Submetralhadora","Fuzil"],
  "Drogas":["Ecstasy","Maconha","Cocaína","Crack"],
  "Colete":["Colete"],
  "Cordas":["Cordas"],
  "Abraçadeira":["Abraçadeira"],
  "Tablet":["Tablet"],
  "Veículos":["Veículo"],
  "Pagamento":["Pagamento"],
  "Outros":["Outro"]
};
function updateGastoItems(selected){
  const cat=$("#gastoCategoria")?.value;
  const sel=$("#gastoItem");
  if(!sel)return;
  const itens=GASTO_ITENS[cat]||["Outro"];
  sel.innerHTML=itens.map(i=>`<option value="${i}">${i}</option>`).join("");
  if(selected&&itens.includes(selected))sel.value=selected;
  $("#gastoItemHint").textContent=cat==="Armas"?"Tipo de arma comprada.":cat==="Munição"?"Munição correspondente ao armamento.":cat==="Drogas"?"Tipo de droga comprada.":"Item da categoria selecionada.";
}
$("#gastoCategoria").addEventListener("change",()=>updateGastoItems());
function updateGastoMoeda(){
  const moeda=$("#gastoMoeda")?.value||"real";
  const label=$("#gastoValorLabel");
  if(label)label.textContent=moeda==="dolar"?"Valor total (US$)":"Valor total (R$)";
}
$("#gastoMoeda").addEventListener("change",updateGastoMoeda);

$("#lavForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));const p={data:x.data,cliente:x.cliente,responsavel:x.responsavel,valor_sujo:n(x.valor_sujo),pct_maquina:n(x.pct_maquina),valor_limpo:n(x.valor_limpo),pct_cliente:n(x.pct_cliente),valor_cliente:n(x.valor_cliente),qtd_malas:n(x.qtd_malas),custo_malas:n(x.custo_malas),qtd_alvejantes:n(x.qtd_alvejantes),custo_alvejantes:n(x.custo_alvejantes),custo_insumos:n(x.custo_insumos),valor_cuba:n(x.valor_cuba),observacoes:x.observacoes||null};try{await saveRecord("lavagens",p,x.id);await ensureClient(x.cliente);closeModal("lavModal");await loadAll();toast("Lavagem salva.")}catch(ex){alert(ex.message)}};

$("#dolForm").onsubmit=async e=>{
  e.preventDefault();calcDol();
  const x=Object.fromEntries(new FormData(e.target));
  try{
    await saveRecord("lavagens_dol",{
      data:x.data,
      responsavel:x.responsavel,
      valor_sujo_dol:n(x.valor_sujo_dol),
      valor_limpo_dol:n(x.valor_limpo_dol),
      cotacao:n(x.cotacao),
      taxa_cambio_pct:n(x.taxa_cambio_pct),
      valor_bruto_real:n(x.valor_bruto_real),
      custo_taxa_real:n(x.custo_taxa_real),
      valor_liquido_real:n(x.valor_liquido_real),
      observacoes:x.observacoes||null
    },x.id);
    closeModal("dolModal");await loadAll();toast("Registro DOL salvo.");
  }catch(ex){alert(ex.message)}
};

$("#gastoForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));try{await saveRecord("gastos",{data:x.data,categoria:x.categoria,item:x.item||null,quantidade:n(x.quantidade)||1,familia_fornecedora:x.familia_fornecedora||null,moeda:x.moeda||"real",descricao:x.descricao||null,responsavel:x.responsavel||null,valor:n(x.valor)},x.id);closeModal("gastoModal");await loadAll();toast("Gasto salvo.")}catch(ex){alert(ex.message)}};

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


$("#acaoForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));try{await saveRecord("acoes",{data:x.data,nome:x.nome,entrada:n(x.entrada),custo:n(x.custo),participantes:x.participantes||null,status:x.status,observacoes:x.observacoes||null},x.id);closeModal("acaoModal");await loadAll();toast("Ação salva.")}catch(ex){alert(ex.message)}};
$("#clienteForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));try{await saveRecord("clientes",{nome:x.nome,contato:x.contato||null,observacoes:x.observacoes||null},x.id);closeModal("clienteModal");await loadAll();toast("Cliente salvo.")}catch(ex){alert(ex.message)}};
$("#membroForm").onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));try{await saveRecord("membros",{nome:x.nome,cargo:x.cargo,passaporte:x.passaporte||null},x.id);closeModal("membroModal");await loadAll();toast("Membro salvo.")}catch(ex){alert(ex.message)}};
async function ensureClient(nome){if(!nome||DATA.clientes.some(c=>c.nome.toLowerCase()===nome.toLowerCase()))return;await sb.from("clientes").insert({nome})}


function rankingHTML(L){
 const map={};L.forEach(x=>{const k=x.cliente||"Não informado";if(!map[k])map[k]={nome:k,qtd:0,sujo:0,cliente:0,cuba:0,ultima:""};const r=map[k];r.qtd++;r.sujo+=n(x.valor_sujo);r.cliente+=n(x.valor_cliente);r.cuba+=n(x.valor_cuba);if(!r.ultima||x.data>r.ultima)r.ultima=x.data});
 return Object.values(map).sort((a,b)=>b.sujo-a.sujo)
}
function renderDashboard(){
 const L=DATA.lavagens.filter(periodFilter),LD=DATA.lavagens_dol.filter(periodFilter),G=DATA.gastos.filter(periodFilter),GR=G.filter(x=>(x.moeda||"real")==="real"),GD=G.filter(x=>x.moeda==="dolar"),A=DATA.acoes.filter(periodFilter),M=DATA.metas.filter(periodFilter),FP=DATA.pagamentos_custos_fixos.filter(periodFilter);
 $("#kSujo").textContent=money(sum(L,"valor_sujo"));$("#kLimpo").textContent=money(sum(L,"valor_limpo"));$("#kCliente").textContent=money(sum(L,"valor_cliente"));$("#kCuba").textContent=money(sum(L,"valor_cuba")+sum(LD,"valor_liquido_real")+sum(A,"entrada")-sum(A,"custo")-sum(GR,"valor")-sum(M,"valor_pagamento_limpo"));$("#kGastos").textContent=money(sum(GR,"valor")+sum(A,"custo"));$("#kAcoes").textContent=money(sum(A,"entrada"));$("#kFixosSujo").textContent=money(FP.filter(x=>x.tipo_dinheiro==="sujo").reduce((s,x)=>s+n(x.valor),0));$("#kDolLimpo").textContent=money(sum(LD,"valor_liquido_real"));$("#kGastosDol").textContent=usd(sum(GD,"valor"));
 const p=$("#period").value;$("#customDates").classList.toggle("hidden",p!=="custom");$("#periodLabel").textContent=p==="custom"?`Período: ${dateBR($("#from").value)} até ${dateBR($("#to").value)}`:p==="all"?"Todo o histórico":`Últimos ${p} dias`;
 const cats=Object.entries(group(G,"categoria","valor")).sort((a,b)=>b[1]-a[1]),mx=cats[0]?.[1]||1;$("#expenseBars").innerHTML=cats.length?cats.map(([k,v])=>`<div class="bar"><span>${k}</span><div class="track"><div class="fill" style="width:${v/mx*100}%"></div></div><b>${money(v)}</b></div>`).join(""):`<div class="empty">Sem gastos no período.</div>`;
 const rank=rankingHTML(L);$("#top5").innerHTML=rank.length?rank.slice(0,5).map((r,i)=>`<div class="rank"><i>${i+1}</i><div>${r.nome}<small>${r.qtd} ${r.qtd===1?"lavagem":"lavagens"}</small></div><b>${money(r.sujo)}</b></div>`).join(""):`<div class="empty">Sem lavagens no período.</div>`;
 $("#ranking").innerHTML=rank.length?rank.map((r,i)=>`<tr><td><b>#${i+1}</b></td><td><b>${r.nome}</b></td><td>${r.qtd}</td><td>${money(r.sujo)}</td><td>${money(r.cliente)}</td><td class="green">${money(r.cuba)}</td><td>${dateBR(r.ultima)}</td></tr>`).join(""):`<tr><td colspan="7" class="empty">Nenhum cliente no período.</td></tr>`
}
$("#period").onchange=renderDashboard;$("#from").onchange=renderDashboard;$("#to").onchange=renderDashboard;
function renderLavagens(){const q=($("#lavSearch").value||"").toLowerCase(),a=DATA.lavagens.filter(x=>JSON.stringify(x).toLowerCase().includes(q));$("#lavTable").innerHTML=a.length?a.map(x=>`<tr><td>${dateBR(x.data)}</td><td><b>${x.cliente}</b></td><td>${x.responsavel}</td><td>${money(x.valor_sujo)}</td><td>${x.pct_maquina}%</td><td>${x.pct_cliente}%</td><td>${money(x.valor_limpo)}</td><td>${money(x.valor_cliente)}</td><td>${money(x.custo_insumos)}</td><td class="green">${money(x.valor_cuba)}</td><td><button class="mini" onclick="editRecord('lavagens','${x.id}')">Editar</button> <button class="mini red" onclick="removeRecord('lavagens','${x.id}')">×</button></td></tr>`).join(""):`<tr><td colspan="11" class="empty">Sem lavagens.</td></tr>`}$("#lavSearch").oninput=renderLavagens;

function renderLavagensDol(){
  const a=DATA.lavagens_dol||[];
  $("#dolSujoTotal").textContent=`US$ ${br(sum(a,"valor_sujo_dol"))}`;
  $("#dolLimpoDolTotal").textContent=`US$ ${br(sum(a,"valor_limpo_dol"))}`;
  $("#dolLimpoTotal").textContent=money(sum(a,"valor_liquido_real"));$("#dolGastosTotal").textContent=usd(sum(DATA.gastos.filter(x=>x.moeda==="dolar"),"valor"));
  $("#dolQtd").textContent=a.length;
  $("#dolUltima").textContent=a.length?dateBR([...a].sort((x,y)=>String(y.data).localeCompare(String(x.data)))[0].data):"—";
  $("#dolTable").innerHTML=a.length?a.map(x=>`<tr>
    <td>${dateBR(x.data)}</td>
    <td>${x.responsavel||"—"}</td>
    <td>US$ ${br(x.valor_sujo_dol)}</td>
    <td>US$ ${br(x.valor_limpo_dol)}</td>
    <td>${money(x.cotacao).replace("R$ ","R$ ")}/US$</td>
    <td>${n(x.taxa_cambio_pct).toFixed(2).replace(".",",")}%</td>
    <td>${money(x.valor_bruto_real)}</td>
    <td>${money(x.custo_taxa_real)}</td>
    <td class="green">${money(x.valor_liquido_real)}</td>
    <td>${x.observacoes||"—"}</td>
    <td><button class="mini" onclick="editRecord('lavagens_dol','${x.id}')">Editar</button> <button class="mini red" onclick="removeRecord('lavagens_dol','${x.id}')">×</button></td>
  </tr>`).join(""):`<tr><td colspan="11" class="empty">Sem registros DOL.</td></tr>`;
}
function renderGastos(){
  $("#gastoTable").innerHTML=DATA.gastos.length?DATA.gastos.map(x=>`<tr>
    <td>${dateBR(x.data)}</td><td>${x.categoria}</td><td>${x.item||"—"}</td><td>${br(x.quantidade||1)}</td><td>${x.familia_fornecedora||"—"}</td><td>${x.moeda==="dolar"?"Dólar (US$)":"Real (R$)"}</td><td>${x.descricao||"—"}</td><td>${x.responsavel||"—"}</td><td>${x.moeda==="dolar"?usd(x.valor):money(x.valor)}</td>
    <td><button class="mini" onclick="editRecord('gastos','${x.id}')">Editar</button> <button class="mini red" onclick="removeRecord('gastos','${x.id}')">×</button></td>
  </tr>`).join(""):`<tr><td colspan="10" class="empty">Sem gastos.</td></tr>`
}
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

function weekMonday(value){
  const d=value?new Date(value+"T12:00:00"):new Date();
  const day=d.getDay(),diff=day===0?-6:1-day;
  d.setDate(d.getDate()+diff);
  d.setHours(12,0,0,0);
  return d;
}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function isoDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function monthValue(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function weeksForMonth(ym){
  if(!ym)return[];
  const [y,m]=ym.split("-").map(Number);
  const first=new Date(y,m-1,1,12),last=new Date(y,m,0,12);
  let cur=weekMonday(isoDate(first));
  const out=[];
  while(cur<=last){
    const end=addDays(cur,6);
    if(end>=first&&cur<=last)out.push(new Date(cur));
    cur=addDays(cur,7);
  }
  return out;
}
function metaRec(memberId,monday){
  const key=isoDate(monday);
  return DATA.metas.find(x=>x.membro_id===memberId && x.semana_inicio===key) ||
    DATA.metas.find(x=>x.membro_id===memberId && String(x.periodo||"").startsWith(dateBR(key)));
}
function metaWeekLabel(mon){
  const sun=addDays(mon,6);
  return `${dateBR(isoDate(mon))} a ${dateBR(isoDate(sun))}`;
}
function metaCleanValue(){
  return 200000*n(DATA.config.pct_maquina||57)/100;
}
async function markMeta(memberId,monday,status){
  const member=DATA.membros.find(x=>x.id===memberId);
  if(!member)return;
  if(isManagerRole(member.cargo))return alert("Este cargo é isento de meta.");
  const existing=metaRec(memberId,monday);
  const paid=status==="paga";
  const payload={
    semana_inicio:isoDate(monday),
    periodo:metaWeekLabel(monday),
    membro_id:memberId,
    status_meta:status,
    valor_meta:0,
    valor_entregue:0,
    valor_pagamento:paid?200000:0,
    valor_pagamento_limpo:paid?metaCleanValue():0,
    data_pagamento:paid?isoDate(addDays(monday,7)):null
  };
  try{
    await saveRecord("metas",payload,existing?.id);
    await loadAll();
    toast(paid?"Semana marcada como paga.":"Semana marcada como devendo.");
  }catch(ex){alert(ex.message)}
}
window.markMeta=markMeta;

function renderMetaCalendarInto(containerId,memberId,ym,interactive=true){
  const el=$(containerId);if(!el)return;
  const member=DATA.membros.find(x=>x.id===memberId);
  if(!memberId||!member){el.innerHTML='<div class="empty">Selecione um membro.</div>';return}
  if(isManagerRole(member.cargo)){el.innerHTML='<div class="empty">Este cargo é isento de meta.</div>';return}
  const weeks=weeksForMonth(ym);
  el.innerHTML=weeks.map(mon=>{
    const r=metaRec(memberId,mon),status=r?.status_meta||(n(r?.valor_pagamento)>0?"paga":r?"devendo":"pendente");
    const cls=status==="paga"?"paid":status==="devendo"?"debt":"pending";
    const label=status==="paga"?"Pago":status==="devendo"?"Devendo":"Não marcado";
    return `<div class="metaWeek ${cls}">
      <div class="weekTop">
        <div class="weekDates">Semana ${dateBR(isoDate(mon)).slice(0,5)}<small>${metaWeekLabel(mon)}</small></div>
        <span class="metaStatus ${cls}">${label}</span>
      </div>
      <div class="weekMoney">${status==="paga"?`Pagamento: <b>${money(200000)} sujo</b><br>Equiv. limpo: <b>${money(n(r?.valor_pagamento_limpo)||metaCleanValue())}</b>`:"Pagamento semanal: "+money(200000)+" sujo"}</div>
      ${interactive?`<div class="metaWeekActions">
        <button class="btn paidBtn" onclick="markMeta('${memberId}',new Date('${isoDate(mon)}T12:00:00'),'paga')">✓ Pago</button>
        <button class="btn debtBtn" onclick="markMeta('${memberId}',new Date('${isoDate(mon)}T12:00:00'),'devendo')">✕ Devendo</button>
      </div>`:""}
    </div>`;
  }).join("");
}
function metaMonthStats(memberId,ym){
  const weeks=weeksForMonth(ym);
  const rows=weeks.map(w=>metaRec(memberId,w)).filter(Boolean);
  const paid=rows.filter(r=>(r.status_meta||(n(r.valor_pagamento)>0?"paga":"devendo"))==="paga");
  const debt=rows.filter(r=>(r.status_meta||(n(r.valor_pagamento)>0?"paga":"devendo"))==="devendo");
  return {paid:paid.length,debt:debt.length,dirty:sum(paid,"valor_pagamento"),clean:sum(paid,"valor_pagamento_limpo")};
}
function renderMetaCalendar(){
  const memberId=$("#metaCalendarMember")?.value,ym=$("#metaCalendarMonth")?.value;
  renderMetaCalendarInto("#metaCalendar",memberId,ym,true);
  const m=DATA.membros.find(x=>x.id===memberId),s=metaMonthStats(memberId,ym);
  $("#metaSummaryMember").textContent=m?`${m.nome} • ${m.cargo}`:"Selecione um membro.";
  $("#metaPaidCount").textContent=s.paid;
  $("#metaDebtCount").textContent=s.debt;
  $("#metaPaidDirty").textContent=money(s.dirty);
  $("#metaPaidClean").textContent=money(s.clean);
}
let memberCalendarId=null;
function openMemberCalendar(id){
  memberCalendarId=id;
  const m=DATA.membros.find(x=>x.id===id);if(!m)return;
  $("#memberCalTitle").textContent=`Calendário — ${m.nome}`;
  $("#memberCalSubtitle").textContent=`${m.cargo}${m.passaporte?" • "+m.passaporte:""}`;
  $("#memberCalMonth").value=$("#metaCalendarMonth")?.value||monthValue();
  renderMemberCalendar();
  $("#memberCalendarModal").classList.add("on");
}
window.openMemberCalendar=openMemberCalendar;
function renderMemberCalendar(){
  if(!memberCalendarId)return;
  const ym=$("#memberCalMonth").value;
  renderMetaCalendarInto("#memberCalendar",memberCalendarId,ym,false);
  const s=metaMonthStats(memberCalendarId,ym);
  $("#memberCalPaid").textContent=s.paid;
  $("#memberCalDebt").textContent=s.debt;
  $("#memberCalDirty").textContent=money(s.dirty);
  $("#memberCalClean").textContent=money(s.clean);
}
function renderMetas(){
  if(!$("#metaCalendarMonth").value)$("#metaCalendarMonth").value=monthValue();
  const current=$("#metaCalendarMember").value;
  const eligible=DATA.membros.filter(m=>!isManagerRole(m.cargo));
  $("#metaCalendarMember").innerHTML='<option value="">Selecione...</option>'+eligible.map(m=>`<option value="${m.id}">${m.nome} — ${m.cargo}</option>`).join("");
  if(current&&eligible.some(m=>m.id===current))$("#metaCalendarMember").value=current;
  const names=Object.fromEntries(DATA.membros.map(m=>[m.id,m]));
  const rows=[...DATA.metas].sort((a,b)=>String(b.semana_inicio||b.created_at||"").localeCompare(String(a.semana_inicio||a.created_at||"")));
  $("#metaTable").innerHTML=rows.length?rows.map(x=>{
    const m=names[x.membro_id],status=x.status_meta||(n(x.valor_pagamento)>0?"paga":"devendo"),paid=status==="paga";
    return`<tr><td>${x.periodo||dateBR(x.semana_inicio)}</td><td>${m?.nome||"—"}</td><td><span class="badge">${paid?"Pago":"Devendo"}</span></td><td>${money(x.valor_pagamento)}</td><td class="${paid?"green":""}">${money(x.valor_pagamento_limpo)}</td><td>${paid?dateBR(x.data_pagamento):"—"}</td><td><button class="mini red" onclick="removeRecord('metas','${x.id}')">×</button></td></tr>`
  }).join(""):`<tr><td colspan="7" class="empty">Nenhuma semana marcada ainda.</td></tr>`;
  renderMetaCalendar();
}
$("#metaCalendarMember").onchange=renderMetaCalendar;
$("#metaCalendarMonth").onchange=renderMetaCalendar;
$("#memberCalMonth").onchange=renderMemberCalendar;
function renderAcoes(){$("#acaoTable").innerHTML=DATA.acoes.length?DATA.acoes.map(x=>`<tr><td>${dateBR(x.data)}</td><td><b>${x.nome}</b></td><td>${x.participantes||"—"}</td><td>${money(x.entrada)}</td><td>${money(x.custo)}</td><td class="green">${money(n(x.entrada)-n(x.custo))}</td><td>${x.status}</td><td><button class="mini" onclick="editRecord('acoes','${x.id}')">Editar</button> <button class="mini red" onclick="removeRecord('acoes','${x.id}')">×</button></td></tr>`).join(""):`<tr><td colspan="8" class="empty">Sem ações.</td></tr>`}
function renderClients(){$("#clientCards").innerHTML=DATA.clientes.length?DATA.clientes.map(c=>{const l=DATA.lavagens.filter(x=>x.cliente.toLowerCase()===c.nome.toLowerCase());return`<div class="card entity"><h3>${c.nome}</h3><p>${c.contato||"Sem contato"}</p><div class="stats"><div><span>Lavagens</span><b>${l.length}</b></div><div><span>Valor sujo</span><b>${money(sum(l,"valor_sujo"))}</b></div><div><span>Valor cliente</span><b>${money(sum(l,"valor_cliente"))}</b></div><div><span>Valor Cuba</span><b>${money(sum(l,"valor_cuba"))}</b></div></div><p><button class="mini" onclick="editRecord('clientes','${c.id}')">Editar</button> <button class="mini red" onclick="removeRecord('clientes','${c.id}')">Excluir</button></p></div>`}).join(""):`<div class="empty">Sem clientes.</div>`}
function renderMembers(){
  $("#memberCards").innerHTML=DATA.membros.length?DATA.membros.map(m=>`<div class="card entity">
    <h3>${m.nome}</h3>
    <p>${m.cargo} ${m.passaporte?"• "+m.passaporte:""} ${isManagerRole(m.cargo)?'• <span class="badge">Isento de meta</span>':""}</p>
    <div class="memberActions">
      ${!isManagerRole(m.cargo)?`<button class="mini" onclick="openMemberCalendar('${m.id}')">📅 Ver calendário</button>`:""}
      <button class="mini" onclick="editRecord('membros','${m.id}')">Editar</button>
      <button class="mini red" onclick="removeRecord('membros','${m.id}')">Excluir</button>
    </div>
  </div>`).join(""):`<div class="empty">Sem membros.</div>`
}
function renderAudit(){$("#auditTable").innerHTML=DATA.auditoria.length?DATA.auditoria.map(a=>`<tr><td>${new Date(a.created_at).toLocaleString("pt-BR")}</td><td>${a.profile_nome||"Gerente"}</td><td>${a.action}</td><td>${a.table_name}</td><td>${a.record_id||"—"}</td></tr>`).join(""):`<tr><td colspan="5" class="empty">Sem eventos.</td></tr>`}
function renderLists(){$("#membersList").innerHTML=DATA.membros.map(m=>`<option value="${m.nome}">`).join("");$("#clientsList").innerHTML=DATA.clientes.map(c=>`<option value="${c.nome}">`).join("")}
function renderAll(){renderLists();renderDashboard();renderLavagens();renderLavagensDol();renderGastos();renderCustosFixos();renderMetas();renderAcoes();renderClients();renderMembers();renderAudit()}
(async()=>{try{if(!await requireSession())return;await loadAll();$("#loader").classList.add("hide")}catch(e){console.error(e);alert("Não foi possível carregar o sistema.\n\nErro: "+(e?.message||String(e)));}})();
