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

 document.querySelectorAll('[id$="Tela"]').forEach(el=>{
   el.classList.add('hidden')
 })

 document.getElementById(tela+'Tela').classList.remove('hidden')

 if(tela==='baixa'){
   atualizarDashboardBaixa()
 }

 if(tela==='acompanhamento'){
   carregarAcompanhamento()
 }
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
   <td>
   ${
    v.status==='ABERTA'
    ?`<button class="btn-cancelar" onclick="cancelar('${v.id}')">Cancelar</button>`
    :v.status
   }
   </td>
   </tr>`
 })
}

async function cancelar(id){

 await client.from('viagens').update({
  status:'CANCELADA',
  cancelado_em:agoraBrasil()
 }).eq('id',id)

 Swal.fire('Viagem cancelada')
 carregar()
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

 const {data:existente}=await client
 .from('documentos')
 .select('*')
 .eq('chave_cte',chave)
 .maybeSingle()

 if(existente){
  Swal.fire('Este CT-e já foi inserido')
  return
 }

 const {error}=await client.from('documentos').insert([{
  viagem_id:viagemAtual.id,
  chave_cte:chave,
  numero_cte:numero,
  status_entrega:'EM ROTA',
  data_saida:agoraBrasil()
 }])

 if(error){
  Swal.fire(error.message)
  return
 }

 document.getElementById('scanner').value=''
 await renderDocs()

 Swal.fire('CT-e inserido com sucesso')
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

 const {data:docs}=await client
 .from('documentos')
 .select('*')
 .eq('viagem_id',viagemAtual.id)

 let y=20
 let pagina=1

 function cabecalho(){

  doc.setFontSize(22)
  doc.text('ROMANEIO DE VIAGEM',20,20)

  doc.setFontSize(10)
  doc.text(`Emitido em: ${agoraBrasil()}`,140,20)

  doc.setFontSize(16)
  doc.text(
   empresa==='MACEDO'
   ?'MACEDO TRANSPORTES'
   :'PANTANAL TRANSPORTES',
   20,
   30
  )

  doc.line(20,35,190,35)

  y=45
 }

 function rodape(){
  doc.line(20,285,190,285)
  doc.setFontSize(9)
  doc.text('Sistema de Expedição - Gabriel Campana',20,292)
  doc.text(`Página ${pagina}`,170,292)
 }

 cabecalho()

 doc.setFontSize(11)

 doc.text(`Número da Viagem: ${viagemAtual.numero}`,20,y); y+=8
 doc.text(`Transportadora: ${empresa}`,20,y); y+=8
 doc.text(`Placa: ${viagemAtual.placa}`,20,y); y+=8
 doc.text(`Motorista: ${viagemAtual.motorista}`,20,y); y+=8
 doc.text(`CPF Motorista: ${viagemAtual.cpf_motorista||'-'}`,20,y); y+=8
 doc.text(`Status: ${viagemAtual.status}`,20,y); y+=8
 doc.text(`Abertura: ${viagemAtual.created_at||'-'}`,20,y); y+=8
 doc.text(`Finalização: ${viagemAtual.finalizado_em||'-'}`,20,y); y+=8
 doc.text(`Total de CT-es: ${docs.length}`,20,y)

 y+=15

 doc.setFontSize(14)
 doc.text('DOCUMENTOS TRANSPORTADOS',20,y)

 y+=12
 doc.setFontSize(11)

 docs.forEach((d,index)=>{

  if(y>265){
   rodape()
   doc.addPage()
   pagina++
   cabecalho()
  }

  doc.text(`${index+1}) CT-e ${d.numero_cte}`,20,y)
  y+=8
 })

 rodape()

 doc.save(`ROMANEIO-${empresa}-${viagemAtual.numero}.pdf`)
}

async function atualizarDashboardBaixa(){

 const {data:docs}=await client.from('documentos').select('*')

 document.getElementById('pendentesTotal').innerText=docs.filter(d=>d.status_entrega!=='ENTREGUE').length
 document.getElementById('entreguesHoje').innerText=docs.filter(d=>(d.data_baixa||'').startsWith(new Date().toLocaleDateString('sv-SE'))).length
 document.getElementById('totalMes').innerText=docs.length
}

async function listarPendentes(){

 const placa=document.getElementById('placaBaixa').value
 if(!placa)return

 const viagensPlaca=viagens.filter(v=>v.placa===placa&&v.status==='FINALIZADA')

 const div=document.getElementById('listaPendentes')
 div.innerHTML=''

 for(const viagem of viagensPlaca){

  const {data:docs}=await client.from('documentos').select('*').eq('viagem_id',viagem.id)

  docs.filter(d=>d.status_entrega!=='ENTREGUE').forEach(d=>{
   div.innerHTML+=`
   <div class="card">
   <p><b>CT-e:</b> ${d.numero_cte}</p>

   <input id="rec-${d.id}" placeholder="Recebedor">
   <input id="doc-${d.id}" placeholder="Documento">

   <button class="btn-finalizar" onclick="registrarBaixa('${d.id}')">
   Registrar Baixa
   </button>
   </div>`
  })
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

 const buscaOriginal=document.getElementById('buscarCte').value.trim()

 if(!buscaOriginal){
  Swal.fire('Digite algo para buscar')
  return
 }

const busca=buscaOriginal.replace(/\D/g,'').replace(/^0+/,'')

 const {data,error}=await client
 .from('documentos')
 .select(`
   *,
   viagens(
     placa,
     motorista,
     transportadora
   )
 `)

 if(error){
  Swal.fire(error.message)
  return
 }

 const encontrados=(data||[]).filter(d=>{

  const numeroCte=String(d.numero_cte||'').replace(/\D/g,'')
  const numeroNota=String(d.numero_nota||'').replace(/\D/g,'').replace(/^0+/,'')
  const remetente=String(d.remetente_cnpj||'').replace(/\D/g,'')
  const destinatario=String(d.destinatario_cnpj||'').replace(/\D/g,'')

  return (
   numeroCte.includes(busca) ||
   numeroNota.includes(busca) ||
   remetente.includes(busca) ||
   destinatario.includes(busca)
  )
 })

 const div=document.getElementById('resultadoRastreio')

 if(!encontrados.length){
  div.innerHTML='<p>Nenhum documento encontrado</p>'
  return
 }

 div.innerHTML=''

 encontrados.forEach(encontrado=>{

  div.innerHTML+=`
  <div class="card rastreio-card">

   <h3>CT-e ${encontrado.numero_cte}</h3>

   <p><b>Nota:</b> ${encontrado.numero_nota||'-'}</p>

   <hr>

   <p><b>Remetente:</b> ${encontrado.remetente||'-'}</p>
   <p><b>CNPJ Remetente:</b> ${encontrado.remetente_cnpj||'-'}</p>

   <hr>

   <p><b>Destinatário:</b> ${encontrado.destinatario||'-'}</p>
   <p><b>CNPJ Destinatário:</b> ${encontrado.destinatario_cnpj||'-'}</p>

   <hr>

   <p><b>Valor Mercadoria:</b> R$ ${encontrado.valor_nota||'-'}</p>
   <p><b>Valor Frete:</b> R$ ${encontrado.valor_cte||'-'}</p>

   <hr>

   <p><b>Status:</b> ${encontrado.status_entrega||'EM ROTA'}</p>

   <p><b>Transportadora:</b> ${encontrado.viagens?.transportadora||'-'}</p>

   <p><b>Placa:</b> ${encontrado.viagens?.placa||'-'}</p>

   <p><b>Motorista:</b> ${encontrado.viagens?.motorista||'-'}</p>

   <p><b>Saída:</b> ${encontrado.data_saida||'-'}</p>

   <p><b>Baixa:</b> ${encontrado.data_baixa||'-'}</p>

   <div style="margin-top:15px;display:flex;gap:10px;flex-wrap:wrap;">

    <button class="btn-pdf"
      onclick="abrirDanfe('${encontrado.chave_cte}')">
      Abrir DANFE
    </button>

    <button class="btn-gerar"
      onclick="baixarDanfe('${encontrado.chave_cte}')">
      Baixar PDF
    </button>

   </div>

  </div>
  `
 })
}



// =============================
// ACOMPANHAMENTO
// =============================

async function carregarAcompanhamento(dataInicio=null,dataFim=null){

 const { data:docs, error } = await client
 .from('documentos')
 .select(`
   *,
   viagens(
     numero,
     placa,
     motorista,
     transportadora
   )
 `)

 const tbody=document.getElementById('listaAcompanhamento')

 if(!tbody) return

 tbody.innerHTML=''

 if(error){
  console.error(error)
  tbody.innerHTML='<tr><td colspan="7">Erro ao carregar</td></tr>'
  return
 }

 let docsFiltrados=docs||[]

 if(dataInicio && dataFim){
  docsFiltrados=docsFiltrados.filter(doc=>{
   const dataDoc=(doc.data_saida||'').split(' ')[0]
   return dataDoc>=dataInicio && dataDoc<=dataFim
  })
 }

 if(!docsFiltrados.length){
  tbody.innerHTML='<tr><td colspan="7">Nenhum registro encontrado</td></tr>'
  return
 }

 const agrupado={}

 docsFiltrados.forEach(doc=>{

  const placa=doc.viagens?.placa||'-'

  if(!agrupado[placa]){
   agrupado[placa]={
    motorista:doc.viagens?.motorista||'-',
    transportadora:doc.viagens?.transportadora||'-',
    docs:[]
   }
  }

  agrupado[placa].docs.push(doc)
 })

 Object.keys(agrupado).forEach(placa=>{

  const item=agrupado[placa]
  const total=item.docs.length
  const entregues=item.docs.filter(d=>d.status_entrega==='ENTREGUE').length
  const pendentes=total-entregues

  tbody.innerHTML+=`
   <tr>
    <td>${placa}</td>
    <td>${item.motorista}</td>
    <td>${item.transportadora}</td>
    <td>${total}</td>
    <td>${entregues}</td>
    <td>${pendentes}</td>
    <td>
      <button class="btn-ver" onclick="verEntregas('${placa}')">
        Ver Entregas
      </button>
    </td>
   </tr>
  `
 })
}

async function buscarAcompanhamento(){

 const dataInicio=document.getElementById('dataInicio')?.value
 const dataFim=document.getElementById('dataFim')?.value

 await carregarAcompanhamento(
  dataInicio||null,
  dataFim||null
 )
}

async function verEntregas(placa){

 const {data:docs}=await client
 .from('documentos')
 .select(`
   *,
   viagens(
    placa,
    motorista,
    transportadora
   )
 `)

 const docsPlaca=(docs||[]).filter(
  d=>d.viagens?.placa===placa
 )

 if(!docsPlaca.length){
  Swal.fire('Nenhuma entrega encontrada')
  return
 }

 let html=''

 docsPlaca.forEach(d=>{

  html+=`
   <div style="
    text-align:left;
    margin-bottom:10px;
    padding:12px;
    border:1px solid #ddd;
    border-radius:8px;
   ">
    <b>CT-e:</b> ${d.numero_cte}<br>
    <b>Status:</b> ${d.status_entrega}<br>
    <b>Saída:</b> ${d.data_saida||'-'}<br>
    <b>Baixa:</b> ${d.data_baixa||'-'}<br>
    <b>Recebedor:</b> ${d.recebedor||'-'}
   </div>
  `
 })

 Swal.fire({
  title:`Entregas da placa ${placa}`,
  html,
  width:900
 })
}

// ÚNICO DOMContentLoaded
document.addEventListener('DOMContentLoaded',()=>{

 document.getElementById('buscarCte')?.addEventListener('keypress',e=>{
  if(e.key==='Enter') rastrearCte()
 })

 carregar()
 carregarAcompanhamento()
})

function abrirDanfe(chave){
    window.open(
        `https://www.cte.fazenda.gov.br/portal/consulta.aspx?tipoConsulta=completa&chCTe=${chave}`,
        '_blank'
    )
}

function baixarDanfe(chave){
    abrirDanfe(chave)
}