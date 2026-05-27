const SUPABASE_URL='https://httesayqbjeqgkdnkyak.supabase.co'
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dGVzYXlxYmplcWdrZG5reWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTA1NTEsImV4cCI6MjA5NDg2NjU1MX0.CAyjBpq4Wg6vGwjg-9lFosjNo7B9kX87F929qhwGf9Y'

const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY)

let viagens=[]
let viagemAtual=null
let transportadoraSelecionada='MACEDO'

function agoraBrasil(){
 const agora=new Date()
 return `${agora.toLocaleDateString('sv-SE')} ${agora.toLocaleTimeString('pt-BR',{hour12:false})}`
}

function setTransportadora(tipo){

 transportadoraSelecionada=tipo

 document.getElementById('btnMacedo').classList.remove('ativo')
 document.getElementById('btnPantanal').classList.remove('ativo')

 if(tipo==='MACEDO'){
  document.getElementById('btnMacedo').classList.add('ativo')
 }else{
  document.getElementById('btnPantanal').classList.add('ativo')
 }
}

function mostrarTela(tela){

 document.querySelectorAll('[id$="Tela"]').forEach(el=>el.classList.add('hidden'))
 document.getElementById(tela+'Tela').classList.remove('hidden')

 if(tela==='baixa') atualizarDashboardBaixa()
}

function normalizarNumero(numero){
 return String(numero||'').replace(/^0+/,'')
}

async function carregar(){

 const {data:motoristas}=await client.from('motoristas').select('*')
 const {data:veiculos}=await client.from('veiculos').select('*')
 const {data:viagensData}=await client.from('viagens').select('*').order('numero',{ascending:false})

 viagens=viagensData||[]

 carregarSelects(motoristas,veiculos)

 render()
 atualizarDashboardBaixa()
}

function carregarSelects(motoristas,veiculos){

 document.getElementById('placa').innerHTML='<option>Selecione placa</option>'
 document.getElementById('placaBaixa').innerHTML='<option>Selecione placa</option>'

 veiculos.forEach(v=>{
  document.getElementById('placa').innerHTML+=`<option value="${v.placa}">${v.placa}</option>`
 })

 const placas=[...new Set(
  viagens.filter(v=>v.status==='FINALIZADA').map(v=>v.placa)
 )]

 placas.forEach(p=>{
  document.getElementById('placaBaixa').innerHTML+=`<option value="${p}">${p}</option>`
 })

 document.getElementById('motorista').innerHTML='<option>Selecione motorista</option>'

 motoristas.forEach(m=>{
  document.getElementById('motorista').innerHTML+=`<option value="${m.cpf}">${m.nome}</option>`
 })
}

async function criarViagem(){

 const placa=document.getElementById('placa').value
 const cpf=document.getElementById('motorista').value

 if(placa==='Selecione placa'||cpf==='Selecione motorista'){
  Swal.fire('Preencha os campos')
  return
 }

 const {data:motorista}=await client
 .from('motoristas')
 .select('*')
 .eq('cpf',cpf)
 .single()

 await client.from('viagens').insert([{
  placa,
  motorista:motorista.nome,
  cpf_motorista:cpf,
  transportadora:transportadoraSelecionada,
  status:'ABERTA',
  created_at:agoraBrasil()
 }])

 Swal.fire('Viagem criada')

 carregar()
}

function render(){

 const lista=document.getElementById('lista')
 lista.innerHTML=''

 document.getElementById('abertas').innerText=viagens.filter(v=>v.status==='ABERTA').length
 document.getElementById('finalizadas').innerText=viagens.filter(v=>v.status==='FINALIZADA').length
 document.getElementById('canceladas').innerText=viagens.filter(v=>v.status==='CANCELADA').length

 viagens.forEach(v=>{
  lista.innerHTML+=`
   <tr>
   <td>${v.numero}</td>
   <td>
    ${v.placa}
    <div class="data-info">${v.transportadora||'MACEDO'}</div>
   </td>
   <td>${v.motorista}</td>
   <td>
    <span class="status-${v.status.toLowerCase()}">${v.status}</span>
    <div class="data-info">Abertura: ${v.created_at||'-'}</div>
    <div class="data-info">Finalização: ${v.finalizado_em||'-'}</div>
   </td>
   <td>
   ${
    v.status==='ABERTA'
    ?`<button class="btn-cte" onclick="abrir(${v.numero})">CT-es</button>`
    :`<button class="btn-pdf" onclick="abrirPdf(${v.numero})">PDF</button>`
   }
   </td>
   </tr>`
 })
}

async function abrir(numero){
 viagemAtual=viagens.find(v=>v.numero===numero)
 document.getElementById('modal').classList.remove('hidden')
 document.getElementById('tituloViagem').innerText='Viagem #'+numero
 renderDocs()
}

function fechar(){
 document.getElementById('modal').classList.add('hidden')
}

async function inserirManual(){

 const chave=document.getElementById('scanner').value.trim()

 if(!chave){
  Swal.fire('Digite a chave')
  return
 }

 const numero=normalizarNumero(chave.substring(25,34))

 await client.from('documentos').insert([{
  viagem_id:viagemAtual.id,
  chave_cte:chave,
  numero_cte:numero,
  status_entrega:'EM ROTA',
  data_saida:agoraBrasil()
 }])

 document.getElementById('scanner').value=''

 Swal.fire('CT-e inserido')

 renderDocs()
}

async function scanner(e){

 if(e.key!=='Enter') return

 await inserirManual()
}

async function renderDocs(){

 const {data:docs}=await client
 .from('documentos')
 .select('*')
 .eq('viagem_id',viagemAtual.id)

 const tbody=document.getElementById('docs')
 tbody.innerHTML=''

 docs.forEach(d=>{
  tbody.innerHTML+=`
   <tr>
   <td>${d.numero_cte}</td>
   <td>${d.data_saida||'-'}</td>
   <td>${d.status_entrega||'-'}</td>
   <td><button class="btn-cancelar" onclick="remover('${d.id}')">Remover</button></td>
   </tr>`
 })
}

async function remover(id){
 await client.from('documentos').delete().eq('id',id)
 renderDocs()
}

async function finalizar(){

 const {data:docs}=await client
 .from('documentos')
 .select('*')
 .eq('viagem_id',viagemAtual.id)

 if(!docs.length){
  Swal.fire('Adicione ao menos 1 CT-e')
  return
 }

 await client.from('viagens').update({
  status:'FINALIZADA',
  finalizado_em:agoraBrasil()
 }).eq('id',viagemAtual.id)

 fechar()
 carregar()
}

async function abrirPdf(numero){
 viagemAtual=viagens.find(v=>v.numero===numero)
 pdf()
}

async function pdf(){

 const {jsPDF}=window.jspdf
 const doc=new jsPDF()

 const empresa=viagemAtual.transportadora||'MACEDO'

 doc.setFontSize(20)
 doc.text('ROMANEIO DE VIAGEM',20,20)

 doc.setFontSize(14)
 doc.text(
  empresa==='MACEDO'
  ?'MACEDO TRANSPORTES'
  :'PANTANAL TRANSPORTES',
  20,32
 )

 doc.line(20,36,190,36)

 doc.text(`Viagem: ${viagemAtual.numero}`,20,50)
 doc.text(`Placa: ${viagemAtual.placa}`,20,60)
 doc.text(`Motorista: ${viagemAtual.motorista}`,20,70)

 const {data:docs}=await client.from('documentos').select('*').eq('viagem_id',viagemAtual.id)

 let y=95

 docs.forEach((d,index)=>{
  doc.text(`${index+1}. CT-e ${d.numero_cte}`,20,y)
  y+=10
 })

 doc.save(`ROMANEIO-${empresa}-${viagemAtual.numero}.pdf`)
}

async function atualizarDashboardBaixa(){

 const {data:docs}=await client.from('documentos').select('*')

 const pendentes=docs.filter(d=>d.status_entrega!=='ENTREGUE').length
 const entreguesHoje=docs.filter(d=>(d.data_baixa||'').startsWith(new Date().toLocaleDateString('sv-SE'))).length
 const totalMes=docs.length

 document.getElementById('pendentesTotal').innerText=pendentes
 document.getElementById('entreguesHoje').innerText=entreguesHoje
 document.getElementById('totalMes').innerText=totalMes
}

async function listarPendentes(){

 const placa=document.getElementById('placaBaixa').value

 if(!placa) return

 const viagensPlaca = viagens.filter(
   v => v.placa === placa && v.status === 'FINALIZADA'
 )

 const div=document.getElementById('listaPendentes')
 div.innerHTML=''

 if(!viagensPlaca.length){
   div.innerHTML='<p>Nenhuma viagem encontrada.</p>'
   return
 }

 for(const viagem of viagensPlaca){

   const {data:docs}=await client
     .from('documentos')
     .select('*')
     .eq('viagem_id',viagem.id)

   docs
   .filter(d=>d.status_entrega!=='ENTREGUE')
   .forEach(d=>{

     div.innerHTML+=`
     <div class="card">
       <p><b>Transportadora:</b> ${viagem.transportadora || 'MACEDO'}</p>
       <p><b>CT-e:</b> ${d.numero_cte}</p>
       <p><b>Saída:</b> ${d.data_saida||'-'}</p>

       <input id="rec-${d.id}" placeholder="Recebedor">
       <input id="doc-${d.id}" placeholder="Documento">

       <button class="btn-finalizar" onclick="registrarBaixa('${d.id}')">
         Registrar Baixa
       </button>
     </div>`
   })
 }

 if(div.innerHTML===''){
   div.innerHTML='<p>Sem CT-es pendentes.</p>'
 }
}

async function registrarBaixa(id){

 const recebedor=document.getElementById(`rec-${id}`).value
 const documento=document.getElementById(`doc-${id}`).value

 await client.from('documentos').update({
  status_entrega:'ENTREGUE',
  data_baixa:agoraBrasil(),
  recebedor,
  documento_recebedor:documento
 }).eq('id',id)

 Swal.fire('Baixa registrada')

 listarPendentes()
 atualizarDashboardBaixa()
}

async function rastrearCte(){

 const numeroDigitado = document
   .getElementById('buscarCte')
   .value
   .trim()

 const numeroBusca = normalizarNumero(numeroDigitado)

 const { data, error } = await client
   .from('documentos')
   .select(`
     *,
     viagens (
       placa,
       motorista,
       transportadora
     )
   `)

 const div=document.getElementById('resultadoRastreio')

 if(error){
   div.innerHTML='<p>Erro ao consultar rastreio</p>'
   return
 }

 const encontrado = data.find(
   d => normalizarNumero(d.numero_cte) === numeroBusca
 )

 if(!encontrado){
   div.innerHTML='<p>CT-e não encontrado</p>'
   return
 }

 div.innerHTML=`
   <div class="card">
     <h3>CT-e ${parseInt(encontrado.numero_cte)}</h3>

     <p><b>Transportadora:</b> ${encontrado.viagens?.transportadora || '-'}</p>
     <p><b>Placa:</b> ${encontrado.viagens?.placa || '-'}</p>
     <p><b>Motorista:</b> ${encontrado.viagens?.motorista || '-'}</p>
     <p><b>Status:</b> ${encontrado.status_entrega || 'EM ROTA'}</p>
     <p><b>Saída:</b> ${encontrado.data_saida || '-'}</p>
     <p><b>Baixa:</b> ${encontrado.data_baixa || '-'}</p>
     <p><b>Recebedor:</b> ${encontrado.recebedor || '-'}</p>
   </div>`
}

document.addEventListener('DOMContentLoaded',()=>{

 document.getElementById('buscarCte')?.addEventListener('keypress',e=>{
  if(e.key==='Enter') rastrearCte()
 })

 carregar()
})