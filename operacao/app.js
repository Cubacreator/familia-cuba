const cfg=window.CUBA_CONFIG;
const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const fmt=(v,c='real')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:c==='dolar'?'USD':'BRL'}).format(Number(v)||0);
const dateNow=()=>new Date().toLocaleDateString('en-CA');
const num=v=>Number(v)||0;
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
let dados={acoes:[],produtos:[],vendas:[],caixa:[],metas:[]},profile=null,relLinhas=[],relHeader=[];
function msg(t,error=false){$('#aviso').textContent=t;$('#aviso').style.color=error?'#ff9999':'#92e4b3'}
async function auth(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){$('#login').hidden=false;$('#app').hidden=true;return}
 const {data,error}=await sb.from('profiles').select('nome,cargo,active,access_level').eq('user_id',session.user.id).single();
 if(error||!data?.active||data.access_level!=='gerencial'){
  await sb.auth.signOut();$('#loginError').textContent='Usuário sem permissão de gerência.';return;
 }
 profile=data;$('#login').hidden=true;$('#app').hidden=false;$('#identidade').textContent=data.nome+' • '+data.cargo;await refresh();
}
$('#loginForm').addEventListener('submit',async e=>{
 e.preventDefault();$('#loginError').textContent='';
 const f=new FormData(e.target);
 const {error}=await sb.auth.signInWithPassword({email:String(f.get('passaporte')).trim()+'@cuba.local',password:f.get('senha')});
 if(error){$('#loginError').textContent='Passaporte ou senha inválidos.';return}
 await auth();
});
$('#sair').onclick=async()=>{await sb.auth.signOut();location.reload()};
$('#atualizar').onclick=()=>refresh();
$$('nav button').forEach(b=>b.onclick=()=>{$$('nav button').forEach(x=>x.classList.toggle('active',x===b));$$('.tab').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab));$('#titulo').textContent=b.textContent.trim()});
const tables={acoes:'cuba2_acoes',produtos:'cuba2_produtos',vendas:'cuba2_vendas',caixa:'cuba2_caixa',metas:'cuba2_metas'};
async function refresh(){
 try{
  const result=await Promise.all(Object.entries(tables).map(async([key,table])=>{
   const {data,error}=await sb.from(table).select('*').order(key==='produtos'?'nome':'data',{ascending:key==='produtos'}).limit(10000);
   if(error && key==='metas'){msg('Metas pendentes: execute operacao/02-metas.sql no Supabase.',true);return [key,[]]}; if(error)throw new Error(table+': '+error.message);
   return [key,data||[]];
  }));
  result.forEach(([k,v])=>dados[k]=v);render();msg('Dados atualizados.');
 }catch(e){msg('Não foi possível carregar. Execute o SQL da nova operação no Supabase. '+e.message,true)}
}
function render(){
 const vendas=dados.vendas.filter(v=>v.status==='concluida');
 const bruto=vendas.reduce((a,v)=>a+num(v.quantidade)*num(v.preco_unitario)-num(v.desconto),0);
 const acoes=dados.acoes;
 $('#kVendas').textContent=fmt(bruto);
 const familiaReal=acoes.filter(a=>a.moeda==='real'&&a.tipo_dinheiro==='limpo').reduce((a,x)=>a+num(x.valor_familia),0);
 $('#kAcoes').textContent=fmt(familiaReal)+' (limpo R$)';
 const saldo=dados.caixa.filter(x=>x.moeda==='real').reduce((a,x)=>a+(x.categoria==='saida'?-1:1)*num(x.valor),0);
 $('#kCaixa').textContent=fmt(saldo);
 $('#kStatus').textContent=[acoes.length,acoes.filter(x=>x.resultado==='sucesso').length,acoes.filter(x=>x.resultado==='red').length].join(' / ');
 $('#acaoRows').innerHTML=acoes.map(a=>'<tr><td>'+esc(a.data)+'</td><td>'+esc(a.nome)+'</td><td>'+esc(a.modalidade)+'</td><td>'+esc(a.resultado)+'</td><td>'+a.exitosos+'/'+a.participantes+'</td><td>'+fmt(a.valor_familia,a.moeda)+'</td><td>'+fmt(a.valor_integrantes,a.moeda)+'</td></tr>').join('');
 $('#produtoRows').innerHTML=dados.produtos.map(p=>'<tr><td>'+esc(p.nome)+'</td><td>'+esc(p.categoria)+'</td><td>'+fmt(p.preco_padrao)+'</td></tr>').join('');
 $('#produtoSelect').innerHTML=dados.produtos.filter(p=>p.ativo).map(p=>'<option value="'+p.id+'">'+esc(p.nome)+'</option>').join('');
 $('#vendaRows').innerHTML=dados.vendas.map(v=>'<tr><td>'+esc(v.data)+'</td><td>'+esc(dados.produtos.find(p=>p.id===v.produto_id)?.nome||'—')+'</td><td>'+v.quantidade+'</td><td>'+fmt(num(v.preco_unitario)*v.quantidade-num(v.desconto))+'</td><td>'+fmt(v.recebido)+'</td><td>'+esc(v.status)+'</td></tr>').join('');
 renderMetas(); $('#caixaRows').innerHTML=dados.caixa.map(c=>'<tr><td>'+esc(c.data)+'</td><td>'+esc(c.categoria)+'</td><td>'+esc(c.descricao)+'</td><td>'+esc(c.moeda)+'</td><td>'+fmt(c.valor,c.moeda)+'</td></tr>').join('');
}
function setField(f,name,value){f.elements[name].value=value}
function updateAction(){
 const f=$('#acaoForm'),res=f.elements.resultado.value,tot=num(f.elements.valor_total.value),dest=f.elements.destino.value;
 const red=res==='red';f.elements.destino.disabled=red;f.elements.valor_total.disabled=red;f.elements.valor_familia.disabled=red;
 if(red){setField(f,'exitosos',0);setField(f,'valor_integrantes',0);return}
 const qtd=Math.max(1,num(f.elements.participantes.value));
 if(res==='sucesso')setField(f,'exitosos',qtd);
 if(res==='sucesso_parcial'&&num(f.elements.exitosos.value)>=qtd)setField(f,'exitosos',Math.max(0,qtd-1));
 let familia=dest==='familia'?tot:dest==='integrantes'?0:Math.min(tot,Math.max(0,num(f.elements.valor_familia.value)));
 setField(f,'valor_familia',familia.toFixed(2));setField(f,'valor_integrantes',Math.max(0,tot-familia).toFixed(2));
 f.elements.valor_familia.readOnly=dest!=='parcial';
}
$('#acaoForm').addEventListener('input',updateAction);$('#acaoForm').addEventListener('change',updateAction);
function contentOf(f){return Object.fromEntries(new FormData(f).entries())}
async function insert(table,obj,form){
 try{
  const {error}=await sb.from(table).insert(obj);
  if(error)throw error;
  form.reset();if(form.id==='acaoForm')updateAction();for(const input of form.querySelectorAll('input[type=date]'))input.value=dateNow();
  msg('Registro salvo com sucesso.');await refresh()
 }catch(e){msg('Não foi possível salvar: '+e.message,true)}
}
$('#acaoForm').onsubmit=e=>{
 e.preventDefault();const f=e.target;const o=contentOf(f);const red=o.resultado==='red';
 const q=num(o.participantes),ok=red?0:num(o.exitosos),t=red?0:num(o.valor_total);
 const dest=red?'nenhum':o.destino, fam=red?0:dest==='familia'?t:dest==='integrantes'?0:num(o.valor_familia);
 if(q<1||ok<0||ok>q||((o.resultado==='sucesso')!==(ok===q))||(o.resultado==='sucesso_parcial'&&!(ok>0&&ok<q))||(!red&&!(t>=fam&&fam>=0))){msg('Confira participantes, resultado e divisão dos valores.',true);return}
 const payload={data:o.data,nome:o.nome.trim(),modalidade:o.modalidade,resultado:o.resultado,participantes:q,exitosos:ok,destino:dest,moeda:o.moeda,tipo_dinheiro:o.tipo_dinheiro,valor_total:t,valor_familia:fam,valor_integrantes:Math.round((t-fam)*100)/100,observacoes:o.observacoes};
 insert(tables.acoes,payload,f)
};
$('#produtoForm').onsubmit=e=>{e.preventDefault();const f=e.target,o=contentOf(f);insert(tables.produtos,{nome:o.nome.trim(),categoria:o.categoria.trim(),preco_padrao:num(o.preco_padrao)},f)};
$('#produtoSelect').onchange=()=>{const p=dados.produtos.find(x=>x.id===$('#produtoSelect').value);if(p)setField($('#vendaForm'),'preco_unitario',p.preco_padrao)};
$('#vendaForm').onsubmit=e=>{e.preventDefault();const f=e.target,o=contentOf(f);insert(tables.vendas,{data:o.data,produto_id:o.produto_id,quantidade:num(o.quantidade),preco_unitario:num(o.preco_unitario),desconto:num(o.desconto),recebido:num(o.recebido),status:o.status,observacoes:o.observacoes},f)};
$('#caixaForm').onsubmit=e=>{e.preventDefault();const f=e.target,o=contentOf(f);insert(tables.caixa,{data:o.data,categoria:o.categoria,moeda:o.moeda,valor:num(o.valor),descricao:o.descricao.trim()},f)};

function weekStart(str){
 const d=new Date(str+'T12:00:00');
 const offset=(d.getDay()+6)%7;
 d.setDate(d.getDate()-offset);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function metaAgg(){
 const grouped=new Map();
 for(const r of dados.metas){
  const semana=weekStart(r.data),key=[semana,r.grupo,r.membro.trim().toLocaleLowerCase('pt-BR')].join('||');
  if(!grouped.has(key))grouped.set(key,{semana,membro:r.membro,grupo:r.grupo,bunkers:0,lixos:0,valor:0,acoes:0,days:{},opcao:r.opcao_rush,opcoes:new Set()});
  const a=grouped.get(key);
  a.bunkers+=num(r.bunkers);a.lixos+=num(r.lixos);a.valor+=num(r.valor_entregue);
  a.acoes+=num(r.acoes_familia)+num(r.acoes_integrantes);
  a.days[r.data]??={familia:0,integrantes:0};
  a.days[r.data].familia+=num(r.acoes_familia);
  a.days[r.data].integrantes+=num(r.acoes_integrantes);
  if(r.opcao_rush)a.opcoes.add(r.opcao_rush);
 }
 return [...grouped.values()].sort((a,b)=>b.semana.localeCompare(a.semana)||a.membro.localeCompare(b.membro));
}
function rushFarmOK(x){
 const op=x.opcoes.size===1?[...x.opcoes][0]:null;
 return op==='4_bunkers'?x.bunkers>=4:op==='2_bunkers_2_lixos'?x.bunkers>=2&&x.lixos>=2:op==='4_lixos'?x.lixos>=4:false;
}
function renderMetas(){
 $('#metasRows').innerHTML=metaAgg().map(x=>{
  const financial=x.valor>=(x.grupo==='elite'?300000:200000);
  const farm=x.grupo==='rush'?(rushFarmOK(x)?'Meta alcançada':(x.opcoes.size>1?'Opções divergentes':'Pendente')):'Isento';
  // Elite: avaliar dias lançados, não inferir que um dia sem registro teve 0 atividades.
  const dayStates=Object.values(x.days);
  const daysOK=dayStates.filter(v=>v.familia>=2&&(v.familia+v.integrantes)>=3).length;
  const daily=x.grupo==='elite'?daysOK+'/'+dayStates.length+' dias registrados':'—';
  const status=x.grupo==='rush'?(financial&&rushFarmOK(x)?'Atingida':'Em andamento'):(financial&&dayStates.length>0&&daysOK===dayStates.length?'Em dia nos registros':'Em andamento');
  return '<tr><td>'+esc(x.semana)+'</td><td>'+esc(x.membro)+'</td><td>'+esc(x.grupo.toUpperCase())+'</td><td>'+esc(farm)+'</td><td>'+fmt(x.valor)+'</td><td>'+fmt(x.grupo==='elite'?300000:200000)+'</td><td>'+esc(daily)+'</td><td>'+esc(status)+'</td></tr>'
 }).join('')||'<tr><td colspan="8">Nenhum progresso cadastrado.</td></tr>';
}
function updateMetaForm(){
 const elite=$('#metaGrupo').value==='elite';
 for(const id of ['#metaOpcaoWrap','#metaBunkersWrap','#metaLixosWrap'])$(id).hidden=elite;
 for(const id of ['#metaAcaoFamiliaWrap','#metaAcaoIntWrap'])$(id).hidden=!elite;
}
$('#metaGrupo').onchange=updateMetaForm;
updateMetaForm();
$('#metaForm').onsubmit=e=>{
 e.preventDefault();const f=e.target,o=contentOf(f),elite=o.grupo==='elite';
 insert('cuba2_metas',{
  data:o.data,membro:o.membro.trim(),grupo:o.grupo,opcao_rush:elite?null:o.opcao_rush,
  bunkers:elite?0:num(o.bunkers),lixos:elite?0:num(o.lixos),
  valor_entregue:num(o.valor_entregue),
  acoes_familia:elite?num(o.acoes_familia):0,
  acoes_integrantes:elite?num(o.acoes_integrantes):0,
  observacoes:o.observacoes||null
 },f);
};

function report(){
 const start=$('#relInicio').value,end=$('#relFim').value,k=$('#relCategoria').value;
 if(!start||!end||start>end){msg('Informe um intervalo válido.',true);return}
 const range=items=>items.filter(x=>x.data>=start&&x.data<=end);
 const ac=range(dados.acoes),ve=range(dados.vendas),ca=range(dados.caixa),me=range(dados.metas);
 const familia=ac.reduce((s,x)=>s+num(x.valor_familia),0),integrantes=ac.reduce((s,x)=>s+num(x.valor_integrantes),0);
 const vendaTotal=ve.filter(x=>x.status==='concluida').reduce((s,x)=>s+num(x.quantidade)*num(x.preco_unitario)-num(x.desconto),0);
 const header={acoes:['Data','Ação','Modalidade','Resultado','Participantes','Sucessos','Moeda','Dinheiro','Família','Integrantes'],vendas:['Data','Produto','Quantidade','Preço','Desconto','Recebido','Status'],caixa:['Data','Categoria','Descrição','Moeda','Valor'],metas:['Data','Integrante','Grupo','Opção Rush','Bunkers','Lixos','Valor entregue','Ações família','Ações integrantes']};
 const rows={acoes:ac.map(x=>[x.data,x.nome,x.modalidade,x.resultado,x.participantes,x.exitosos,x.moeda,x.tipo_dinheiro,x.valor_familia,x.valor_integrantes]),vendas:ve.map(x=>[x.data,dados.produtos.find(p=>p.id===x.produto_id)?.nome||'',x.quantidade,x.preco_unitario,x.desconto,x.recebido,x.status]),caixa:ca.map(x=>[x.data,x.categoria,x.descricao,x.moeda,x.valor]),metas:me.map(x=>[x.data,x.membro,x.grupo,x.opcao_rush||'Isento',x.bunkers,x.lixos,x.valor_entregue,x.acoes_familia,x.acoes_integrantes])};
 relHeader=k==='geral'?['Seção','Indicador','Valor']:header[k];
 relLinhas=k==='geral'?[
  ['Ações','Quantidade',ac.length],['Ações','Fuga',ac.filter(x=>x.modalidade==='fuga').length],['Ações','Tiro',ac.filter(x=>x.modalidade==='tiro').length],
  ['Ações','Sucesso',ac.filter(x=>x.resultado==='sucesso').length],['Ações','Sucesso parcial',ac.filter(x=>x.resultado==='sucesso_parcial').length],['Ações','Red',ac.filter(x=>x.resultado==='red').length],
  ['Vendas','Total líquido em R$',vendaTotal],['Vendas','Quantidade concluída',ve.filter(x=>x.status==='concluida').reduce((s,x)=>s+num(x.quantidade),0)],
  ['Caixa','Saldo movimentado R$',ca.filter(x=>x.moeda==='real').reduce((s,x)=>s+num(x.valor)*(x.categoria==='saida'?-1:1),0)],
  ['Caixa','Saldo movimentado US$',ca.filter(x=>x.moeda==='dolar').reduce((s,x)=>s+num(x.valor)*(x.categoria==='saida'?-1:1),0)],
  ['Ações','Receita destinada à família (todas moedas, NÃO somável)', 'Ver detalhamento por moeda e tipo'],
  ['Metas','Lançamentos de progresso',me.length],['Metas','Valor entregue registrado',me.reduce((t,x)=>t+num(x.valor_entregue),0)],
 ]:rows[k];
 if(k==='geral'){
  for(const moeda of ['real','dolar'])for(const tipo of ['limpo','sujo']){
   relLinhas.push(['Ações','Destinado à família • '+moeda+' '+tipo,ac.filter(x=>x.moeda===moeda&&x.tipo_dinheiro===tipo).reduce((s,x)=>s+num(x.valor_familia),0)]);
   relLinhas.push(['Ações','Destinado aos integrantes • '+moeda+' '+tipo,ac.filter(x=>x.moeda===moeda&&x.tipo_dinheiro===tipo).reduce((s,x)=>s+num(x.valor_integrantes),0)]);
  }
 }
 $('#relConteudo').innerHTML='<p>Período: '+esc(start)+' a '+esc(end)+' | Gerado por: '+esc(profile.nome)+'</p><div class="scroll"><table><thead><tr>'+relHeader.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+relLinhas.map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 msg('Relatório gerado para '+esc(profile.nome)+'.');
}
$('#gerarRel').onclick=report;
$('#imprimirRel').onclick=()=>{if(!relLinhas.length)report();window.print()};
$('#csvRel').onclick=()=>{
 if(!relLinhas.length)report();
 const line=r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';');
 const csv='\ufeff'+[relHeader,...relLinhas].map(line).join('\r\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='cuba-relatorio-'+$('#relInicio').value+'-'+$('#relFim').value+'.csv';a.click();URL.revokeObjectURL(a.href)
};
for(const input of $$('input[type=date]'))input.value=dateNow();
$('#relInicio').value='2026-11-12';
updateAction();auth();
