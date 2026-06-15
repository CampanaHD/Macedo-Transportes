const SUPABASE_URL='https://httesayqbjeqgkdnkyak.supabase.co'
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dGVzYXlxYmplcWdrZG5reWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTA1NTEsImV4cCI6MjA5NDg2NjU1MX0.CAyjBpq4Wg6vGwjg-9lFosjNo7B9kX87F929qhwGf9Y'

const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY)

let viagens=[]
let viagemAtual=null
let transportadoraSelecionada='MACEDO'

let taxaEditando = null

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

// async function abrir(numero){
//  viagemAtual=viagens.find(v=>v.numero===numero)
//  document.getElementById('modal').classList.remove('hidden')
//  document.getElementById('tituloViagem').innerText='Viagem #'+numero
//  renderDocs()
// }

function fechar(){
   fecharLeitor()
 document.getElementById('modal').classList.add('hidden')
}

async function inserirManual(){

 const chave=document.getElementById('scanner').value.trim()

 if(!chave){
  return
 }

 const numero=normalizarNumero(chave.substring(25,34))

 const {data:existente}=await client
 .from('documentos')
 .select('*')
 .eq('chave_cte',chave)
 .maybeSingle()

 // CT-e já existe (veio do XML)
 if(existente){

  // já está vinculado em outra viagem
  if(existente.viagem_id){

   mostrarMensagemScanner(
    `CT-e ${existente.numero_cte} já está em uma viagem`,
    'erro'
   )

   document.getElementById('scanner').value=''
   document.getElementById('scanner').focus()

   return
  }

  // apenas vincula à viagem atual
  const {error:updateError}=await client
  .from('documentos')
  .update({
   viagem_id:viagemAtual.id,
   status_entrega:'EM ROTA',
   data_saida:agoraBrasil()
  })
  .eq('id',existente.id)

  if(updateError){

   mostrarMensagemScanner(
    updateError.message,
    'erro'
   )

   return
  }

  document.getElementById('scanner').value=''

  await renderDocs()

  document.getElementById('scanner').focus()

  mostrarMensagemScanner(
   `CT-e ${existente.numero_cte} vinculado à viagem`
  )

  return
 }

 // não existe no banco -> cria normalmente
 const {error}=await client
 .from('documentos')
 .insert([{
   viagem_id:viagemAtual.id,
   chave_cte:chave,
   numero_cte:numero,
   status_entrega:'EM ROTA',
   data_saida:agoraBrasil()
 }])

 if(error){

  mostrarMensagemScanner(
   error.message,
   'erro'
  )

  return
 }

 document.getElementById('scanner').value=''

 await renderDocs()

 document.getElementById('scanner').focus()

 mostrarMensagemScanner(
  `CT-e ${numero} inserido com sucesso`
 )
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

 const {data:docs}=await client
.from('documentos')
.select('*')
.range(0,5000)

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
   <label>Comprovante / Foto</label>

<input
 type="file"
 accept="image/*"
 id="arquivo-${d.id}"
>


   <button class="btn-finalizar"
onclick="registrarBaixa('${d.id}')">
Entregue
</button>

<button class="btn-cancelar"
onclick="abrirOcorrencia('${d.id}')">
Ocorrência
</button>
   </div>`
  })
 }
}

async function registrarBaixa(id){

 const recebedor =
 document.getElementById(`rec-${id}`).value

 const documento =
 document.getElementById(`doc-${id}`).value

const arquivo =
document.getElementById(`arquivo-${id}`).files[0]

const urlArquivo =
await uploadImagem(arquivo)

console.log('URL SALVA:', urlArquivo)

await client
.from('documentos')
.update({

 status_entrega:'ENTREGUE',

 data_baixa:agoraBrasil(),

 recebedor,

 documento_recebedor:documento,

 arquivo_comprovante:urlArquivo

})
.eq('id',id)

 Swal.fire(
  'Baixa registrada com comprovantes'
 )

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
.range(0, 5000)

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
   <p><b>Chave CT-e:</b> ${encontrado.chave_cte||'-'}</p>

<p><b>Viagem:</b> ${encontrado.viagem_id||'-'}</p>

<p><b>Status Atual:</b> ${encontrado.status_entrega||'-'}</p>

 

   <div class="rastreio-grid">

    <div class="info-box">
        <h4>Dados CT-e</h4>
        <p><b>CT-e:</b> ${encontrado.numero_cte}</p>
        <p><b>Nota:</b> ${encontrado.numero_nota}</p>
        <p><b>Status:</b> ${encontrado.status_entrega}</p>
    </div>

    <div class="info-box">
        <h4>Remetente</h4>
        <p>${encontrado.remetente}</p>
        <p>${encontrado.remetente_cnpj}</p>
    </div>

    <div class="info-box">
        <h4>Destinatário</h4>
        <p>${encontrado.destinatario}</p>
        <p>${encontrado.destinatario_cnpj}</p>
    </div>

    <div class="info-box">
        <h4>Carga</h4>
        <p><b>Peso:</b> ${encontrado.peso} kg</p>
        <p><b>Volumes:</b> ${encontrado.quantidade_volumes}</p>
        <p><b>M³:</b> ${encontrado.volume_m3}</p>
    </div>

    <div class="info-box">
        <h4>Financeiro</h4>
        <p><b>Mercadoria:</b> R$ ${encontrado.valor_nota}</p>
        <p><b>Frete:</b> R$ ${encontrado.valor_cte}</p>
    </div>

    <div class="info-box">
        <h4>Transporte</h4>
        <p><b>Placa:</b> ${encontrado.viagens?.placa}</p>
        <p><b>Motorista:</b> ${encontrado.viagens?.motorista}</p>
    </div>

</div>

   <hr>

   <p><b>Status:</b> ${encontrado.status_entrega||'EM ROTA'}</p>

   ${
 encontrado.status_entrega === 'OCORRENCIA'
 ? `
 <p>
 <b>Ocorrência:</b>
 ${encontrado.tipo_ocorrencia || '-'}
 </p>

 <p>
 <b>Observação:</b>
 ${encontrado.observacao_ocorrencia || '-'}
 </p>

 <p>
 <b>Data:</b>
 ${encontrado.data_ocorrencia || '-'}
 </p>
 `
 : ''
}

   <p><b>Transportadora:</b> ${encontrado.viagens?.transportadora||'-'}</p>

   <p><b>Placa:</b> ${encontrado.viagens?.placa||'-'}</p>

   <p><b>Motorista:</b> ${encontrado.viagens?.motorista||'-'}</p>

   <p><b>Saída:</b> ${encontrado.data_saida||'-'}</p>

  <p><b>Baixa:</b> ${encontrado.data_baixa||'-'}</p>

  <hr>

<p>
<b>Recebedor:</b>
${encontrado.recebedor||'-'}
</p>

<p>
<b>Documento:</b>
${encontrado.documento_recebedor||'-'}
</p>

<hr>

<h4>Histórico</h4>

<ul>

<li>
🚚 Saída para entrega:
${encontrado.data_saida||'-'}
</li>

${
 encontrado.data_ocorrencia
 ?
 `
 <li>
 ⚠️ Ocorrência:
 ${encontrado.tipo_ocorrencia}
 -
 ${encontrado.data_ocorrencia}
 </li>
 `
 :
 ''
}

${
 encontrado.data_baixa
 ?
 `
 <li>
 ✅ Entregue:
 ${encontrado.data_baixa}
 </li>
 `
 :
 ''
}

</ul>

${
 encontrado.arquivo_comprovante
 ? `
 <hr>

 <p>
   <b>Comprovante / Evidência:</b>
 </p>

 <img
   src="${encontrado.arquivo_comprovante}"
   style="
      width:250px;
      max-width:100%;
      border-radius:10px;
      cursor:pointer;
      border:1px solid #ddd;
   "
   onclick="window.open(this.src)"
 >

 <br><br>

 <a
   href="${encontrado.arquivo_comprovante}"
   target="_blank"
   class="btn-gerar"
 >
   Abrir Arquivo
 </a>
 `
 : ''
}

<div style="margin-top:15px;display:flex;gap:10px;flex-wrap:wrap;">

  <button
 class="btn-pdf"
 onclick="abrirDanfeNfe('${encontrado.chave_nfe || ''}')">
 DANFE NF-e
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
.range(0, 5000)

 const tbody=document.getElementById('listaAcompanhamento')

 if(!tbody) return

 tbody.innerHTML=''

 if(error){
  console.error(error)
  tbody.innerHTML='<tr><td colspan="7">Erro ao carregar</td></tr>'
  return
 }

 let docsFiltrados=docs||[]


 const filtroTransportadora =
document.getElementById('filtroTransportadora')?.value || ''

const filtroBusca =
(document.getElementById('filtroBusca')?.value || '')
.toLowerCase()

 if(dataInicio && dataFim){
  docsFiltrados=docsFiltrados.filter(doc=>{
   const dataDoc=(doc.data_saida||'').split(' ')[0]
   return dataDoc>=dataInicio && dataDoc<=dataFim
  })
 }

 // FILTRO TRANSPORTADORA

if(filtroTransportadora){

 docsFiltrados = docsFiltrados.filter(doc=>
   doc.viagens?.transportadora === filtroTransportadora
 )

}

// FILTRO BUSCA

if(filtroBusca){

 docsFiltrados = docsFiltrados.filter(doc=>{

   return (
      (doc.numero_cte || '')
      .toString()
      .toLowerCase()
      .includes(filtroBusca)

      ||

      (doc.viagens?.placa || '')
      .toLowerCase()
      .includes(filtroBusca)

      ||

      (doc.viagens?.motorista || '')
      .toLowerCase()
      .includes(filtroBusca)

      ||

      (doc.destinatario || '')
      .toLowerCase()
      .includes(filtroBusca)

      ||

      (doc.remetente || '')
      .toLowerCase()
      .includes(filtroBusca)
   )

 })

}

if(filtroTransportadora){

 docsFiltrados = docsFiltrados.filter(
   d => d.viagens?.transportadora === filtroTransportadora
 )

}

if(filtroBusca){

 docsFiltrados = docsFiltrados.filter(d => {

   return (
     String(d.numero_cte || '').toLowerCase().includes(filtroBusca) ||
     String(d.numero_nota || '').toLowerCase().includes(filtroBusca) ||
     String(d.destinatario || '').toLowerCase().includes(filtroBusca)
   )

 })

}

 if(!docsFiltrados.length){
  tbody.innerHTML='<tr><td colspan="7">Nenhum registro encontrado</td></tr>'
  return
 }

document.getElementById('painelTotal').innerText =
docsFiltrados.length

document.getElementById('painelEntregues').innerText =
docsFiltrados.filter(
 d=>d.status_entrega==='ENTREGUE'
).length

document.getElementById('painelPendentes').innerText =
docsFiltrados.filter(
 d=>d.status_entrega!=='ENTREGUE'
).length

document.getElementById('painelOcorrencias').innerText =
docsFiltrados.filter(
 d=>d.status_entrega==='OCORRENCIA'
).length

 const agrupado={}

 let totalMercadoria = 0
let totalFrete = 0

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

  totalMercadoria += Number(doc.valor_nota || 0)
  totalFrete += Number(doc.valor_cte || 0)

})

Object.keys(agrupado).forEach(placa=>{

  const item=agrupado[placa]

  const total=item.docs.length

  const entregues=item.docs.filter(
    d=>d.status_entrega==='ENTREGUE'
  ).length

const ocorrencias=item.docs.filter(
 d=>d.status_entrega==='OCORRENCIA'
).length

const pendentes=item.docs.filter(
 d=>d.status_entrega==='EM ROTA'
).length

  const percentual=
    total>0
    ? ((entregues/total)*100).toFixed(1)
    : 0

  const valorMercadoria=
    item.docs.reduce(
      (s,d)=>s+Number(d.valor_nota||0),
      0
    )

  const valorFrete=
    item.docs.reduce(
      (s,d)=>s+Number(d.valor_cte||0),
      0
    )

  tbody.innerHTML+=`
   <tr>

<td>${placa}</td>

<td>${item.motorista}</td>

<td>${item.transportadora}</td>

<td>${total}</td>

<td>${entregues}</td>

<td>${pendentes}</td>

<td>${percentual}%</td>

<td>
R$ ${valorMercadoria.toLocaleString('pt-BR')}
</td>

<td>
R$ ${valorFrete.toLocaleString('pt-BR')}
</td>

<td>
<button
 class="btn-ver"
 onclick="verEntregas('${placa}')">
 Ver Entregas
</button>
</td>

<td>
<span style="
background:#dc2626;
color:white;
padding:4px 8px;
border-radius:6px;
font-weight:bold;
">
${ocorrencias}
</span>
</td>

</tr>

  `
 })

document.getElementById('painelMercadoria').innerText =
'R$ ' + totalMercadoria.toLocaleString('pt-BR')

document.getElementById('painelFrete').innerText =
'R$ ' + totalFrete.toLocaleString('pt-BR')

const percentualEntrega =
docsFiltrados.length
? (
    docsFiltrados.filter(
      d=>d.status_entrega==='ENTREGUE'
    ).length
    /
    docsFiltrados.length
    *100
  ).toFixed(1)
: 0

document.getElementById('painelPercentual').innerText =
percentualEntrega + '%'

document.getElementById('painelTotal').innerText =
docsFiltrados.length

document.getElementById('painelEntregues').innerText =
docsFiltrados.filter(
 d => d.status_entrega === 'ENTREGUE'
).length

document.getElementById('painelPendentes').innerText =
docsFiltrados.filter(
 d => d.status_entrega !== 'ENTREGUE'
).length

document.getElementById('painelMacedo').innerText =
docsFiltrados.filter(
 d => d.viagens?.transportadora === 'MACEDO'
).length

document.getElementById('painelPantanal').innerText =
docsFiltrados.filter(
 d => d.viagens?.transportadora === 'PANTANAL'
).length

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
.range(0,5000)

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
    
${
 d.arquivo_comprovante
 ? `
 <br><br>

 <img
   src="${d.arquivo_comprovante}"
   style="
      width:150px;
      border-radius:8px;
      margin-top:8px;
   "
 >

 <br>

 <a
   href="${d.arquivo_comprovante}"
   target="_blank"
 >
   Ver Comprovante
 </a>
 `
 : ''
}

${
 d.foto_assinatura
 ? `<br><a href="${d.foto_assinatura}" target="_blank">
 Ver Assinatura
 </a>`
 : ''
}

${
 d.foto_fachada
 ? `<br><a href="${d.foto_fachada}" target="_blank">
 Ver Fachada
 </a>`
 : ''
}

${
 d.status_entrega==='OCORRENCIA'
 ? `
 <br>
 <b>Tipo:</b> ${d.tipo_ocorrencia || '-'}
 <br>
 <b>Obs:</b> ${d.observacao_ocorrencia || '-'}
 `
 : ''
}
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
   aplicarTema()

 document.getElementById('buscarCte')?.addEventListener('keypress',e=>{
  if(e.key==='Enter') rastrearCte()
 })

 carregar()
 carregarAcompanhamento()
})

// function abrirDanfe(chave){
//     window.open(
//         `https://www.cte.fazenda.gov.br/portal/consulta.aspx?tipoConsulta=completa&chCTe=${chave}`,
//         '_blank'
//     )
// }

// function baixarDanfe(chave){
//     abrirDanfe(chave)
// }

async function gerarDanfe(chave, baixar=false){

 const {data,error}=await client
 .from('documentos')
 .select('*')
 .eq('chave_cte',chave)
 .single()

 if(error || !data){
   Swal.fire('Documento não encontrado')
   return
 }

 const html=`
 <!DOCTYPE html>
 <html>
 <head>
   <title>DANFE</title>
   <style>
    body{
      font-family:Arial;
      padding:30px;
      color:#111;
    }

    .box{
      border:2px solid #000;
      padding:20px;
      margin-bottom:20px;
    }

    h1,h2{
      margin:0 0 15px 0;
    }

    .linha{
      margin:8px 0;
    }

    .titulo{
      font-weight:bold;
      display:inline-block;
      width:180px;
    }

    button{
      padding:12px 18px;
      background:#2563eb;
      color:white;
      border:none;
      border-radius:8px;
      cursor:pointer;
      margin-top:20px;
    }
   </style>
 </head>
 <body>

 <div class="box">
   <h1>MACEDO TRANSPORTES</h1>
   <h2>DANFE / Consulta Fiscal</h2>

   <div class="linha"><span class="titulo">CT-e:</span> ${data.numero_cte}</div>
   <div class="linha"><span class="titulo">Nota Fiscal:</span> ${data.numero_nota||'-'}</div>

   <hr>

   <div class="linha"><span class="titulo">Remetente:</span> ${data.remetente||'-'}</div>
   <div class="linha"><span class="titulo">CNPJ:</span> ${data.remetente_cnpj||'-'}</div>

   <hr>

   <div class="linha"><span class="titulo">Destinatário:</span> ${data.destinatario||'-'}</div>
   <div class="linha"><span class="titulo">CNPJ:</span> ${data.destinatario_cnpj||'-'}</div>

   <hr>

   <div class="linha"><span class="titulo">Valor Mercadoria:</span> R$ ${data.valor_nota||'-'}</div>
   <div class="linha"><span class="titulo">Valor Frete:</span> R$ ${data.valor_cte||'-'}</div>

   <div class="linha"><span class="titulo">UF Origem:</span> ${data.uf_origem||'-'}</div>
   <div class="linha"><span class="titulo">UF Destino:</span> ${data.uf_destino||'-'}</div>

   <div class="linha"><span class="titulo">Emissão:</span> ${data.data_emissao||'-'}</div>

   <button onclick="window.print()">Baixar / Imprimir PDF</button>
 </div>

 </body>
 </html>
 `

 const novaJanela=window.open('','_blank')
 novaJanela.document.write(html)
 novaJanela.document.close()

 if(baixar){
   setTimeout(()=>novaJanela.print(),800)
 }
}

function abrirDanfeNfe(chaveNfe){

 if(!chaveNfe){
   Swal.fire('Chave da NF-e não encontrada')
   return
 }

 window.open(
   `https://meudanfe.com.br/?chave=${chaveNfe}`,
   '_blank'
 )
}

function abrirDanfe(chave){
 gerarDanfe(chave,false)
}

function baixarDanfe(chave){
 gerarDanfe(chave,true)
}

function mostrarMensagemScanner(texto,tipo='sucesso'){

 const msg=document.getElementById('msgScanner')

 msg.style.display='block'
 msg.innerText=texto

 msg.className=
  tipo==='sucesso'
  ?'msg-scanner msg-sucesso'
  :'msg-scanner msg-erro'

 setTimeout(()=>{
  msg.style.display='none'
 },2000)
}

async function abrir(numero){

 viagemAtual=viagens.find(v=>v.numero===numero)

 document.getElementById('modal').classList.remove('hidden')

 document.getElementById('tituloViagem').innerText='Viagem #'+numero

 await renderDocs()

 setTimeout(()=>{
   document.getElementById('scanner')?.focus()
 },200)
}

async function acessarAcompanhamento(){

 const { value: senha } = await Swal.fire({
   title:'Área Restrita',
   input:'password',
   inputPlaceholder:'Digite a senha',
   showCancelButton:true
 })

 if(!senha) return

 if(senha !== '123456'){
   Swal.fire('Senha incorreta')
   return
 }

 mostrarTela('acompanhamento')
}

async function abrirOcorrencia(id){

 const { value: formValues } = await Swal.fire({
   title: 'Registrar Ocorrência',

   html: `
     <select id="swalOcorrencia" class="swal2-input">

       <option value="CLIENTE AUSENTE">
       Cliente Ausente
       </option>

       <option value="ENDERECO NAO LOCALIZADO">
       Endereço Não Localizado
       </option>

       <option value="RECUSADO">
       Recusado
       </option>

       <option value="MERCADORIA AVARIADA">
       Mercadoria Avariada
       </option>

       <option value="REENTREGA">
       Reentrega
       </option>

       <option value="OUTROS">
       Outros
       </option>

     </select>

     <textarea
       id="swalObs"
       class="swal2-textarea"
       placeholder="Observação">
     </textarea>
   `,

   preConfirm: () => {

     return {

       tipo:
       document.getElementById('swalOcorrencia').value,

       obs:
       document.getElementById('swalObs').value

     }

   }

 })

 if(!formValues) return

 await client
 .from('documentos')
 .update({

   status_entrega:'OCORRENCIA',

   tipo_ocorrencia:formValues.tipo,

   observacao_ocorrencia:formValues.obs,

   data_ocorrencia:agoraBrasil()

 })
 .eq('id',id)

 Swal.fire(
   'Ocorrência registrada'
 )

 listarPendentes()
 atualizarDashboardBaixa()
}

async function uploadImagem(file){

 if(!file){
   Swal.fire('Selecione uma foto')
   return null
 }

 const extensao = file.name.split('.').pop()

 const nome =
 `${Date.now()}-${Math.random()
   .toString(36)
   .substring(2)}.${extensao}`

 const { data:uploadData, error } =
 await client.storage
 .from('comprovantes')
 .upload(nome, file)

 if(error){
   console.error('ERRO UPLOAD:', error)
   Swal.fire(error.message)
   return null
 }

 const { data } =
 client.storage
 .from('comprovantes')
 .getPublicUrl(nome)

 console.log('URL GERADA:', data.publicUrl)

 return data.publicUrl
}

async function importarZip(){

 const arquivo =
 document.getElementById('zipXml').files[0]

 if(!arquivo){
   Swal.fire('Selecione um arquivo ZIP')
   return
 }

 Swal.fire({
   title:'Importando XMLs...',
   allowOutsideClick:false,
   didOpen:()=>Swal.showLoading()
 })

 const zip = await JSZip.loadAsync(arquivo)

 let total = 0

 for(const nomeArquivo in zip.files){

   const arquivoZip = zip.files[nomeArquivo]

   if(
      arquivoZip.dir ||
      !nomeArquivo.toLowerCase().endsWith('.xml')
   ){
      continue
   }

   try{

      const conteudo =
      await arquivoZip.async('text')

      const parser = new DOMParser()

      const xml =
      parser.parseFromString(
         conteudo,
         'text/xml'
      )

      await importarXml(xml)

      total++

   }catch(err){

      console.error(
        nomeArquivo,
        err
      )

   }
 }

 Swal.fire(
   'Sucesso',
   `${total} XML(s) importados`,
   'success'
 )

 carregar()
}

function getTag(parent, tag){

 const el = parent.querySelector(tag)

 return el ? el.textContent : null
}

async function importarXml(xml){

 const infCte = xml.querySelector('infCte')
 const emit = xml.querySelector('emit')
 const rem = xml.querySelector('rem')
 const dest = xml.querySelector('dest')
 const vPrest = xml.querySelector('vPrest')
 const infCarga = xml.querySelector('infCarga')
 const ide = xml.querySelector('ide')

 const chave =
 infCte?.getAttribute('Id')
 ?.replace('CTe','')

 const notas = []
const chavesNfe = []

xml.querySelectorAll('infNFe').forEach(nfe => {

   const chave = nfe.querySelector('chave')?.textContent

   if(chave){

      chavesNfe.push(chave)

      if(chave.length >= 34){
         notas.push(chave.substring(25,34))
      }
   }
})

let peso = null
let quantidadeVolumes = null
let volumeM3 = null

xml.querySelectorAll('infQ').forEach(item => {

    const tpMed =
        item.querySelector('tpMed')
        ?.textContent
        ?.toUpperCase() || ''

    const qCarga =
        item.querySelector('qCarga')
        ?.textContent

    if(
        tpMed.includes('PESO') ||
        tpMed.includes('KG')
    ){
        peso = Number(qCarga)
    }

    if(tpMed.includes('VOLUMES')){
        quantidadeVolumes = Number(qCarga)
    }

    if(tpMed === 'VOLUME'){
        volumeM3 = Number(qCarga)
    }

})

const observacao =
    xml.querySelector('xObs')
    ?.textContent
    ?.toUpperCase() || ''

if(!quantidadeVolumes){

    const matchVol =
        observacao.match(
            /(VOL|VOLUMES?)\.?\s*(\d+)/i
        )

    if(matchVol){
        quantidadeVolumes =
            Number(matchVol[2])
    }
}

if(!peso){

    const matchPeso =
        observacao.match(
            /PESO(?:\s*BRUTO)?\s*([\d.,]+)/i
        )

    if(matchPeso){

        peso = Number(
            matchPeso[1]
            .replace(',','.')
        )
    }
}

 let tomador = ''

 const toma =
 xml.querySelector('toma3 toma')
 ?.textContent

 switch(toma){

   case '0':
     tomador='REMETENTE'
     break

   case '1':
     tomador='EXPEDIDOR'
     break

   case '2':
     tomador='RECEBEDOR'
     break

   case '3':
     tomador='DESTINATARIO'
     break

   case '4':
     tomador='OUTROS'
     break
 }

 const dados = {

   chave_cte: chave,

   numero_cte: getTag(ide,'nCT'),

   numero_nota: notas.join(', '),
   chave_nfe: chavesNfe.join(', '),

   emitente: getTag(emit,'xNome'),

   remetente: getTag(rem,'xNome'),
   remetente_cnpj: getTag(rem,'CNPJ'),

   destinatario: getTag(dest,'xNome'),
   destinatario_cnpj: getTag(dest,'CNPJ'),

   valor_nota:
   xml.querySelector('vCarga')?.textContent || null,

   valor_cte: getTag(vPrest,'vTPrest'),

   peso: peso,

   quantidade_volumes: quantidadeVolumes,

   volume_m3: volumeM3,

   tomador_frete: tomador,

   cidade_origem: getTag(ide,'xMunIni'),

   cidade_destino: getTag(ide,'xMunFim'),

   uf_origem: getTag(ide,'UFIni'),

   uf_destino: getTag(ide,'UFFim'),

   data_emissao: getTag(ide,'dhEmi'),

   status_consulta:'xml_importado'
}

 const { data:existente } =
 await client
 .from('documentos')
 .select('id')
 .eq('chave_cte',chave)
 .maybeSingle()

 if(existente){

   await client
   .from('documentos')
   .update(dados)
   .eq('id',existente.id)

 }else{

   await client
   .from('documentos')
   .insert([dados])
 }

}

// ======================
// TEMA ESCURO
// ======================

function aplicarTema(){

    const tema =
    localStorage.getItem('tema') || 'claro'

    if(tema === 'escuro'){

        document.body.classList.add('dark')

        const btn =
        document.getElementById('btnTema')

        if(btn){
            btn.innerHTML = '☀️ Modo Claro'
        }

    }else{

        document.body.classList.remove('dark')

        const btn =
        document.getElementById('btnTema')

        if(btn){
            btn.innerHTML = '🌙 Modo Escuro'
        }
    }
}

function alternarTema(){

    const escuro =
    document.body.classList.toggle('dark')

    localStorage.setItem(
        'tema',
        escuro ? 'escuro' : 'claro'
    )

    aplicarTema()
}

let leitorCamera = null

// function abrirLeitorCamera(){

//     const div = document.getElementById('camera-reader')

//     div.innerHTML = ''

//     leitorCamera = new Html5Qrcode("camera-reader")

//     leitorCamera.start(
//         {
//             facingMode:"environment"
//         },
//         {
//             fps:10,
//             qrbox:250
//         },
//         async (textoLido)=>{

//             const numeros =
//             textoLido.replace(/\D/g,'')

//             if(numeros.length >= 44){

//                 document.getElementById('scanner').value =
//                 numeros.substring(0,44)

//                 await inserirManual()

//                 fecharLeitor()
//             }
//         }
//     )
// }

function fecharLeitor(){

    if(leitorZXing){

        leitorZXing.reset()
    }
}


let leitorZXing = null

async function abrirLeitorCamera(){

    try{

        document
            .getElementById('scanner-container')
            .classList.remove('hidden')

        leitorZXing = new ZXing.BrowserMultiFormatReader()

        const video =
            document.getElementById('videoScanner')

        const devices =
            await navigator.mediaDevices.getUserMedia({
                video:{
                    facingMode:"environment"
                }
            })

        video.srcObject = devices
        video.play()

        leitorZXing.decodeFromVideoElement(
            video,
            (result,err)=>{

                // if(result){

                //     const codigo =
                //         result.text.replace(/\D/g,'')

                //     console.log("Lido:",codigo)

                //     if(codigo.length >= 44){

                //         document
                //             .getElementById('scanner')
                //             .value =
                //             codigo.substring(0,44)

                //         inserirManual()

                //         fecharLeitor()
                //     }
                // }
                if(result){

    alert(result.text)

}
            }
        )

    }catch(e){

        console.error(e)

        Swal.fire({
            icon:'error',
            title:'Erro',
            text:e.message
        })
    }
}



function calcularCubagem(){

    const altura =
    Number(
    document.getElementById('altura').value
    ) || 0

    const largura =
    Number(
    document.getElementById('largura').value
    ) || 0

    const comprimento =
    Number(
    document.getElementById('comprimento').value
    ) || 0

    const cubagem =
    (altura * largura * comprimento)
    / 1000000

    document.getElementById('cubagem').value =
    cubagem.toFixed(3)

     calcularFrete()
}


async function buscarCnpj(){

    const cnpj =
    document.getElementById('cnpjDestino')
    .value.replace(/\D/g,'')

    if(cnpj.length !== 14){
        Swal.fire(
            'Atenção',
            'Digite um CNPJ válido',
            'warning'
        )
        return
    }

    try{

        const resp =
        await fetch(
            `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`
        )

        if(!resp.ok)
            throw new Error()

        const dados =
        await resp.json()

        console.log(dados)

        document.getElementById('razaoSocial').value =
        dados.razao_social || ''

        document.getElementById('cidadeDestino').value =
        dados.municipio || ''

        document.getElementById('estadoDestino').value =
        dados.uf || ''

      const cep = (dados.cep || '').replace(/\D/g,'')

document.getElementById('cepDestino').value =
cep.replace(
/(\d{5})(\d{3})/,
'$1-$2'
)

      document.getElementById('enderecoDestino').value =
`${dados.logradouro || ''}
 ${dados.numero || ''}
 ${dados.bairro || ''}`

       

    }catch(e){

        console.error(e)

        Swal.fire(
            'Erro',
            'Não foi possível consultar o CNPJ',
            'error'
        )

    }
await calcularFrete()
}

function abrirAbaCotacao(aba){

    document.getElementById('abaNovaCotacao')
    .style.display = 'none'

    document.getElementById('abaTaxas')
    .style.display = 'none'

    document
    .querySelectorAll('.tab-btn')
    .forEach(btn=>{
        btn.classList.remove('ativo')
    })

    if(aba === 'nova'){

    document.getElementById(
    'abaNovaCotacao'
    ).style.display = 'block'

    document
    .querySelectorAll('.tab-btn')[0]
    .classList.add('ativo')

}else{

    document.getElementById(
    'abaTaxas'
    ).style.display = 'block'

    document
    .querySelectorAll('.tab-btn')[1]
    .classList.add('ativo')

    carregarTaxas()
}
}

async function calcularFrete(){

    const uf =
    document.getElementById('estadoDestino')
    ?.value || ''

    const cidade =
    (
        document.getElementById('cidadeDestino')
        ?.value || ''
    ).toUpperCase()

    const valorNota =
    Number(
        document.getElementById('valorNota')
        ?.value
    ) || 0

    if(!uf || valorNota <= 0){

        document.getElementById(
        'resultadoFrete'
        ).innerHTML = ''

        return
    }

    try{

        const { data, error } =
        await client
        .from('taxas_cotacao')
        .select('*')
        .eq('uf', uf)
        .eq('ativo', true)

        if(error)
            throw error

        let percentual = 11

        const taxaCidade =
        data.find(
            item =>
            item.cidade &&
            item.cidade.toUpperCase() === cidade
        )

        if(taxaCidade){

            percentual =
            Number(taxaCidade.percentual)

        }else{

            const taxaPadrao =
            data.find(
                item =>
                item.cidade === '*'
            )

            if(taxaPadrao){

                percentual =
                Number(
                taxaPadrao.percentual
                )

            }
        }

        const frete =
        valorNota *
        (percentual / 100)

        document.getElementById(
        'percentualAplicado'
        ).value =
        percentual.toFixed(2) + '%'

        document.getElementById(
        'valorFrete'
        ).value =
        frete.toLocaleString(
            'pt-BR',
            {
                style:'currency',
                currency:'BRL'
            }
        )

        document.getElementById(
        'resultadoFrete'
        ).innerHTML = `
            <h3>Resultado da Cotação</h3>

            <p>
            <b>UF:</b> ${uf}
            </p>

            <p>
            <b>Cidade:</b> ${cidade}
            </p>

            <p>
            <b>Percentual:</b> ${percentual.toFixed(2)}%
            </p>

            <div style="
                font-size:28px;
                font-weight:bold;
                color:#16a34a;
                margin-top:15px;
            ">
                ${frete.toLocaleString(
                    'pt-BR',
                    {
                        style:'currency',
                        currency:'BRL'
                    }
                )}
            </div>
        `

    }catch(err){

        console.error(err)

        Swal.fire(
            'Erro',
            'Não foi possível calcular o frete.',
            'error'
        )

    }
}

async function salvarTaxa(){

    const uf =
    document.getElementById('taxaUf')
    .value.toUpperCase()

    const cidade =
    document.getElementById('taxaCidade')
    .value.toUpperCase()

    const percentual =
    Number(
        document.getElementById('taxaPercentual')
        .value
    )

    if(!uf || !cidade || !percentual){

        Swal.fire(
            'Preencha todos os campos'
        )

        return
    }

    let query =
    client
    .from('taxas_cotacao')

    if(taxaEditando){

        await query
        .update({
            uf,
            cidade,
            percentual
        })
        .eq('id', taxaEditando)

        Swal.fire(
            'Atualizado!'
        )

    }else{

        await query.insert({
            uf,
            cidade,
            percentual,
            ativo:true
        })

        Swal.fire(
            'Taxa cadastrada!'
        )
    }

    taxaEditando = null

    limparFormularioTaxa()

    carregarTaxas()
}

function limparFormularioTaxa(){

    document.getElementById('taxaUf').value = ''

    document.getElementById('taxaCidade').value = ''

    document.getElementById('taxaPercentual').value = ''
}

function editarTaxa(id,uf,cidade,percentual){

    taxaEditando = id

    document.getElementById('taxaUf')
    .value = uf

    document.getElementById('taxaCidade')
    .value = cidade

    document.getElementById('taxaPercentual')
    .value = percentual

}

async function excluirTaxa(id){

    const confirma =
    await Swal.fire({
        title:'Excluir?',
        showCancelButton:true
    })

    if(!confirma.isConfirmed)
        return

    await client
    .from('taxas_cotacao')
    .delete()
    .eq('id',id)

    carregarTaxas()

}

async function carregarTaxas(){

    const { data, error } =
    await client
    .from('taxas_cotacao')
    .select('*')
    .order('uf')

    if(error){
        console.error(error)
        return
    }

    const tabela =
    document.getElementById('listaTaxas')

    tabela.innerHTML = ''

    data.forEach(item=>{

        tabela.innerHTML += `
        <tr>

            <td>${item.uf}</td>

            <td>${item.cidade}</td>

            <td>${item.percentual}%</td>

            <td>

                <button
                class="btn-ver"
                onclick="
                editarTaxa(
                ${item.id},
                '${item.uf}',
                '${item.cidade}',
                ${item.percentual}
                )">
                Editar
                </button>

                <button
                class="btn-cancelar"
                onclick="
                excluirTaxa(${item.id})
                ">
                Excluir
                </button>

            </td>

        </tr>
        `
    })

}