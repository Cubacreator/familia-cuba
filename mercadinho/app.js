const cfg=window.CUBA_CONFIG;
if(!cfg)throw new Error("Configuração do Supabase não encontrada.");
const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const br=v=>Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:2});
const dt=v=>v?new Date(v).toLocaleString("pt-BR"):"—";
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)};

let SESSION={type:null,token:null,nome:null,cargo:null,admin:false};
let MARKET_ITEMS=[],ADMIN_ITEMS=[],ACCESSES=[],MOVES=[],MY_MOVES=[];
let ITEM_IMAGE_PATHS={};

function emailFromPassport(p){return String(p).trim()+"@cuba.local"}
function memberToken(){return localStorage.getItem("cuba_market_token")||null}

async function rpc(name,args={}){
  const {data,error}=await sb.rpc(name,args);
  if(error)throw error;
  return data;
}

async function login(passaporte,senha){
  await sb.auth.signOut();
  localStorage.removeItem("cuba_market_token");

  // Primeiro tenta o login gerencial existente.
  const auth=await sb.auth.signInWithPassword({email:emailFromPassport(passaporte),password:senha});
  if(!auth.error){
    try{
      const ctx=await rpc("mercado_admin_contexto");
      const row=Array.isArray(ctx)?ctx[0]:ctx;
      if(row?.nome){
        SESSION={type:"admin",token:null,nome:row.nome,cargo:row.cargo||"Gerência",admin:true};
        return true;
      }
    }catch(_){}
    await sb.auth.signOut();
  }

  // Se não for gerência, tenta o acesso próprio do Mercadinho.
  const data=await rpc("mercado_login",{p_passaporte:String(passaporte).trim(),p_senha:senha});
  const row=Array.isArray(data)?data[0]:data;
  if(!row?.token)throw new Error("Acesso inválido.");
  localStorage.setItem("cuba_market_token",row.token);
  SESSION={type:"member",token:row.token,nome:row.nome,cargo:"Membro",admin:false};
  return true;
}

async function restoreSession(){
  const {data:{session}}=await sb.auth.getSession();
  if(session){
    try{
      const ctx=await rpc("mercado_admin_contexto");
      const row=Array.isArray(ctx)?ctx[0]:ctx;
      if(row?.nome){
        SESSION={type:"admin",token:null,nome:row.nome,cargo:row.cargo||"Gerência",admin:true};
        return true;
      }
    }catch(_){}
  }

  const token=memberToken();
  if(token){
    try{
      const data=await rpc("mercado_validar_sessao",{p_token:token});
      const row=Array.isArray(data)?data[0]:data;
      if(row?.nome){
        SESSION={type:"member",token,nome:row.nome,cargo:"Membro",admin:false};
        return true;
      }
    }catch(_){}
  }
  return false;
}

async function logout(){
  if(SESSION.type==="member"&&SESSION.token){
    try{await rpc("mercado_logout",{p_token:SESSION.token})}catch(_){}
  }
  await sb.auth.signOut();
  localStorage.removeItem("cuba_market_token");
  location.reload();
}

function applySessionUI(){
  $("#loginScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#whoName").textContent=SESSION.nome;
  $("#whoRole").textContent=SESSION.cargo;
  $$(".adminOnly").forEach(x=>x.classList.toggle("hidden",!SESSION.admin));
  $$(".memberOnly").forEach(x=>x.classList.toggle("hidden",SESSION.admin));
  page("mercado");
}

const PAGE_TEXT={
  mercado:["Mercado","Retire itens disponíveis no estoque da família."],
  minhas:["Minhas retiradas","Seu histórico pessoal de retiradas."],
  bau:["Controle de Baú","Quantidade atual de cada item do Mercadinho."],
  acessos:["Acessos","Crie e exclua logins dos membros."],
  movimentos:["Movimentos","Histórico de entradas, retiradas e ajustes."]
};
function page(id){
  if(!SESSION.admin&&["minhas","bau","acessos","movimentos"].includes(id))id="mercado";
  if(SESSION.admin&&id==="minhas")id="mercado";
  $$(".page").forEach(p=>p.classList.toggle("on",p.id===id));
  $$(".navBtn").forEach(b=>b.classList.toggle("on",b.dataset.page===id));
  $("#pageTitle").textContent=PAGE_TEXT[id][0];
  $("#pageSubtitle").textContent=PAGE_TEXT[id][1];
}
$$(".navBtn").forEach(b=>b.onclick=()=>page(b.dataset.page));

function openModal(id){$("#"+id).classList.add("on")}
function closeModal(id){$("#"+id).classList.remove("on")}
$$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.closest(".modal").id));
$$(".modal").forEach(m=>m.onclick=e=>{if(e.target===m)closeModal(m.id)});

async function loadMarket(){
  MARKET_ITEMS=await rpc("mercado_listar_itens",{p_token:SESSION.token});
  await loadItemImages();
  renderMarket();

  if(SESSION.admin){
    await Promise.all([loadAdminItems(),loadAccesses(),loadMoves(),loadMemberSuggestions()]);
  }
}

async function loadItemImages(){
  try{
    const rows=await rpc("mercado_listar_imagens_publicas");
    ITEM_IMAGE_PATHS=Object.fromEntries((rows||[]).map(x=>[x.item_id,x.imagem_path]));
  }catch(_){
    ITEM_IMAGE_PATHS={};
  }
}
async function loadAdminItems(){
  ADMIN_ITEMS=await rpc("mercado_admin_listar_itens");
  renderStock();
}
async function loadAccesses(){
  ACCESSES=await rpc("mercado_listar_acessos");
  renderAccesses();
}
async function loadMoves(){
  MOVES=await rpc("mercado_admin_listar_movimentos",{p_limite:200});
  renderMoves();
}
async function loadMemberSuggestions(){
  const rows=await rpc("mercado_admin_listar_membros");
  $("#membersSuggestions").innerHTML=(rows||[]).map(x=>`<option value="${esc(x.nome)}">${esc(x.passaporte||"")}</option>`).join("");
}

function renderMarket(){
  const q=($("#marketSearch").value||"").trim().toLowerCase();
  const rows=(MARKET_ITEMS||[]).filter(x=>!q||String(x.nome).toLowerCase().includes(q));
  $("#marketGrid").innerHTML=rows.length?rows.map(x=>`
    <article class="productCard">
      <h3>${esc(x.nome)}</h3>
      <p>${esc(x.descricao||"Sem descrição.")}</p>
      <div class="state">
        <span class="stockState ${x.disponivel?"":"out"}">${x.disponivel?"Disponível":"Sem estoque"}</span>
        <button class="btn primary" ${x.disponivel?"":"disabled"} onclick="openWithdraw('${x.id}','${esc(x.nome).replace(/'/g,"&#039;")}')">Retirar</button>
      </div>
    </article>`).join(""):`<div class="empty">Nenhum item encontrado.</div>`;
}
$("#marketSearch").oninput=renderMarket;

function openWithdraw(id,nome){
  const f=$("#withdrawForm");f.reset();
  f.elements.item_id.value=id;f.elements.item_nome.value=nome;f.elements.quantidade.value=1;
  openModal("withdrawModal");
}
window.openWithdraw=openWithdraw;

$("#withdrawForm").onsubmit=async e=>{
  e.preventDefault();
  const f=e.target,q=Number(f.elements.quantidade.value);
  if(!(q>0))return;
  if(!confirm(`Confirmar retirada de ${br(q)} unidade(s) de ${f.elements.item_nome.value}?`))return;
  try{
    await rpc("mercado_retirar_item",{p_token:SESSION.token,p_item_id:f.elements.item_id,p_quantidade:q});
    closeModal("withdrawModal");
    toast("Retirada registrada.");
    await loadMarket();
  }catch(ex){alert(ex.message)}
};

function renderMyMoves(){
  $("#myMovesTable").innerHTML=(MY_MOVES||[]).length?MY_MOVES.map(x=>`
    <tr><td>${dt(x.created_at)}</td><td>${esc(x.item_nome)}</td><td>${br(Math.abs(Number(x.quantidade||0)))}</td></tr>`
  ).join(""):`<tr><td colspan="3" class="empty">Você ainda não realizou retiradas.</td></tr>`;
}

function renderStock(){
  const rows=ADMIN_ITEMS||[];
  $("#stockItemCount").textContent=rows.length;
  $("#stockTotal").textContent=br(rows.reduce((s,x)=>s+Number(x.estoque||0),0));
  $("#stockEmpty").textContent=rows.filter(x=>Number(x.estoque||0)<=0).length;
  $("#stockTable").innerHTML=rows.length?rows.map(x=>`
    <tr>
      <td><b>${esc(x.nome)}</b></td>
      <td><b>${br(x.estoque)}</b></td>
      <td>${esc(x.descricao||"—")}</td>
      <td>
        <button class="mini" onclick="openStock('${x.id}','${esc(x.nome).replace(/'/g,"&#039;")}')">Estoque</button>
        <button class="mini" onclick="openItemImage('${x.id}','${esc(x.nome).replace(/'/g,"&#039;")}')">${ITEM_IMAGE_PATHS[x.id]?"Trocar imagem":"Adicionar imagem"}</button>
        <button class="mini red" onclick="disableItem('${x.id}','${esc(x.nome).replace(/'/g,"&#039;")}')">Excluir</button>
      </td>
    </tr>`).join(""):`<tr><td colspan="4" class="empty">Nenhum item cadastrado.</td></tr>`;
}
$("#newItemBtn").onclick=()=>{$("#itemForm").reset();$("#itemForm").elements.estoque.value=0;openModal("itemModal")};

$("#itemForm").onsubmit=async e=>{
  e.preventDefault();
  const f=e.target;
  const itemName=f.elements.nome.value.trim();
  const file=f.elements.imagem.files[0];
  const imageError=validateItemImage(file);
  if(imageError){alert(imageError);return;}
  try{
    await rpc("mercado_admin_criar_item",{
      p_nome:itemName,
      p_descricao:f.elements.descricao.value.trim()||null,
      p_estoque_inicial:Number(f.elements.estoque.value||0)
    });
  }catch(error){
    alert(error.message);
    return;
  }

  if(file){
    try{
      await loadAdminItems();
      const item=ADMIN_ITEMS.find(x=>String(x.nome).trim()===itemName);
      if(!item)throw new Error("O item foi criado, mas não consegui localizar seu cadastro para anexar a imagem.");
      await storeItemImage(item.id,file,null);
    }catch(error){
      closeModal("itemModal");
      try{await loadMarket()}catch(_){}
      alert("O item foi criado, mas a imagem não foi salva: "+(error.message||"tente novamente."));
      return;
    }
  }

  closeModal("itemModal");
  toast(file?"Item e imagem salvos.":"Item criado.");
  try{await loadMarket()}catch(error){alert("Item salvo, mas a tela não atualizou: "+error.message)}
};

function openItemImage(id,nome){
  const f=$("#imageForm");f.reset();
  f.elements.item_id.value=id;
  f.elements.item_nome.value=nome;
  openModal("imageModal");
}
window.openItemImage=openItemImage;

function optimizeItemImage(file){
  return new Promise((resolve,reject)=>{
    const objectUrl=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>{
      const maxSide=720;
      const ratio=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
      canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
      const finish=blob=>{
        URL.revokeObjectURL(objectUrl);
        if(blob)resolve(blob);
        else reject(new Error("Não foi possível processar essa imagem."));
      };
      canvas.toBlob(blob=>{
        if(blob)finish(blob);
        else canvas.toBlob(finish,"image/jpeg",0.84);
      },"image/webp",0.84);
    };
    image.onerror=()=>{
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível abrir essa imagem."));
    };
    image.src=objectUrl;
  });
}

function validateItemImage(file){
  if(!file)return null;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type))return "Escolha uma imagem PNG, JPG ou WebP.";
  if(file.size>10*1024*1024)return "A imagem original precisa ter até 10 MB.";
  return null;
}

async function storeItemImage(itemId,file,oldPath=null){
  const blob=await optimizeItemImage(file);
  const extension=blob.type==="image/webp"?"webp":blob.type==="image/png"?"png":"jpg";
  const unique=crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2);
  const imagePath=itemId+"/"+unique+"."+extension;
  const storage=sb.storage.from("mercado-imagens");
  const {error:uploadError}=await storage.upload(imagePath,blob,{
    contentType:blob.type||"image/jpeg",
    cacheControl:"3600",
    upsert:false
  });
  if(uploadError)throw uploadError;
  try{
    await rpc("mercado_admin_salvar_imagem",{
      p_item_id:itemId,
      p_imagem_path:imagePath
    });
  }catch(error){
    try{await storage.remove([imagePath])}catch(_){}
    throw error;
  }
  if(oldPath)try{await storage.remove([oldPath])}catch(_){}
  ITEM_IMAGE_PATHS[itemId]=imagePath;
  return imagePath;
}

$("#imageForm").onsubmit=async e=>{
  e.preventDefault();
  const f=e.target;
  const file=f.elements.imagem.files[0];
  if(!file)return;
  const validationError=validateItemImage(file);
  if(validationError){alert(validationError);return;}
  const itemId=f.elements.item_id.value;
  const oldPath=ITEM_IMAGE_PATHS[itemId]||null;
  const submit=f.querySelector('button[type="submit"],button:not([type])');
  if(submit)submit.disabled=true;
  try{
    await storeItemImage(itemId,file,oldPath);
    closeModal("imageModal");
    toast("Imagem salva.");
    try{await loadMarket()}catch(error){alert("Imagem salva, mas a tela não atualizou: "+error.message)}
  }catch(error){
    alert(error.message||"Não foi possível salvar a imagem.");
  }finally{
    if(submit)submit.disabled=false;
  }
};

function openStock(id,nome){
  const f=$("#stockForm");f.reset();
  f.elements.item_id.value=id;f.elements.item_nome.value=nome;f.elements.operacao.value="entrada";
  $("#stockQtyLabel").childNodes[0].nodeValue="Quantidade a adicionar";
  openModal("stockModal");
}
window.openStock=openStock;
$("#stockOperation").onchange=e=>{
  $("#stockQtyLabel").childNodes[0].nodeValue=e.target.value==="entrada"?"Quantidade a adicionar":"Quantidade final";
};
$("#stockForm").onsubmit=async e=>{
  e.preventDefault();
  const f=e.target,op=f.elements.operacao.value,q=Number(f.elements.quantidade.value),obs=f.elements.observacao.value.trim()||null;
  try{
    if(op==="entrada")await rpc("mercado_admin_entrada",{p_item_id:f.elements.item_id,p_quantidade:q,p_observacao:obs});
    else await rpc("mercado_admin_ajustar",{p_item_id:f.elements.item_id,p_novo_estoque:q,p_observacao:obs});
    closeModal("stockModal");toast("Estoque atualizado.");await loadMarket();
  }catch(ex){alert(ex.message)}
};

async function disableItem(id,nome){
  if(!confirm(`Excluir ${nome} do Mercadinho?\n\nO histórico de movimentos será preservado.`))return;
  try{await rpc("mercado_admin_desativar_item",{p_item_id:id});toast("Item removido.");await loadMarket()}catch(ex){alert(ex.message)}
}
window.disableItem=disableItem;

function renderAccesses(){
  $("#accessTable").innerHTML=(ACCESSES||[]).length?ACCESSES.map(x=>`
    <tr><td><b>${esc(x.nome)}</b></td><td>${esc(x.passaporte)}</td><td>${dt(x.created_at)}</td>
    <td><button class="mini" onclick="openResetPassword('${x.id}','${esc(x.nome).replace(/'/g,"&#039;")}','${esc(x.passaporte)}')">Redefinir senha</button> <button class="mini red" onclick="deleteAccess('${x.id}','${esc(x.nome).replace(/'/g,"&#039;")}')">Excluir acesso</button></td></tr>`
  ).join(""):`<tr><td colspan="4" class="empty">Nenhum acesso de membro criado.</td></tr>`;
}
$("#newAccessBtn").onclick=()=>{$("#accessForm").reset();openModal("accessModal")};
$("#generatePasswordBtn").onclick=()=>{
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  let p="";crypto.getRandomValues(new Uint32Array(12)).forEach(n=>p+=chars[n%chars.length]);
  $("#accessForm").elements.senha.value=p;
};
$("#accessForm").onsubmit=async e=>{
  e.preventDefault();const f=e.target;
  try{
    await rpc("mercado_criar_acesso",{p_nome:f.elements.nome.value.trim(),p_passaporte:f.elements.passaporte.value.trim(),p_senha:f.elements.senha.value});
    const senha=f.elements.senha.value;
    closeModal("accessModal");await loadAccesses();toast("Acesso criado.");
    alert(`Acesso criado.\n\nPassaporte: ${f.elements.passaporte.value.trim()}\nSenha: ${senha}\n\nEnvie esses dados ao membro. A senha não ficará visível depois.`);
  }catch(ex){alert(ex.message)}
};
function openResetPassword(id,nome,passaporte){
  const f=$("#resetPasswordForm");f.reset();
  f.elements.access_id.value=id;
  f.elements.passaporte.value=passaporte;
  f.elements.membro.value=nome;
  openModal("resetPasswordModal");
}
window.openResetPassword=openResetPassword;

$("#generateResetPasswordBtn").onclick=()=>{
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  let p="";crypto.getRandomValues(new Uint32Array(12)).forEach(n=>p+=chars[n%chars.length]);
  $("#resetPasswordForm").elements.senha.value=p;
};
$("#resetPasswordForm").onsubmit=async e=>{
  e.preventDefault();
  const f=e.target;
  const passaporte=f.elements.passaporte.value;
  const senha=f.elements.senha.value;
  try{
    await rpc("mercado_admin_redefinir_senha",{
      p_id:f.elements.access_id.value,
      p_senha:senha
    });
    closeModal("resetPasswordModal");
    await loadAccesses();
    alert("Senha redefinida.\n\nPassaporte: "+passaporte+"\nNova senha: "+senha+"\n\nEnvie a nova senha ao membro.");
  }catch(error){
    alert(error.message||"Não foi possível redefinir a senha.");
  }
};

async function deleteAccess(id,nome){
  if(!confirm(`Excluir o acesso de ${nome}?`))return;
  try{await rpc("mercado_excluir_acesso",{p_id:id});toast("Acesso excluído.");await loadAccesses()}catch(ex){alert(ex.message)}
}
window.deleteAccess=deleteAccess;

function renderMoves(){
  $("#movesTable").innerHTML=(MOVES||[]).length?MOVES.map(x=>`
    <tr>
      <td>${dt(x.created_at)}</td><td>${esc(x.item_nome)}</td>
      <td><span class="badge ${esc(x.tipo)}">${esc(x.tipo)}</span></td>
      <td>${br(x.quantidade)}</td><td>${esc(x.responsavel_nome||"—")}</td>
      <td>${br(x.estoque_anterior)}</td><td>${br(x.estoque_posterior)}</td><td>${esc(x.observacao||"—")}</td>
    </tr>`).join(""):`<tr><td colspan="8" class="empty">Nenhum movimento registrado.</td></tr>`;
}

$("#loginForm").onsubmit=async e=>{
  e.preventDefault();
  $("#loginErr").textContent="";
  $("#loginBtn").disabled=true;$("#loginBtn").textContent="VALIDANDO...";
  try{
    await login($("#passport").value,$("#password").value);
    applySessionUI();await loadMarket();
  }catch(ex){
    $("#loginErr").textContent="Passaporte, senha ou acesso inválidos.";
  }finally{
    $("#loginBtn").disabled=false;$("#loginBtn").textContent="ENTRAR";
  }
};
$("#logoutBtn").onclick=logout;
$("#refreshBtn").onclick=async()=>{try{await loadMarket();toast("Atualizado.")}catch(ex){alert(ex.message)}};

(async()=>{
  try{
    if(await restoreSession()){applySessionUI();await loadMarket()}
  }catch(ex){console.error(ex)}
})();
