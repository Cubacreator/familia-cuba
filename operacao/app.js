const cfg=window.CUBA_CONFIG;
const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const fmt=(v,c='real')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:c==='dolar'?'USD':'BRL'}).format(Number(v)||0);
// Tabela oficial aprovada pela liderança. Preço fixo por unidade, sem desconto por quantidade.
const precosOficiais={
 'micro smg':{real:35000,dolar:31000},
 'mtar':{real:60000,dolar:54500},
 'mp7':{real:55000,dolar:50000},
 'lançador de granadas':{real:30000,dolar:27000}
};
const normalizarNome=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const precoProduto=(nome,moeda)=>Object.entries(precosOficiais).find(([n])=>normalizarNome(n)===normalizarNome(nome))?.[1]?.[moeda];
function atualizarPrecoVenda(){
 const f=$('#vendaForm'),p=dados.produtos.find(x=>x.id===f.elements.produto_id.value);
 const real=p?precoProduto(p.nome,'real'):undefined;
 const dolar=p?precoProduto(p.nome,'dolar'):undefined;
 const preco=p?precoProduto(p.nome,f.elements.moeda.value):undefined;
 const qtd=Math.max(1,num(f.elements.quantidade.value));
 f.elements.preco_unitario.value=preco??'';
 f.elements.desconto.value='0';
 $('#vendaTotalReal').value=real==null?'':fmt(real*qtd,'real');
 $('#vendaTotalDolar').value=dolar==null?'':fmt(dolar*qtd,'dolar');
 const info=$('#precoVendaInfo');
 if(info)info.textContent=preco===undefined?'Produto sem preço oficial.':'Total em reais: '+fmt(real*qtd,'real')+' | Total em dólares: '+fmt(dolar*qtd,'dolar')+' | Pagamento escolhido: '+fmt(preco*qtd,f.elements.moeda.value);
}
const dateNow=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const num=v=>Number(v)||0;
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
let dados={acoes:[],produtos:[],vendas:[],metas:[],integrantes:[],metas_semanais:[]},profile=null,relLinhas=[],relHeader=[];
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
const sidebarToggle=$('#toggleSidebar');
function setSidebarCollapsed(collapsed){
 $('#app').classList.toggle('sidebar-collapsed',collapsed);
 sidebarToggle.textContent=collapsed?'❯':'❮';
 sidebarToggle.setAttribute('aria-expanded',String(!collapsed));
 sidebarToggle.setAttribute('aria-label',collapsed?'Expandir menu lateral':'Minimizar menu lateral');
 sidebarToggle.title=collapsed?'Expandir menu':'Minimizar menu';
 $('nav button,nav a.fablink').forEach(el=>{el.title=el.querySelector('.nav-label')?.textContent.trim()||el.textContent.trim()});
}
sidebarToggle.onclick=()=>setSidebarCollapsed(!$('#app').classList.contains('sidebar-collapsed'));

$$('nav button').forEach(b=>b.onclick=()=>{$$('nav button').forEach(x=>x.classList.toggle('active',x===b));$$('.tab').forEach(x=>x.classList.toggle('active',x.id===b.dataset.tab));$('#titulo').textContent=b.textContent.trim()});
const tables={acoes:'cuba2_acoes',produtos:'cuba2_produtos',vendas:'cuba2_vendas',integrantes:'cuba2_integrantes',metas_semanais:'cuba2_metas_semanais'};
async function refresh(){
 let missingExtras=false;
 try{
  const result=await Promise.all(Object.entries(tables).map(async([key,table])=>{
   const {data,error}=await sb.from(table).select('*').order(['produtos','integrantes'].includes(key)?'nome':key==='metas_semanais'?'semana_inicio':'data',{ascending:key==='produtos'}).limit(10000);
   if(error && ['integrantes','metas_semanais'].includes(key)){missingExtras=true;return [key,[]]}; if(error)throw new Error(table+': '+error.message);
   return [key,data||[]];
  }));
  result.forEach(([k,v])=>dados[k]=v);render();
  const semProdutos=!dados.produtos.some(p=>p.ativo&&precoProduto(p.nome,'real')!==undefined);
  msg(semProdutos?'Nenhum armamento oficial cadastrado no Supabase. Execute operacao/05-precos-oficiais.sql para liberar as vendas.':missingExtras?'Cadastro e metas aguardam o SQL 03 no Supabase. As outras áreas continuam disponíveis.':'Dados atualizados.',semProdutos||missingExtras);
 }catch(e){msg('Não foi possível carregar. Execute o SQL da nova operação no Supabase. '+e.message,true)}
}
function render(){
 const vendas=dados.vendas.filter(v=>v.status==='concluida');
 const totaisVendas=Object.fromEntries(['real','dolar'].map(m=>[m,vendas.filter(v=>(v.moeda||'real')===m).reduce((a,v)=>a+num(v.quantidade)*num(v.preco_unitario)-num(v.desconto),0)]));
 const acoes=dados.acoes;
 $('#kVendas').textContent=fmt(totaisVendas.real)+' / '+fmt(totaisVendas.dolar,'dolar');
 const familiaReal=acoes.filter(a=>a.moeda==='real').reduce((a,x)=>a+num(x.valor_familia),0);
 const familiaDolar=acoes.filter(a=>a.moeda==='dolar').reduce((a,x)=>a+num(x.valor_familia),0);$('#kAcoes').textContent=fmt(familiaReal)+' / '+fmt(familiaDolar,'dolar');
 $('#kStatus').textContent=[acoes.length,acoes.filter(x=>x.resultado==='sucesso').length,acoes.filter(x=>x.resultado==='red').length].join(' / ');
 $('#acaoRows').innerHTML=acoes.map(a=>'<tr><td>'+esc(a.data)+'</td><td>'+esc(a.nome)+'</td><td>'+esc(a.modalidade)+'</td><td>'+esc(a.resultado)+'</td><td>'+a.exitosos+'/'+a.participantes+'</td><td>'+fmt(a.valor_familia,a.moeda)+'</td><td>'+fmt(a.valor_integrantes,a.moeda)+'</td><td>'+(a.valor_perdido==null?'—':fmt(a.valor_perdido,a.moeda))+'</td></tr>').join('');
 $('#produtoRows').innerHTML=dados.produtos.map(p=>'<tr><td>'+esc(p.nome)+'</td><td>'+esc(p.categoria)+'</td><td>'+fmt(p.preco_padrao)+'</td></tr>').join('');
 const disponiveis=dados.produtos.filter(p=>p.ativo&&precoProduto(p.nome,'real')!==undefined);
 $('#produtoSelect').innerHTML=disponiveis.length?disponiveis.map(p=>'<option value="'+p.id+'">'+esc(p.nome)+'</option>').join(''):'<option value="">Nenhum armamento cadastrado — execute SQL 05</option>';
 atualizarPrecoVenda();
$('#vendaRows').innerHTML=dados.vendas.map(v=>{const p=dados.produtos.find(x=>x.id===v.produto_id),nome=p?.nome||'—',q=num(v.quantidade),pr=precoProduto(nome,'real'),pd=precoProduto(nome,'dolar');return '<tr><td>'+esc(v.data)+'</td><td>'+esc(v.familia_compradora||'—')+'</td><td>'+esc(nome)+'</td><td>'+q+'</td><td>'+(pr===undefined?'—':fmt(pr*q,'real'))+'</td><td>'+(pd===undefined?'—':fmt(pd*q,'dolar'))+'</td><td>'+esc(v.moeda||'real')+'</td><td>'+fmt(q*num(v.preco_unitario)-num(v.desconto),v.moeda||'real')+'</td><td>'+esc(v.status)+'</td></tr>'}).join('');
  renderIntegrantes();renderMetas();
}
function setField(f,name,value){f.elements[name].value=value}
function updateAction(){
 const f=$('#acaoForm'),res=f.elements.resultado.value,tot=num(f.elements.valor_total.value),dest=f.elements.destino.value;
 const red=res==='red';
 $$('.acao-recompensa').forEach(el=>el.hidden=red);
 $('#acaoPerdaBox').hidden=!red;
 f.elements.exitosos.disabled=red;
 if(red){
  setField(f,'exitosos',0);
  setField(f,'valor_total',0);
  setField(f,'valor_familia',0);
  setField(f,'valor_integrantes',0);
  return;
 }
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
 const perdaTexto=f.elements.valor_perdido.value.trim();
  const valor_perdido=red&&perdaTexto!==''?Number(perdaTexto):null;
  if(red&&valor_perdido!==null&&(!Number.isFinite(valor_perdido)||valor_perdido<0)){msg('Informe um valor perdido válido ou deixe o campo vazio.',true);return}
  const payload={data:o.data,nome:o.nome.trim(),modalidade:o.modalidade,resultado:o.resultado,participantes:q,exitosos:ok,destino:dest,moeda:o.moeda,tipo_dinheiro:'sujo',valor_total:t,valor_familia:fam,valor_integrantes:Math.round((t-fam)*100)/100,valor_perdido,observacoes:o.observacoes};
 insert(tables.acoes,payload,f)
};
$('#produtoForm').onsubmit=e=>{e.preventDefault();const f=e.target,o=contentOf(f);insert(tables.produtos,{nome:o.nome.trim(),categoria:o.categoria.trim(),preco_padrao:num(o.preco_padrao)},f)};
$('#vendaForm').elements.produto_id.addEventListener('change',atualizarPrecoVenda);
$('#vendaForm').elements.moeda.addEventListener('change',atualizarPrecoVenda);
$('#vendaForm').elements.quantidade.addEventListener('input',atualizarPrecoVenda);
$('#vendaForm').onsubmit=e=>{
 e.preventDefault();const f=e.target,o=contentOf(f),p=dados.produtos.find(x=>x.id===o.produto_id);
 const preco=p?precoProduto(p.nome,o.moeda):undefined;
 if(preco===undefined){msg('Produto sem preço oficial cadastrado.',true);return}
 const q=num(o.quantidade);
 if(!String(o.familia_compradora||'').trim()){msg('Informe a família compradora.',true);return}
 if(!Number.isInteger(q)||q<1){msg('Confira a quantidade.',true);return}
 insert(tables.vendas,{data:o.data,produto_id:o.produto_id,familia_compradora:String(o.familia_compradora||'').trim(),quantidade:q,moeda:o.moeda,preco_unitario:preco,desconto:0,recebido:o.status==='cancelada'?0:q*preco,status:o.status,observacoes:o.observacoes},f)
};


function isoDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function nextDate(iso,days){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+days);return isoDate(d)}
function mondayDate(iso){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return isoDate(d)}
function preencherSemanas(){
 const mes=$('#metaMes').value||dateNow().slice(0,7);
 const [ano,month]=mes.split('-').map(Number);
 if(!ano||!month)return;
 const select=$('#metaSemana'),old=select.value,first=mes+'-01';
 const ultimo=isoDate(new Date(ano,month,0));
 let monday=mondayDate(first),opts=[];
 while(monday<=ultimo){
  const sunday=nextDate(monday,6);
  if(monday>='2026-11-09')opts.push({value:monday,label:monday.split('-').reverse().join('/')+' a '+sunday.split('-').reverse().join('/')});
  monday=nextDate(monday,7);
 }
 select.innerHTML=opts.map(o=>'<option value="'+o.value+'">'+esc(o.label)+'</option>').join('');
 const todayMonday=mondayDate(dateNow());
 select.value=opts.some(o=>o.value===old)?old:(opts.some(o=>o.value===todayMonday)?todayMonday:opts[0]?.value||'');
}
function semanaSelecionada(){
 const semana_inicio=$('#metaSemana').value||mondayDate(dateNow());
 return {semana_inicio,intervalo:{start:semana_inicio,end:nextDate(semana_inicio,6),vencimento:nextDate(semana_inicio,7)}};
}
function membrosNaSemana(){
 const filtro=semanaSelecionada();
 if(!filtro.intervalo)return [];
 return dados.integrantes.filter(x=>x.data_entrada<=filtro.intervalo.end && (!x.data_saida||x.data_saida>=filtro.intervalo.start)).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
}
function statusPadrao(cargo,tipo){
 return 'nao_conferido';
}
function registroSemana(id){const {semana_inicio}=semanaSelecionada();return dados.metas_semanais.find(x=>x.integrante_id===id&&x.semana_inicio===semana_inicio)}
function renderIntegrantes(){
 $('#integrantesRows').innerHTML=dados.integrantes.slice().sort((a,b)=>Number(b.ativo)-Number(a.ativo)||a.nome.localeCompare(b.nome,'pt-BR')).map(m=>
 '<tr><td>'+esc(m.nome)+'</td><td><select aria-label="Cargo de '+esc(m.nome)+'" data-member-role="'+esc(m.id)+'"><option value="membro"'+(m.cargo==='membro'?' selected':'')+'>Membro</option><option value="rush"'+(m.cargo==='rush'?' selected':'')+'>Rush</option><option value="elite"'+(m.cargo==='elite'?' selected':'')+'>Elite</option></select></td><td>'+esc(m.data_entrada)+'</td><td>'+(m.ativo?'Ativo':'Desativado')+'</td><td><button class="secondary" data-member-save="'+esc(m.id)+'">Salvar cargo</button> <button class="secondary" data-member-toggle="'+esc(m.id)+'">'+(m.ativo?'Desativar':'Reativar')+'</button></td></tr>'
 ).join('')||'<tr><td colspan="5">Nenhum integrante cadastrado.</td></tr>';
}
async function atualizarIntegrante(id,changes){
 try{const {error}=await sb.from('cuba2_integrantes').update(changes).eq('id',id);if(error)throw error;await refresh();msg('Cadastro atualizado. Histórico preservado.')}catch(e){msg('Não foi possível atualizar: '+e.message,true)}
}
$('#integranteForm').onsubmit=e=>{
 e.preventDefault();const f=e.target,o=contentOf(f);
 insert('cuba2_integrantes',{nome:o.nome.trim(),cargo:o.cargo,data_entrada:o.data_entrada},f)
};
$('#integrantesRows').onclick=e=>{
 const save=e.target.closest('[data-member-save]'),toggle=e.target.closest('[data-member-toggle]');
 if(save){const id=save.dataset.memberSave,select=[...$$('[data-member-role]')].find(x=>x.dataset.memberRole===id);if(select)atualizarIntegrante(id,{cargo:select.value});return}
 if(toggle){
  const m=dados.integrantes.find(x=>x.id===toggle.dataset.memberToggle);if(!m)return;
  if(!confirm((m.ativo?'Desativar':'Reativar')+' '+m.nome+'? Os registros antigos serão preservados.'))return;
  atualizarIntegrante(m.id,{ativo:!m.ativo,data_saida:m.ativo?dateNow():null})
 }
};
function metaLinhas(){
 return membrosNaSemana().map(m=>{
  const reg=registroSemana(m.id);
  const salvo=reg?.dinheiro_status||'nao_conferido';
  return {m,reg,dinheiro:m.cargo==='membro'&&salvo==='isento'?'nao_conferido':salvo};
 });
}
function optionsStatus(valor,cargo){
 const vals=[['nao_conferido','Não conferido'],['pago','Pago'],['pendente','Devendo']];
 if(cargo!=='membro')vals.push(['isento','Isento']);
 return '<select aria-label="Status da meta de dinheiro">'+vals.map(([v,l])=>'<option value="'+v+'"'+(valor===v?' selected':'')+'>'+l+'</option>').join('')+'</select>';
}
function renderMetas(){
 const {intervalo}=semanaSelecionada(),linhas=metaLinhas();
 const paid=linhas.filter(x=>x.dinheiro==='pago').length;
 const debt=linhas.filter(x=>x.dinheiro==='pendente').length;
 const unknown=linhas.filter(x=>x.dinheiro==='nao_conferido').length;
 $('#metaResumo').innerHTML='<span><b>Dinheiro</b> • '+paid+' pagos • '+debt+' devendo • '+unknown+' não conferidos</span>';
 $('#metasRows').innerHTML=linhas.map(({m,reg,dinheiro})=>'<tr data-meta-id="'+esc(m.id)+'"><td>'+esc(m.nome)+'</td><td>'+esc(m.cargo)+'</td><td>'+optionsStatus(dinheiro,m.cargo)+'</td><td><input aria-label="Observação" value="'+esc(reg?.observacoes||'')+'" maxlength="500"></td><td><button data-save-meta="'+esc(m.id)+'" class="secondary">Salvar</button></td></tr>').join('')||'<tr><td colspan="5">Nenhum integrante cadastrado nesse período.</td></tr>';
 const lista=st=>linhas.filter(x=>x.dinheiro===st).map(x=>x.m.nome).sort((a,b)=>a.localeCompare(b,'pt-BR')).join(', ')||'Nenhum';
 $('#metaNomes').innerHTML='<h4>Meta em dinheiro</h4><p><b>Pagaram:</b> '+esc(lista('pago'))+'</p><p><b>Devendo:</b> '+esc(lista('pendente'))+'</p><p><b>Não conferidos:</b> '+esc(lista('nao_conferido'))+'</p><p class="hint">Período: '+esc(intervalo?.start||'—')+' até '+esc(intervalo?.end||'—')+'. Vencimento: '+esc(intervalo?.vencimento||'—')+'. Registros de integrantes antigos continuam preservados.</p>';
}
$('#metaMes').onchange=()=>{preencherSemanas();renderMetas()};
$('#metaSemana').onchange=renderMetas;
$('#metaFiltrar').onclick=renderMetas;
$('#metasRows').onclick=async e=>{
 const btn=e.target.closest('[data-save-meta]');if(!btn)return;
 const row=btn.closest('tr'),id=btn.dataset.saveMeta;
 const m=dados.integrantes.find(x=>x.id===id);if(!m)return;
 const dinheiro_status=row.querySelector('select')?.value;
 const observacoes=row.querySelector('input')?.value.trim()||'';
 const {semana_inicio}=semanaSelecionada();
 if(!semana_inicio||!dinheiro_status){msg('Selecione uma semana e um status válido.',true);return}
 if(m.cargo==='membro'&&dinheiro_status==='isento'){msg('Membros não podem ser isentos da meta em dinheiro.',true);return}
 const payload={integrante_id:id,semana_inicio,dinheiro_status,observacoes,atualizado_em:new Date().toISOString()};
 try{
  const {error}=await sb.from('cuba2_metas_semanais').upsert(payload,{onConflict:'integrante_id,semana_inicio'});
  if(error)throw error;
  await refresh();msg('Meta em dinheiro salva para '+m.nome+'.');
 }catch(ex){msg('Não foi possível salvar a meta: '+ex.message,true)}
};

function report(){
 const start=$('#relInicio').value,end=$('#relFim').value,k=$('#relCategoria').value;
 if(!start||!end||start>end){msg('Informe um intervalo válido.',true);return}
 const range=items=>items.filter(x=>x.data>=start&&x.data<=end);
 const ac=range(dados.acoes),ve=range(dados.vendas);
 const me=metaLinhas();
 const familia=ac.reduce((s,x)=>s+num(x.valor_familia),0),integrantes=ac.reduce((s,x)=>s+num(x.valor_integrantes),0);
 const vendaTotal=Object.fromEntries(['real','dolar'].map(m=>[m,ve.filter(x=>x.status==='concluida'&&(x.moeda||'real')===m).reduce((s,x)=>s+num(x.quantidade)*num(x.preco_unitario)-num(x.desconto),0)]));
 const header={acoes:['Data','Ação','Modalidade','Resultado','Participantes','Sucessos','Moeda','Dinheiro','Família','Integrantes','Valor perdido'],vendas:['Data','Família compradora','Produto','Quantidade','Total R$ (preços atuais)','Total US$ (preços atuais)','Moeda paga','Valor da venda','Status'],metas:['Semana','Integrante','Cargo','Dinheiro','Observação']};
 const rows={acoes:ac.map(x=>[x.data,x.nome,x.modalidade,x.resultado,x.participantes,x.exitosos,x.moeda,x.tipo_dinheiro,x.valor_familia,x.valor_integrantes,x.valor_perdido??'']),vendas:ve.map(x=>{const n=dados.produtos.find(p=>p.id===x.produto_id)?.nome||'';const r=precoProduto(n,'real'),d=precoProduto(n,'dolar');return [x.data,x.familia_compradora||'',n,x.quantidade,r===undefined?'':r*x.quantidade,d===undefined?'':d*x.quantidade,x.moeda||'real',x.quantidade*x.preco_unitario-x.desconto,x.status]}),metas:me.map(x=>[semanaSelecionada().intervalo.start+' a '+semanaSelecionada().intervalo.end+' (vence '+semanaSelecionada().intervalo.vencimento+')',x.m.nome,x.m.cargo,x.dinheiro,x.reg?.observacoes||''])};
 relHeader=k==='geral'?['Seção','Indicador','Valor']:header[k];
 relLinhas=k==='geral'?[
  ['Ações','Quantidade',ac.length],['Ações','Fuga',ac.filter(x=>x.modalidade==='fuga').length],['Ações','Tiro',ac.filter(x=>x.modalidade==='tiro').length],
  ['Ações','Sucesso',ac.filter(x=>x.resultado==='sucesso').length],['Ações','Sucesso parcial',ac.filter(x=>x.resultado==='sucesso_parcial').length],['Ações','Red',ac.filter(x=>x.resultado==='red').length],
  ['Vendas','Total líquido em R$',vendaTotal.real],['Vendas','Total líquido em US$',vendaTotal.dolar],['Vendas','Quantidade concluída',ve.filter(x=>x.status==='concluida').reduce((s,x)=>s+num(x.quantidade),0)],
  ['Ações','Receita destinada à família (dinheiro sujo)', 'Ver detalhamento por moeda'],
   ['Ações','Reds com valor perdido informado',ac.filter(x=>x.resultado==='red'&&x.valor_perdido!=null).length],
  ['Metas','Integrantes conferidos na semana selecionada',me.filter(x=>x.dinheiro!=='nao_conferido').length],['Metas','Devendo dinheiro (semana selecionada)',me.filter(x=>x.dinheiro==='pendente').length],
 ]:rows[k];
 if(k==='geral'){
  for(const moeda of ['real','dolar']){const tipo='sujo';
   relLinhas.push(['Ações','Valor perdido em reds • '+moeda,ac.filter(x=>x.resultado==='red'&&x.moeda===moeda).reduce((sum,x)=>sum+num(x.valor_perdido),0)]);
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
for(const input of $('input[type=date]'))input.value=dateNow();
$('#metaMes').value=dateNow().slice(0,7);preencherSemanas();

$('#relInicio').value='2026-11-12';
updateAction();auth();
