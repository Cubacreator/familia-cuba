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



const RESPONSAVEIS_LIMITADOS=["Caio","Caroll","Nicko","Renan","Raissa"];
function shortResponsible(v){
  const s=String(v||"").toLowerCase();
  if(s.includes("caio"))return"Caio";
  if(s.includes("caroll")||s.includes("carol"))return"Caroll";
  if(s.includes("nick"))return"Nicko";
  if(s.includes("renan"))return"Renan";
  if(s.includes("raissa"))return"Raissa";
  return "";
}
function currentShortResponsible(){
  return shortResponsible(profile?.nome||"");
}


function sortName(a,b){return String(a||"").localeCompare(String(b||""),"pt-BR",{sensitivity:"base"})}
function memberHierarchyRank(cargo){
  const c=String(cargo||"").trim().toLowerCase();
  if(c==="01")return 1;
  if(c==="02")return 2;
  if(c==="gerente geral")return 3;
  if(c==="gerente de ação")return 4;
  if(c==="membro")return 5;
  return 6;
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

function updateActionForm(){
  const f=$("#acaoForm")?.elements;
  if(!f)return;
  const failed=f.status.value==="Falhou";
  $("#actionRewardPanel").classList.toggle("hidden",failed);
  $("#actionRedBox").classList.toggle("hidden",!failed);

  if(failed){
    f.valor_ganho.value="";
    if(f.valor_familia)f.valor_familia.value="";
    if(f.valor_integrantes)f.valor_integrantes.value="";
    return;
  }

  const destino=f.destino_valor?.value||"familia";
  const total=n(f.valor_ganho.value);

  $("#acaoValorFamiliaWrap").classList.toggle("hidden",destino!=="dividido");
  $("#acaoValorIntegrantesWrap").classList.toggle("hidden",destino!=="dividido");

  if(destino==="familia"){
    if(f.valor_familia)f.valor_familia.value=br(total);
    if(f.valor_integrantes)f.valor_integrantes.value=br(0);
  }else if(destino==="integrantes"){
    if(f.valor_familia)f.valor_familia.value=br(0);
    if(f.valor_integrantes)f.valor_integrantes.value=br(total);
  }else{
    let familia=n(f.valor_familia.value);
    if(familia>total){
      familia=total;
      f.valor_familia.value=br(familia);
    }
    if(f.valor_integrantes)f.valor_integrantes.value=br(Math.max(0,total-familia));
  }
}
function actionCurrencyValue(x){
  return x.moeda==="dolar"?usd(x.valor_ganho):money(x.valor_ganho);
}
function actionMoneyTypeLabel(x){
  return `${x.moeda==="dolar"?"Dólar":"Real"} • ${x.tipo_dinheiro==="sujo"?"Sujo":"Limpo"}`;
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
 if(id==="gastoModal"&&!rec){f.elements.data.value=today();f.elements.moeda.value="real";f.elements.responsavel.value=currentShortResponsible();updateGastoItems();updateGastoMoeda()}
 if(id==="gastoModal"&&rec){f.elements.responsavel.value=shortResponsible(rec.responsavel);updateGastoItems(rec.item);updateGastoMoeda()}
 if(id==="lavModal"){f.elements.responsavel.value=rec?shortResponsible(rec.responsavel):currentShortResponsible()}
 if(id==="dolModal"&&!rec){f.elements.data.value=today();f.elements.responsavel.value=currentShortResponsible();f.elements.taxa_cambio_pct.value=0;}
 if(id==="dolModal"&&rec)f.elements.responsavel.value=shortResponsible(rec.responsavel);
 if(id==="dolModal")calcDol();
 if(id==="pagarFixoModal"&&!rec)f.elements.data.value=today();
 if(id==="acaoModal"){
   if(!rec){
     f.elements.data.value=today();
     f.elements.status.value="Sucesso";
     f.elements.custo.value="0,00";
     f.elements.moeda.value="real";
     f.elements.tipo_dinheiro.value="limpo";
     f.elements.destino_valor.value="familia";
     if(f.elements.valor_familia)f.elements.valor_familia.value="";
     if(f.elements.valor_integrantes)f.elements.valor_integrantes.value="";
   }else{
     f.elements.moeda.value=rec.moeda||"real";
     f.elements.tipo_dinheiro.value=rec.tipo_dinheiro||"limpo";
     const total=n(rec.valor_ganho)||n(rec.entrada);
     const vf=rec.valor_familia!=null?n(rec.valor_familia):(rec.entrada_familia?total:n(rec.entrada));
     const vi=rec.valor_integrantes!=null?n(rec.valor_integrantes):Math.max(0,total-vf);
     f.elements.destino_valor.value=rec.destino_valor||(vf>0&&vi>0?"dividido":vf>0?"familia":"integrantes");
     if(f.elements.valor_familia)f.elements.valor_familia.value=br(vf);
     if(f.elements.valor_integrantes)f.elements.valor_integrantes.value=br(vi);
   }
   updateActionForm();
 }
}
function closeModal(id){$("#"+id).classList.remove("on")}
$$("[data-open]").forEach(b=>b.onclick=()=>openModal(b.dataset.open));$$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.closest(".modal").id));$$(".modal").forEach(m=>m.onclick=e=>{if(e.target===m)closeModal(m.id)});
["valor_sujo","pct_maquina","pct_cliente"].forEach(k=>$("#lavForm").elements[k].addEventListener("input",calcLav));["valor_limpo_dol","cotacao","taxa_cambio_pct"].forEach(k=>$("#dolForm").elements[k].addEventListener("input",calcDol));
$$(".money").forEach(el=>{el.addEventListener("blur",()=>{if(el.value!=="")el.value=br(el.value)});el.addEventListener("input",()=>{if(!el.readOnly)el.value=el.value.replace(/[^0-9.,-]/g,"")})});
async function saveRecord(table,payload,id){
 let q=id?sb.from(table).update(payload).eq("id",id):sb.from(table).insert(payload);const {error}=await q;if(error)throw error
}
async function removeRecord(table,id,silent=false){if(!silent&&!confirm("Excluir este registro?"))return;const {error}=await sb.from(table).delete().eq("id",id);if(error)return alert(error.message);await loadAll();toast("Registro excluído.")}
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
$("#acaoStatus").addEventListener("change",updateActionForm);

$("#acaoValorGanho").addEventListener("input",updateActionForm);
$("#acaoValorFamilia").addEventListener("input",updateActionForm);
$$('input[name="destino_valor"]').forEach(x=>x.addEventListener("change",updateActionForm));


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


$("#acaoForm").onsubmit=async e=>{
  e.preventDefault();
  updateActionForm();
  const x=Object.fromEntries(new FormData(e.target));
  const failed=x.status==="Falhou";
  const valor=failed?0:n(x.valor_ganho);
  const moeda=failed?"real":(x.moeda||"real");
  const tipo=failed?"limpo":(x.tipo_dinheiro||"limpo");
  const destino=failed?"integrantes":(x.destino_valor||"familia");

  if(!failed && valor<=0)return alert("Informe o valor que foi ganho na ação.");

  let valorFamilia=0,valorIntegrantes=0;
  if(!failed){
    if(destino==="familia"){
      valorFamilia=valor;
    }else if(destino==="integrantes"){
      valorIntegrantes=valor;
    }else{
      valorFamilia=n(x.valor_familia);
      if(valorFamilia<0 || valorFamilia>valor)return alert("O valor para a família deve estar entre zero e o total ganho.");
      valorIntegrantes=Math.max(0,valor-valorFamilia);
    }
  }

  const entradaLegada=!failed && moeda==="real" && tipo==="limpo" ? valorFamilia : 0;

  try{
    await saveRecord("acoes",{
      data:x.data,
      nome:x.nome,
      entrada:entradaLegada,
      custo:n(x.custo),
      participantes:x.participantes||null,
      status:x.status,
      valor_ganho:valor,
      moeda,
      tipo_dinheiro:tipo,
      entrada_familia:valorFamilia>0,
      destino_valor:destino,
      valor_familia:valorFamilia,
      valor_integrantes:valorIntegrantes,
      observacoes:x.observacoes||null
    },x.id);
    closeModal("acaoModal");
    await loadAll();
    toast(failed?"Ação registrada: DEU RED.":"Ação salva.");
  }catch(ex){alert(ex.message)}
};
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
function gastoFilteredRows(){
  const from=$("#gastoFrom")?.value||"",to=$("#gastoTo")?.value||"",prod=$("#gastoProductFilter")?.value||"",currency=$("#gastoCurrencyFilter")?.value||"";
  return DATA.gastos.filter(x=>{
    if(from&&String(x.data)<from)return false;
    if(to&&String(x.data)>to)return false;
    if(prod&&String(x.item||x.categoria||"")!==prod)return false;
    if(currency&&(x.moeda||"real")!==currency)return false;
    return true;
  }).sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")));
}
function renderGastoProductFilter(){
  const current=$("#gastoProductFilter")?.value||"";
  const products=[...new Set(DATA.gastos.map(x=>String(x.item||x.categoria||"").trim()).filter(Boolean))].sort(sortName);
  $("#gastoProductFilter").innerHTML='<option value="">Todos os produtos</option>'+products.map(x=>`<option value="${x}">${x}</option>`).join("");
  if(products.includes(current))$("#gastoProductFilter").value=current;
}
function renderBarChart(elId,items,currency){
  const el=$(elId);if(!el)return;
  const grouped={};
  items.filter(x=>(x.moeda||"real")===currency).forEach(x=>{const k=x.item||x.categoria||"Outros";grouped[k]=(grouped[k]||0)+n(x.valor)});
  const rows=Object.entries(grouped).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if(!rows.length){el.innerHTML='<div class="empty">Sem dados para o gráfico.</div>';return}
  const max=Math.max(...rows.map(x=>x[1]),1);
  el.innerHTML=rows.map(([name,val])=>`<div class="barRow"><div class="barLabel" title="${name}">${name}</div><div class="barTrack"><div class="barFill" style="width:${Math.max(3,val/max*100)}%"></div></div><div class="barValue">${currency==="dolar"?usd(val):money(val)}</div></div>`).join("");
}
function renderLineChart(elId,items){
  const el=$(elId);if(!el)return;
  const currency=$("#gastoChartCurrency")?.value||"real",grouped={};
  items.filter(x=>(x.moeda||"real")===currency).forEach(x=>{grouped[x.data]=(grouped[x.data]||0)+n(x.valor)});
  const rows=Object.entries(grouped).sort((a,b)=>a[0].localeCompare(b[0]));
  if(!rows.length){el.innerHTML='<div class="empty">Sem dados para o gráfico.</div>';return}
  const max=Math.max(...rows.map(x=>x[1]),1);
  const pts=rows.map((r,i)=>`${rows.length===1?50:(i/(rows.length-1))*100},${92-(r[1]/max)*78}`).join(" ");
  el.innerHTML=`<div class="lineChartWrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow:hidden"><defs><clipPath id="gastoLineClip"><rect x="0" y="0" width="100" height="100"/></clipPath></defs><g clip-path="url(#gastoLineClip)"><line x1="0" y1="92" x2="100" y2="92" class="chartAxis"/><polyline points="${pts}" class="chartLine"/>${rows.map((r,i)=>{const x=rows.length===1?50:(i/(rows.length-1))*100,y=92-(r[1]/max)*78;return`<circle cx="${x}" cy="${y}" r="1.6" class="chartPoint"><title>${dateBR(r[0])}: ${currency==="dolar"?usd(r[1]):money(r[1])}</title></circle>`}).join("")}</g></svg><div class="lineLabels"><span>${dateBR(rows[0][0])}</span><span>${currency==="dolar"?usd(max):money(max)}</span><span>${dateBR(rows[rows.length-1][0])}</span></div></div>`;
}
function renderGastos(){
  renderGastoProductFilter();
  const rows=gastoFilteredRows(),real=rows.filter(x=>(x.moeda||"real")==="real"),dol=rows.filter(x=>x.moeda==="dolar");
  $("#gastoFilteredReal").textContent=money(sum(real,"valor"));
  $("#gastoFilteredDollar").textContent=usd(sum(dol,"valor"));
  $("#gastoFilteredCount").textContent=rows.length;
  $("#gastoFilteredQty").textContent=br(rows.reduce((s,x)=>s+n(x.quantidade||1),0));
  $("#gastoTable").innerHTML=rows.length?rows.map(x=>`<tr><td>${dateBR(x.data)}</td><td>${x.categoria}</td><td>${x.item||"—"}</td><td>${br(x.quantidade||1)}</td><td>${x.familia_fornecedora||"—"}</td><td>${x.moeda==="dolar"?"Dólar (US$)":"Real (R$)"}</td><td>${x.descricao||"—"}</td><td>${x.responsavel||"—"}</td><td>${x.moeda==="dolar"?usd(x.valor):money(x.valor)}</td><td><button class="mini" onclick="editRecord('gastos','${x.id}')">Editar</button> <button class="mini red" onclick="removeRecord('gastos','${x.id}')">×</button></td></tr>`).join(""):`<tr><td colspan="10" class="empty">Sem gastos para os filtros selecionados.</td></tr>`;
  const cur=$("#gastoChartCurrency")?.value||"real";
  renderBarChart("#gastoProductChart",rows,cur);renderLineChart("#gastoDateChart",rows);
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
function monthName(ym){
  if(!ym)return"";
  const [y,m]=ym.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"}).format(new Date(y,m-1,1,12));
}
function calendarWeeks(ym){
  if(!ym)return[];
  const [y,m]=ym.split("-").map(Number);
  const first=new Date(y,m-1,1,12),last=new Date(y,m,0,12);
  let cur=weekMonday(isoDate(first));
  const rows=[];
  while(cur<=last){rows.push(new Date(cur));cur=addDays(cur,7)}
  return rows;
}
function metaRec(memberId,monday){
  const key=isoDate(monday);
  return DATA.metas.find(x=>x.membro_id===memberId&&x.semana_inicio===key)||
         DATA.metas.find(x=>x.membro_id===memberId&&String(x.periodo||"").startsWith(dateBR(key)));
}
function metaWeekLabel(mon){
  const sun=addDays(mon,6);
  return `${dateBR(isoDate(mon))} a ${dateBR(isoDate(sun))}`;
}
function metaCleanValue(){return 200000*n(DATA.config.pct_maquina||57)/100}
function metaStatusOf(r){
  if(!r)return"pendente";
  if(r.status_meta)return r.status_meta;
  return n(r.valor_pagamento)>0?"paga":"devendo";
}
function statusMetaLabel(status){return status==="paga"?"Pago":status==="devendo"?"Devendo":status==="ausente"?"Ausente":"Não marcado"}
function statusMetaClass(status){return status==="paga"?"paid":status==="devendo"?"debt":status==="ausente"?"absent":"pending"}

let weekEditMemberId=null,weekEditMonday=null;
function openWeekStatus(memberId,monday){
  const member=DATA.membros.find(x=>x.id===memberId);
  if(!member)return;
  if(isManagerRole(member.cargo))return alert("Este cargo é isento de meta.");
  weekEditMemberId=memberId;
  weekEditMonday=new Date(monday);
  $("#weekStatusTitle").textContent=`${member.nome} • ${metaWeekLabel(weekEditMonday)}`;
  $("#weekStatusPayday").textContent=`Pagamento desta meta: ${dateBR(isoDate(addDays(weekEditMonday,7)))} • R$ 200.000,00 sujo`;
  $("#weekStatusModal").classList.add("on");
}
window.openWeekStatus=openWeekStatus;

async function setWeekStatus(status){
  if(!weekEditMemberId||!weekEditMonday)return;
  const existing=metaRec(weekEditMemberId,weekEditMonday);
  try{
    if(status==="pendente"){
      if(existing)await removeRecord("metas",existing.id,true);
      closeModal("weekStatusModal");await loadAll();toast("Marcação removida.");return;
    }
    const paid=status==="paga";
    const payload={
      semana_inicio:isoDate(weekEditMonday),
      periodo:metaWeekLabel(weekEditMonday),
      membro_id:weekEditMemberId,
      status_meta:status,
      valor_meta:0,
      valor_entregue:0,
      valor_pagamento:paid?200000:0,
      valor_pagamento_limpo:paid?metaCleanValue():0,
      data_pagamento:paid?isoDate(addDays(weekEditMonday,7)):null
    };
    await saveRecord("metas",payload,existing?.id);
    closeModal("weekStatusModal");await loadAll();
    toast(status==="paga"?"Semana marcada como paga.":status==="devendo"?"Semana marcada como devendo.":"Semana marcada como ausente.");
  }catch(ex){alert(ex.message)}
}
$("#weekMarkPaid").onclick=()=>setWeekStatus("paga");
$("#weekMarkDebt").onclick=()=>setWeekStatus("devendo");
$("#weekMarkAbsent").onclick=()=>setWeekStatus("ausente");
$("#weekClearStatus").onclick=()=>setWeekStatus("pendente");

function renderMonthCalendar(containerId,memberId,ym,interactive=true){
  const el=$(containerId);if(!el)return;
  const member=DATA.membros.find(x=>x.id===memberId);
  if(!memberId||!member){el.innerHTML='<div class="empty">Selecione um membro.</div>';return}
  if(isManagerRole(member.cargo)){el.innerHTML='<div class="empty">Este cargo é isento de meta.</div>';return}

  const [,monthNum]=ym.split("-").map(Number);
  const weeks=calendarWeeks(ym);
  const names=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
  let out=`<div class="calHeader">${names.map(x=>`<div>${x}</div>`).join("")}</div>`;

  for(const mon of weeks){
    const r=metaRec(memberId,mon),status=metaStatusOf(r),cls=statusMetaClass(status),payDate=addDays(mon,7);
    let cells="";
    for(let i=0;i<7;i++){
      const d=addDays(mon,i),other=d.getMonth()!==monthNum-1;
      cells+=`<div class="calDay ${other?"otherMonth":""}"><span class="dayNum">${d.getDate()}</span>${i===0?'<span class="payFlag">pagamento</span>':""}</div>`;
    }
    out+=`<div class="calWeek ${cls}" ${interactive?`onclick="openWeekStatus('${memberId}',new Date('${isoDate(mon)}T12:00:00'))"`:""}>
      ${cells}
      <div class="weekRibbon">
        <div class="weekInfo"><span class="weekStatusPill">${statusMetaLabel(status)}</span><span>${metaWeekLabel(mon)}</span></div>
        <span class="payDate">Paga em ${dateBR(isoDate(payDate))}${status==="paga"?" • "+money(200000)+" sujo":""}</span>
      </div>
    </div>`;
  }
  el.innerHTML=out;
}
function metaMonthStats(memberId,ym){
  const rows=calendarWeeks(ym).map(w=>metaRec(memberId,w)).filter(Boolean);
  const paid=rows.filter(r=>metaStatusOf(r)==="paga"),debt=rows.filter(r=>metaStatusOf(r)==="devendo"),absent=rows.filter(r=>metaStatusOf(r)==="ausente");
  return {paid:paid.length,debt:debt.length,absent:absent.length,dirty:sum(paid,"valor_pagamento"),clean:sum(paid,"valor_pagamento_limpo")};
}
function renderMetaCalendar(){
  const memberId=$("#metaCalendarMember")?.value,ym=$("#metaCalendarMonth")?.value;
  renderMonthCalendar("#metaCalendar",memberId,ym,true);
  const m=DATA.membros.find(x=>x.id===memberId),s=metaMonthStats(memberId,ym);
  $("#metaSummaryMember").textContent=m?`${m.nome} • ${m.cargo} • ${monthName(ym)}`:"Selecione um membro.";
  $("#metaPaidCount").textContent=s.paid;$("#metaDebtCount").textContent=s.debt;$("#metaAbsentCount").textContent=s.absent;
  $("#metaPaidDirty").textContent=money(s.dirty);$("#metaPaidClean").textContent=money(s.clean);
}
let memberCalendarId=null;
function openMemberCalendar(id){
  memberCalendarId=id;
  const m=DATA.membros.find(x=>x.id===id);if(!m)return;
  $("#memberCalTitle").textContent=`Calendário — ${m.nome}`;
  $("#memberCalSubtitle").textContent=`${m.cargo}${m.passaporte?" • "+m.passaporte:""}`;
  $("#memberCalMonth").value=$("#metaCalendarMonth")?.value||monthValue();
  renderMemberCalendar();$("#memberCalendarModal").classList.add("on");
}
window.openMemberCalendar=openMemberCalendar;
function renderMemberCalendar(){
  if(!memberCalendarId)return;
  const ym=$("#memberCalMonth").value,s=metaMonthStats(memberCalendarId,ym);
  renderMonthCalendar("#memberCalendar",memberCalendarId,ym,true);
  $("#memberCalPaid").textContent=s.paid;$("#memberCalDebt").textContent=s.debt;$("#memberCalAbsent").textContent=s.absent;
  $("#memberCalDirty").textContent=money(s.dirty);$("#memberCalClean").textContent=money(s.clean);
}

function renderMetas(){
  if(!$("#metaCalendarMonth").value)$("#metaCalendarMonth").value=monthValue();
  const current=$("#metaCalendarMember").value;
  const eligible=DATA.membros.filter(m=>memberHierarchyRank(m.cargo)>=5).sort((a,b)=>sortName(a.nome,b.nome));
  $("#metaCalendarMember").innerHTML='<option value="">Selecione...</option>'+eligible.map(m=>`<option value="${m.id}">${m.nome} — ${m.cargo}</option>`).join("");
  if(current&&eligible.some(m=>m.id===current))$("#metaCalendarMember").value=current;
  else if(!current&&eligible.length)$("#metaCalendarMember").value=eligible[0].id;

  const names=Object.fromEntries(DATA.membros.map(m=>[m.id,m]));
  const rows=[...DATA.metas].sort((a,b)=>String(b.semana_inicio||b.created_at||"").localeCompare(String(a.semana_inicio||a.created_at||"")));
  $("#metaTable").innerHTML=rows.length?rows.map(x=>{
    const m=names[x.membro_id],status=metaStatusOf(x),paid=status==="paga";
    return`<tr><td>${x.periodo||dateBR(x.semana_inicio)}</td><td>${m?.nome||"—"}</td><td><span class="badge">${statusMetaLabel(status)}</span></td><td>${money(x.valor_pagamento)}</td><td class="${paid?"green":""}">${money(x.valor_pagamento_limpo)}</td><td>${paid?dateBR(x.data_pagamento):"—"}</td><td><button class="mini red" onclick="removeRecord('metas','${x.id}')">×</button></td></tr>`
  }).join(""):`<tr><td colspan="7" class="empty">Nenhuma semana marcada ainda.</td></tr>`;
  renderMetaCalendar();
}


$("#metaCalendarMember").onchange=renderMetaCalendar;
$("#metaCalendarMonth").onchange=renderMetaCalendar;
$("#memberCalMonth").onchange=renderMemberCalendar;
function renderAcoes(){
  const valid=DATA.acoes.filter(x=>x.status!=="Falhou");
  const famValue=x=>x.valor_familia!=null?n(x.valor_familia):(x.entrada_familia?n(x.valor_ganho):n(x.entrada));

  const rl=valid.filter(x=>(x.moeda||"real")==="real" && (x.tipo_dinheiro||"limpo")==="limpo");
  const rs=valid.filter(x=>(x.moeda||"real")==="real" && x.tipo_dinheiro==="sujo");
  const dl=valid.filter(x=>x.moeda==="dolar" && (x.tipo_dinheiro||"limpo")==="limpo");
  const ds=valid.filter(x=>x.moeda==="dolar" && x.tipo_dinheiro==="sujo");

  $("#acaoRealLimpo").textContent=money(rl.reduce((s,x)=>s+famValue(x),0));
  $("#acaoRealSujo").textContent=money(rs.reduce((s,x)=>s+famValue(x),0));
  $("#acaoDolLimpo").textContent=usd(dl.reduce((s,x)=>s+famValue(x),0));
  $("#acaoDolSujo").textContent=usd(ds.reduce((s,x)=>s+famValue(x),0));

  $("#acaoTable").innerHTML=DATA.acoes.length?DATA.acoes.map(x=>{
    const failed=x.status==="Falhou";
    const total=n(x.valor_ganho)||(!failed?n(x.entrada):0);
    const moeda=x.moeda||"real";
    const tipo=x.tipo_dinheiro||"limpo";
    const vf=failed?0:(x.valor_familia!=null?n(x.valor_familia):(x.entrada_familia?total:n(x.entrada)));
    const vi=failed?0:(x.valor_integrantes!=null?n(x.valor_integrantes):Math.max(0,total-vf));

    const ganho=failed?'<b class="actionRedText">DEU RED</b>':(moeda==="dolar"?usd(total):money(total));
    const famTxt=failed?"—":(moeda==="dolar"?usd(vf):money(vf));
    const intTxt=failed?"—":(moeda==="dolar"?usd(vi):money(vi));

    const resultado=failed?'<b class="actionRedText">DEU RED</b>':
      (vf>0&&vi>0?'<span class="green">Valor dividido</span>':
       vf>0?'<span class="green">Tudo para família</span>':
       '<span class="mut">Tudo para integrantes</span>');

    return`<tr>
      <td>${dateBR(x.data)}</td><td><b>${x.nome}</b></td><td>${x.participantes||"—"}</td>
      <td><span class="badge">${x.status}</span></td><td>${ganho}</td>
      <td>${failed?"—":`${moeda==="dolar"?"Dólar":"Real"} • ${tipo==="sujo"?"Sujo":"Limpo"}`}</td>
      <td>${famTxt}</td><td>${intTxt}</td><td>${money(x.custo)}</td><td>${resultado}</td>
      <td><button class="mini" onclick="editRecord('acoes','${x.id}')">Editar</button> <button class="mini red" onclick="removeRecord('acoes','${x.id}')">×</button></td>
    </tr>`
  }).join(""):`<tr><td colspan="11" class="empty">Sem ações.</td></tr>`;
}

function renderClients(){
  const ordered=[...DATA.clientes].sort((a,b)=>sortName(a.nome,b.nome));
  $("#clientCards").innerHTML=ordered.length?ordered.map(c=>{
    const l=DATA.lavagens.filter(x=>String(x.cliente||"").toLowerCase()===String(c.nome||"").toLowerCase());
    return`<div class="card entity"><h3>${c.nome}</h3><p>${c.contato||"Sem contato"}</p><div class="stats"><div><span>Lavagens</span><b>${l.length}</b></div><div><span>Valor sujo</span><b>${money(sum(l,"valor_sujo"))}</b></div><div><span>Valor cliente</span><b>${money(sum(l,"valor_cliente"))}</b></div><div><span>Valor Cuba</span><b>${money(sum(l,"valor_cuba"))}</b></div></div><p><button class="mini" onclick="editRecord('clientes','${c.id}')">Editar</button> <button class="mini red" onclick="removeRecord('clientes','${c.id}')">Excluir</button></p></div>`
  }).join(""):`<div class="empty">Sem clientes.</div>`;
}
function renderMembers(){
  const ordered=[...DATA.membros].sort((a,b)=>{
    const ra=memberHierarchyRank(a.cargo),rb=memberHierarchyRank(b.cargo);
    return ra!==rb?ra-rb:sortName(a.nome,b.nome);
  });
  $("#memberCards").innerHTML=ordered.length?ordered.map(m=>`<div class="card entity"><h3>${m.nome}</h3><p>${m.cargo} ${m.passaporte?"• "+m.passaporte:""} ${isManagerRole(m.cargo)?'• <span class="badge">Isento de meta</span>':""}</p><div class="memberActions">${!isManagerRole(m.cargo)?`<button class="mini" onclick="openMemberCalendar('${m.id}')">📅 Ver calendário</button>`:""}<button class="mini" onclick="editRecord('membros','${m.id}')">Editar</button><button class="mini red" onclick="removeRecord('membros','${m.id}')">Excluir</button></div></div>`).join(""):`<div class="empty">Sem membros.</div>`;
}
function renderAudit(){$("#auditTable").innerHTML=DATA.auditoria.length?DATA.auditoria.map(a=>`<tr><td>${new Date(a.created_at).toLocaleString("pt-BR")}</td><td>${a.profile_nome||"Gerente"}</td><td>${a.action}</td><td>${a.table_name}</td><td>${a.record_id||"—"}</td></tr>`).join(""):`<tr><td colspan="5" class="empty">Sem eventos.</td></tr>`}
function renderLists(){$("#membersList").innerHTML=DATA.membros.map(m=>`<option value="${m.nome}">`).join("");$("#clientsList").innerHTML=DATA.clientes.map(c=>`<option value="${c.nome}">`).join("")}

["gastoFrom","gastoTo","gastoProductFilter","gastoCurrencyFilter","gastoChartCurrency"].forEach(id=>{const e=$("#"+id);if(e)e.addEventListener("change",renderGastos)});
$("#gastoClearFilters").onclick=()=>{$("#gastoFrom").value="";$("#gastoTo").value="";$("#gastoProductFilter").value="";$("#gastoCurrencyFilter").value="";renderGastos()};
function renderAll(){renderLists();renderDashboard();renderLavagens();renderLavagensDol();renderGastos();renderCustosFixos();renderMetas();renderAcoes();renderClients();renderMembers();renderAudit()}
(async()=>{try{if(!await requireSession())return;await loadAll();$("#loader").classList.add("hide")}catch(e){console.error(e);alert("Não foi possível carregar o sistema.\n\nErro: "+(e?.message||String(e)));}})();
